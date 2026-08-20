import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { isBlankArtifact } from "./workflows.js";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * 毛毛星 Creator — Content Intelligence System (Phase 4).
 *
 * 三层能力，全部放在这一个插件里，不触碰 content-projects（状态）与
 * content-workflows（动作）：
 *
 * 1. Content Knowledge Layer — `knowledge/index.json` 是 Schema（分类/文件/
 *    触发词/loadGroups）；`knowledgePlan(task)` 按动作或任务关键词动态解析
 *    文件清单，绝不全量注入。注册 `maomao:knowledge-index` prompt section，
 *    只给路径索引（不给内容），Agent 按需 read。
 * 2. Content Style Engine — 包内 `style-rules.json`（五组规则：写作风格/标题/
 *    结构/判断/投资），`styleRules()` Remote 输出给 UI 与 Critic 提示词。
 * 3. Critic Agent — `critic(slug)` 驱动项目绑定会话的 Agent 审查 draft.md
 *    （只审查不重写），产出 projects/<slug>/critique.md；`critique(slug)`
 *    读取并解析出 { score, issues, suggestions } 供 UI 展示。
 */

/** The critic artifact file, owned by this plugin (not part of content-projects' 7 files). */
export const CRITIQUE_FILE = "critique.md";

/** Knowledge schema file name inside the workspace knowledge/ directory. */
export const KNOWLEDGE_INDEX_FILE = "index.json";

/** Pseudo-path used inside loadGroups to reference the package-level style-rules.json. */
export const STYLE_RULES_PSEUDO_PATH = "rules/style-rules.json";

/** The one workflow action this plugin owns. */
export const CRITIC_ACTION = "critic";

/** Passthrough strict codec (the wire is JSON; the UI layer validates shape). */
function passthrough(typeSymbol) {
	return {
		mode: "strict",
		typeSymbol,
		schema: { parse: (value) => value }
	};
}

/** One JSON parameter declaration. */
function jsonParam(name) {
	return {
		name,
		wire: name,
		source: "json",
		codec: passthrough(`maomao-creator-workbench#${name}`)
	};
}

/** One direct Remote invocation descriptor. */
function descriptor(method, parameters, resultType) {
	return {
		id: `maomao-creator-workbench#contentIntelligence/${method}`,
		service: "contentIntelligence",
		namespace: "contentIntelligence",
		method,
		invocation: { kind: "direct" },
		parameters,
		result: passthrough(resultType)
	};
}

/** Guard error: distinguishable so the UI can show the blocking reason. */
export class CriticError extends Error {
	code = "critic-guard";
	constructor(message) {
		super(message);
		this.name = "CriticError";
	}
}

/**
 * Parse the machine-readable JSON block out of critique.md.
 * Contract: the last ```json ... ``` fenced block carries { score, issues, suggestions }.
 * Falls back to a regex-extracted score when the fence is missing.
 */
export function parseCritique(content) {
	const text = (content ?? "").trim();
	if (text === "") return { score: null, issues: [], suggestions: [], raw: "" };
	const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
	let payload = null;
	for (const match of fences) {
		try {
			const parsed = JSON.parse(match[1].trim());
			if (parsed !== null && typeof parsed === "object") payload = parsed;
		} catch {
			// not a JSON fence; keep scanning
		}
	}
	if (payload === null) {
		const scoreMatch = text.match(/score\D{0,20}?(\d{1,3})/i);
		return {
			score: scoreMatch === null ? null : Math.min(100, Math.max(0, Number(scoreMatch[1]))),
			issues: [],
			suggestions: [],
			raw: text
		};
	}
	return {
		score: typeof payload.score === "number" ? Math.min(100, Math.max(0, payload.score)) : null,
		issues: Array.isArray(payload.issues) ? payload.issues.map(String) : [],
		suggestions: Array.isArray(payload.suggestions) ? payload.suggestions.map(String) : [],
		raw: text
	};
}

/**
 * Pure resolver over the knowledge schema: task → ordered relative file list.
 * Exact loadGroups hit wins; otherwise files whose triggers match the task text.
 */
export function resolveKnowledgePlan(index, task) {
	const groups = index?.loadGroups;
	const taskKey = String(task ?? "").trim();
	const group = groups?.[taskKey];
	if (Array.isArray(group) && group.length > 0) {
		return { mode: "group", group: taskKey, files: dedupeFiles(group) };
	}
	const hits = [];
	const categories = index?.categories ?? {};
	const lower = taskKey.toLowerCase();
	for (const [category, meta] of Object.entries(categories)) {
		const files = meta?.files ?? {};
		for (const [name, fileMeta] of Object.entries(files)) {
			const triggers = Array.isArray(fileMeta?.triggers) ? fileMeta.triggers : [];
			if (triggers.some((trigger) => lower.includes(String(trigger).toLowerCase()))) {
				hits.push(`${category}/${name}`);
			}
		}
	}
	return { mode: hits.length > 0 ? "triggers" : "empty", group: null, files: dedupeFiles(hits) };
}

/** Dedupe while preserving order. */
function dedupeFiles(files) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const file of files) {
		if (seen.has(file)) continue;
		seen.add(file);
		out.push(file);
	}
	return out;
}

/** Look up the human label of a "category/name.md" rel path in the schema. */
export function fileLabelOf(index, rel) {
	const [category, name] = String(rel ?? "").split("/");
	const meta = index?.categories?.[category]?.files?.[name];
	return typeof meta?.label === "string" ? meta.label : rel;
}

/** Build the Critic action prompt for the project's agent. */
export function buildCriticPrompt(project, plan, styleRulesAbs) {
	const files = plan?.files ?? [];
	const knowledgeLines = files
		.map((file) => {
			const path = file.abs ?? file.rel ?? "";
			return `- ${file.rel ?? path}（${path}）`;
		})
		.join("\n");
	return [
		`[Critic 动作] 对内容项目「${project.title}」（slug: ${project.slug}）执行内容质量审查。`,
		"",
		"角色：你是毛毛星内容质量审查员（Critic Agent）。你不是写作者——不要修改或重写 draft.md，不要新增内容。你的唯一产出是 critique.md。",
		"",
		"输入：projects/<slug>/draft.md（审查对象）；facts.md / thesis.md 作为依据可读，但审查对象只有 draft.md。",
		"",
		"知识加载（按需，只读下列文件，不要加载其它 knowledge）：",
		knowledgeLines || "- （无知识文件：按本提示词内置规则执行）",
		styleRulesAbs ? `- 风格引擎规则：${styleRulesAbs}` : "",
		"",
		"审查五个维度（每项给出 PASS / WARN / FAIL + 一句依据）：",
		"1. 事实可靠性：数据是否有来源标注；是否混淆事实与观点；关键数字口径（时间点/币种/单位/基准）。",
		"2. 观点质量：是否存在核心矛盾；是否有明确结论；结论是否可被反驳（禁止「机会与风险并存」「长期来看值得关注」）。",
		"3. 用户价值：普通用户为什么要看；是否回答「关我什么事」；收藏价值（可带走的东西：清单/框架/数字）。",
		"4. 风格检查：对照 style-rules.json：标题是否有用户问题/具体对象/冲突反差；是否博主腔/标题党/空洞鸡汤/概念堆砌；语感是否平和自然、像朋友交流；禁用词与绝对化表述。",
		"5. 投资内容检查（若内容涉及投资/公司/财报/股票/基金）：是否区分「公司分析」与「股票判断」；是否虚构持仓/收益承诺；判断依据（数据+推理链）是否说明；结尾是否有风险提示。",
		"",
		"输出：写入 projects/<slug>/critique.md，结构固定：",
		"1. 总体评价段落（2–4 句中文，指出最大问题与整体质量）；",
		"2. 五维逐项检查（每项一行：PASS/WARN/FAIL + 依据）；",
		"3. 结尾一个 ```json 代码块（机器可读，UI 读取）：{ \"score\": 0-100 整数, \"issues\": [\"问题（标注维度）\"...], \"suggestions\": [\"修改建议\"...] }。",
		"",
		"评分参考：≥85 可直接发布；70–84 需小改；<70 需重写关键部分。",
		"纪律：只审查不重写；不为了打分而打分——没发现的问题不编造；发现的问题必须写进 issues。"
	].join("\n");
}

/** The host service: Knowledge Layer + Style Engine + Critic. */
export class ContentIntelligenceService extends TypertRemoteService {
	contentProjects;
	agents;
	constructor(ctx, config = {}) {
		super(ctx, "contentIntelligence");
		this.contentProjects = ctx.contentProjects;
		this.agents = ctx.agents;
		this.backgroundTasks = [];
		this.styleRulesCache = null;
		this.styleRulesAbs = null;
		this.indexCache = null;
		this.indexRoot = null;
		/** slug → { status, error, startedAt, completedAt } (in-memory; critique.md persists on disk). */
		this.runs = /* @__PURE__ */ new Map();
		ctx.effect(() => {
			this.loadStyleRules().catch(() => {
			});
			this.refreshIndex().catch(() => {
			});
			const timer = setInterval(() => {
				this.refreshIndex().catch(() => {
				});
			}, 30000);
			timer.unref?.();
			return () => clearInterval(timer);
		}, "content-intelligence: knowledge/style cache warmer");
	}

	/** Absolute path of the package-level default style-rules.json. */
	packageStyleRulesPath() {
		return fileURLToPath(new URL("../style-rules.json", import.meta.url));
	}

	/**
	 * Resolve the ACTIVE style rules file: the workspace root's
	 * `style-rules.json` wins (user/Profile editable), the package default
	 * `lib/style-rules.json` is the fallback. Cached once resolved.
	 */
	async resolveStyleRulesPath() {
		if (this.styleRulesAbs !== null) return this.styleRulesAbs;
		let root = null;
		try {
			root = await this.contentProjects.resolveRoot();
		} catch {
			root = null;
		}
		if (root !== null) {
			try {
				await stat(join(root, "style-rules.json"));
				this.styleRulesAbs = join(root, "style-rules.json");
				return this.styleRulesAbs;
			} catch {
				// fall through to the package default
			}
		}
		this.styleRulesAbs = this.packageStyleRulesPath();
		return this.styleRulesAbs;
	}

	/** Load and cache the ACTIVE style-rules.json (workspace override, else package). */
	async loadStyleRules() {
		const path = await this.resolveStyleRulesPath();
		const raw = await readFile(path, "utf8");
		this.styleRulesCache = JSON.parse(raw);
		return this.styleRulesCache;
	}

	/** Refresh the knowledge/index.json cache (tolerant of a missing knowledge dir). */
	async refreshIndex() {
		let root;
		try {
			root = await this.contentProjects.resolveRoot();
		} catch {
			return null;
		}
		if (this.indexRoot === root && this.indexCache !== null) return this.indexCache;
		let index = null;
		try {
			const raw = await readFile(join(root, "knowledge", KNOWLEDGE_INDEX_FILE), "utf8");
			index = JSON.parse(raw);
		} catch {
			index = null;
		}
		this.indexRoot = root;
		this.indexCache = index;
		return index;
	}

	/** Resolve absolute paths for a knowledge plan against the workspace root. */
	async materializePlan(task) {
		const index = await this.refreshIndex();
		const plan = resolveKnowledgePlan(index, task);
		const root = await this.contentProjects.resolveRoot();
		const styleRules = await this.resolveStyleRulesPath();
		const files = [];
		for (const rel of plan.files) {
			if (rel === STYLE_RULES_PSEUDO_PATH) {
				files.push({ rel: STYLE_RULES_PSEUDO_PATH, abs: styleRules, label: "风格引擎规则" });
				continue;
			}
			files.push({ rel, abs: join(root, rel), label: fileLabelOf(index, rel) });
		}
		return { task, mode: plan.mode, group: plan.group, files };
	}

	/** Compact, path-only knowledge index for the prompt section (never the content). */
	knowledgeIndexSection() {
		const index = this.indexCache;
		if (index === null || index === void 0) return "";
		const lines = ["[知识索引] 按需读取，不一次加载："];
		const categories = index.categories ?? {};
		for (const [category, meta] of Object.entries(categories)) {
			const files = meta?.files ?? {};
			const names = Object.keys(files);
			if (names.length === 0) continue;
			lines.push(`- knowledge/${category}/：${names.join("、")}`);
		}
		lines.push("写公司研究→读 investment/company-analysis + valuation-framework；写普通商业观察→读 brand/tone + writing/title-rules；draft→读 brand/tone + writing/*；critic→读 content-system/quality-standard + writing/*。只读当前任务命中的文件。");
		return lines.join("\n");
	}

	/**
	 * Remote knowledgePlan(task): 按动作/任务解析知识加载清单（相对 + 绝对路径）。
	 * Agent 拿到路径后用 read 按需读取，不注入内容。
	 */
	async knowledgePlan(task) {
		const materialized = await this.materializePlan(task);
		return { ...materialized, knowledgeRoot: join(await this.contentProjects.resolveRoot(), "knowledge") };
	}

	/** Remote styleRules(): 风格引擎规则全文（UI/提示词用）。 */
	async styleRules() {
		if (this.styleRulesCache === null) await this.loadStyleRules();
		return { rules: this.styleRulesCache, path: await this.resolveStyleRulesPath() };
	}

	/**
	 * Remote critic(slug): 审查工作流。守卫（draft 非空、会话绑定、Agent idle）
	 * → 记录 running → 驱动绑定 Agent 执行 Critic 提示词 → 校验 critique.md →
	 * 记录 success/failed。立即返回，后台完成（client 轮询 critique(slug)）。
	 */
	async critic(slug) {
		const { project, files } = await this.contentProjects.get(slug);
		if (isBlankArtifact(files["draft.md"], "draft.md", project)) {
			throw new CriticError("内容质量检查需要先有草稿：draft.md 为空或仍为初始模板。请先执行「写小红书」。");
		}
		const sessionId = typeof project.activeSessionId === "string" ? project.activeSessionId : "";
		if (sessionId === "") throw new CriticError("项目尚未绑定会话：请先在浏览器中打开该项目。");
		const agent = this.agents.get(sessionId);
		if (agent === void 0) throw new CriticError("项目会话的 Agent 不在运行中：请在浏览器中打开该项目所在会话。");
		if (agent.status !== "idle") throw new CriticError("Agent 正在处理其他任务，请稍后再试。");
		const plan = await this.materializePlan(CRITIC_ACTION);
		this.runs.set(slug, { status: "running", error: null, startedAt: new Date().toISOString(), completedAt: null });
		const prompt = buildCriticPrompt(project, plan, await this.resolveStyleRulesPath());
		const background = this.runCriticTurn(agent, prompt, slug).catch((error) => {
			this.ctx.logger?.warn?.(`content-intelligence: ${slug}/critic failed: ${error instanceof Error ? error.message : String(error)}`);
		});
		this.backgroundTasks.push(background);
		return { ok: true, slug, action: CRITIC_ACTION, sessionId };
	}

	/** Drive one Critic agent turn and record the terminal run state. */
	async runCriticTurn(agent, prompt, slug) {
		try {
			agent.followup(createUserMessage({
				content: [{ type: "text", text: prompt }],
				source: { kind: "user" }
			}));
			await agent.whenIdle();
		} catch (error) {
			this.runs.set(slug, {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
				startedAt: this.runs.get(slug)?.startedAt ?? null,
				completedAt: new Date().toISOString()
			});
			return;
		}
		const root = await this.contentProjects.resolveRoot();
		let critique;
		try {
			critique = await readFile(join(root, "projects", slug, CRITIQUE_FILE), "utf8");
		} catch {
			critique = "";
		}
		const ok = critique.trim() !== "";
		this.runs.set(slug, {
			status: ok ? "success" : "failed",
			error: ok ? null : `Agent 未产出 ${CRITIQUE_FILE}（文件为空或不存在）。`,
			startedAt: this.runs.get(slug)?.startedAt ?? null,
			completedAt: new Date().toISOString()
		});
	}

	/** Remote critique(slug): 运行状态 + critique.md 解析结果（score/issues/suggestions）。 */
	async critique(slug) {
		const run = this.runs.get(slug) ?? null;
		const root = await this.contentProjects.resolveRoot();
		let content = "";
		try {
			content = await readFile(join(root, "projects", slug, CRITIQUE_FILE), "utf8");
		} catch {
			content = "";
		}
		return { slug, run, critique: parseCritique(content) };
	}

	/**
	 * Remote status(): environment probe for the Settings card.
	 * Reports which capability surfaces are live and which knowledge/style
	 * rule files are present in the active workspace.
	 */
	async status() {
		await this.refreshIndex();
		const index = this.indexCache;
		const has = (rel) => {
			if (index === null) return false;
			const [category, name] = String(rel).split("/");
			return index?.categories?.[category]?.files?.[name] !== void 0;
		};
		let root = null;
		try {
			root = await this.contentProjects.resolveRoot();
		} catch {
			root = null;
		}
		return {
			services: {
				contentProjects: this.contentProjects !== void 0,
				contentWorkflows: this.ctx.get("contentWorkflows") !== void 0,
				contentIntelligence: true
			},
			styleRules: this.styleRulesCache !== null,
			knowledge: {
				root,
				index: index !== null,
				writing: has("writing/structure-rules.md"),
				quality: has("content-system/quality-standard.md"),
				tone: has("brand/tone.md")
			}
		};
	}
}

/** The host Remote contribution (registered by the workbench assembler). */
export function buildIntelligenceContribution() {
	return {
		package: "maomao-creator-workbench.intelligence",
		face: "host",
		model: void 0,
		schemas: [],
		invocations: [
			descriptor("knowledgePlan", [jsonParam("task")], "KnowledgePlanResult"),
			descriptor("styleRules", [], "StyleRulesResult"),
			descriptor("critic", [jsonParam("slug")], "CriticRunResult"),
			descriptor("critique", [jsonParam("slug")], "CritiqueResult"),
			descriptor("status", [], "WorkbenchStatusResult")
		]
	};
}
