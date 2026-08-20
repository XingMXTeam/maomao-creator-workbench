import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { mkdir, readFile, readdir, writeFile, stat, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Maomao Creator Workbench — ContentManager (Phase 6).
 *
 * Manages content assets in the workspace under `content/<id>/`:
 *   meta.json        → { id, title, type, status, cover, createdAt, updatedAt,
 *                        videoPath, theme, persona, subtitleSource }
 *   script.md        → 脚本
 *   subtitle.srt     → 字幕（SRT 时间轴）
 *   cover.md         → 封面方案（Cover Studio 产物，含多方案）
 *   article.md       → 文章
 *   publish.md       → 发布信息
 *
 * Content types: video / script / subtitle / cover / article / publish.
 * The workbench OWNS this service (like ContentIntelligence); it does NOT
 * touch projects/ (owned by @maomao/content-projects).
 *
 * AI actions (generate subtitles / cover plans) drive the session's bound
 * agent through ctx.agents (same pattern as ContentWorkflows) and verify the
 * produced artifact. The current content context is cached for the
 * `maomao:content-context` prompt section so the Agent always knows what the
 * user is working on.
 */

/** Content types managed by the workbench. */
export const CONTENT_TYPES = ["video", "script", "subtitle", "cover", "article", "publish"];

/** Content status values. */
export const CONTENT_STATUSES = ["idea", "draft", "editing", "review", "ready", "published", "archived"];

/** Artifact files of one content item. */
export const CONTENT_ARTIFACTS = ["script.md", "subtitle.srt", "cover.md", "article.md", "publish.md"];

/** Slug/ID segment guard. */
const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function serializeMeta(meta) {
	return `${JSON.stringify(meta, null, 2)}\n`;
}

function assertId(id) {
	if (typeof id !== "string" || id === "" || !ID_PATTERN.test(id)) {
		throw new Error(`content-manager: invalid id "${String(id)}"`);
	}
}

function assertType(type) {
	if (!CONTENT_TYPES.includes(type)) {
		throw new Error(`content-manager: invalid type "${String(type)}"`);
	}
}

function assertStatus(status) {
	if (!CONTENT_STATUSES.includes(status)) {
		throw new Error(`content-manager: invalid status "${String(status)}"`);
	}
}

/** Passthrough strict codec (JSON wire). */
function passthrough(typeSymbol) {
	return {
		mode: "strict",
		typeSymbol,
		schema: { parse: (value) => value }
	};
}

function jsonParam(name) {
	return {
		name,
		wire: name,
		source: "json",
		codec: passthrough(`maomao-creator-workbench#${name}`)
	};
}

function descriptor(method, parameters, resultType) {
	return {
		id: `maomao-creator-workbench#contentManager/${method}`,
		service: "contentManager",
		namespace: "contentManager",
		method,
		invocation: { kind: "direct" },
		parameters,
		result: passthrough(resultType)
	};
}

/** Build a content-context prompt section body for the currently open item. */
export function buildContentContextSection(meta, artifacts) {
	if (meta === null) return "";
	const lines = [
		"[当前内容 · Content Context]",
		`- 内容 ID：${meta.id}`,
		`- 标题：${meta.title ?? "—"}`,
		`- 类型：${meta.type ?? "—"}`,
		`- 状态：${meta.status ?? "—"}`,
		`- 视频文件：${meta.videoPath || "—"}`,
		`- 主题：${meta.theme || "—"}｜用户画像：${meta.persona || "—"}`
	];
	const brief = (name, text) => {
		const value = (text ?? "").trim();
		if (value === "") return null;
		return `- ${name}：${value.length > 120 ? `${value.slice(0, 120)}…` : value}`;
	};
	for (const line of [
		brief("脚本", artifacts["script.md"]),
		brief("字幕", artifacts["subtitle.srt"]),
		brief("封面方案", artifacts["cover.md"]),
		brief("文章", artifacts["article.md"])
	]) {
		if (line !== null) lines.push(line);
	}
	lines.push("用户输入「优化这个封面 / 生成字幕 / 修改脚本」等指令时，直接基于上述当前内容执行，并把结果写回 content/<id>/ 对应文件。");
	return lines.join("\n");
}

/** The host service. */
export class ContentManagerService extends TypertRemoteService {
	contentProjects;
	agents;
	constructor(ctx, config = {}) {
		super(ctx, "contentManager");
		this.contentProjects = ctx.contentProjects;
		this.agents = ctx.agents;
		this.currentId = null;
		this.currentSnapshot = null;
		/** id → { status, error, startedAt, completedAt } (in-memory; artifacts persist). */
		this.runs = /* @__PURE__ */ new Map();
		this.backgroundTasks = [];
		ctx.effect(() => {
			this.refreshCurrent().catch(() => {
			});
			const timer = setInterval(() => {
				this.refreshCurrent().catch(() => {
				});
			}, 15000);
			timer.unref?.();
			return () => clearInterval(timer);
		}, "content-manager: context cache warmer");
	}

	/** Absolute content root (workspace/content). */
	async contentRoot() {
		const root = await this.contentProjects.resolveRoot();
		return join(root, "content");
	}

	async itemDir(id) {
		return join(await this.contentRoot(), id);
	}

	async readMeta(id) {
		assertId(id);
		try {
			const raw = await readFile(join(await this.itemDir(id), "meta.json"), "utf8");
			return JSON.parse(raw);
		} catch {
			return null;
		}
	}

	/** Remote list(): every content item (meta only, sorted by updatedAt desc). */
	async list() {
		const root = await this.contentRoot();
		const items = [];
		try {
			const entries = await readdir(root, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const meta = await this.readMeta(entry.name);
				if (meta !== null) items.push(meta);
			}
		} catch {
			// content root missing → empty list
		}
		items.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
		return { items };
	}

	/** Remote get(id): meta + artifact texts + run state. */
	async get(id) {
		const meta = await this.readMeta(id);
		if (meta === null) throw new Error(`content-manager: content "${id}" not found`);
		const dir = await this.itemDir(id);
		const artifacts = {};
		for (const name of CONTENT_ARTIFACTS) {
			try {
				artifacts[name] = await readFile(join(dir, name), "utf8");
			} catch {
				artifacts[name] = "";
			}
		}
		return { item: meta, artifacts, run: this.runs.get(id) ?? null };
	}

	/** Remote create({title,type}): make content/<id>/ + meta.json. */
	async create(input) {
		const title = String(input?.title ?? "未命名内容").trim() || "未命名内容";
		const type = String(input?.type ?? "video");
		assertType(type);
		const now = new Date().toISOString();
		const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		const meta = {
			id,
			title,
			type,
			status: "idea",
			cover: "",
			createdAt: now,
			updatedAt: now,
			videoPath: "",
			theme: "",
			persona: ""
		};
		const dir = await this.itemDir(id);
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "meta.json"), serializeMeta(meta), "utf8");
		await this.refreshCurrent();
		return { item: meta };
	}

	/** Remote update(id, patch): mutate meta.json (title/status/cover/videoPath/theme/persona). */
	async update(id, patch = {}) {
		const meta = await this.readMeta(id);
		if (meta === null) throw new Error(`content-manager: content "${id}" not found`);
		if (patch.type !== void 0) assertType(patch.type);
		if (patch.status !== void 0) assertStatus(patch.status);
		const next = { ...meta };
		for (const key of ["title", "type", "status", "cover", "videoPath", "theme", "persona"]) {
			if (patch[key] !== void 0) next[key] = patch[key];
		}
		next.updatedAt = new Date().toISOString();
		await writeFile(join(await this.itemDir(id), "meta.json"), serializeMeta(next), "utf8");
		await this.refreshCurrent();
		return { item: next };
	}

	/** Remote remove(id): delete the whole content/<id>/ directory. */
	async remove(id) {
		await rm(join(await this.contentRoot(), id), { recursive: true, force: true });
		if (this.currentId === id) {
			this.currentId = null;
			this.currentSnapshot = null;
		}
		return { ok: true };
	}

	/** Remote readArtifact(id, name). */
	async readArtifact(id, name) {
		const dir = await this.itemDir(id);
		try {
			return { content: await readFile(join(dir, name), "utf8") };
		} catch {
			return { content: "" };
		}
	}

	/** Remote writeArtifact(id, name, content). */
	async writeArtifact(id, name, content) {
		if (!CONTENT_ARTIFACTS.includes(name)) throw new Error(`content-manager: unknown artifact "${name}"`);
		await writeFile(join(await this.itemDir(id), name), String(content ?? ""), "utf8");
		await this.refreshCurrent();
		return { ok: true };
	}

	/** Remote setCurrent(id|null): mark the item the user is working on. */
	async setCurrent(id) {
		if (id === null) {
			this.currentId = null;
			this.currentSnapshot = null;
			return { ok: true };
		}
		const meta = await this.readMeta(id);
		if (meta === null) throw new Error(`content-manager: content "${id}" not found`);
		this.currentId = id;
		await this.refreshCurrent();
		return { ok: true };
	}

	/** Remote current(): the cached context snapshot for the prompt section. */
	async current() {
		await this.refreshCurrent();
		return { currentId: this.currentId, section: this.currentSnapshot ?? "" };
	}

	/** Refresh the cached context section (called on changes + timer). */
	async refreshCurrent() {
		if (this.currentId === null) {
			this.currentSnapshot = null;
			return;
		}
		const meta = await this.readMeta(this.currentId);
		if (meta === null) {
			this.currentSnapshot = null;
			return;
		}
		const { artifacts } = await this.get(this.currentId);
		this.currentSnapshot = buildContentContextSection(meta, artifacts);
	}

	/** Prompt-section body: synchronous read of the cached context. */
	contentContextSection() {
		return this.currentSnapshot ?? "";
	}

	/** Drive the bound agent to generate subtitles (SRT) for the content. */
	async generateSubtitles(id, sessionId) {
		const { item: meta, artifacts } = await this.get(id);
		if (typeof sessionId !== "string" || sessionId === "") throw new Error("content-manager: 需要当前会话 ID 才能驱动 Agent");
		const agent = this.agents.get(sessionId);
		if (agent === void 0) throw new Error("content-manager: 当前会话的 Agent 不在运行中，请先在浏览器中打开会话");
		if (agent.status !== "idle") throw new Error("content-manager: Agent 正在处理其他任务，请稍后再试");
		const prompt = [
			`[字幕生成] 为内容「${meta.title}」（id: ${meta.id}）生成字幕。`,
			`视频文件：${meta.videoPath || "（未填写）"}`,
			`脚本（如有，作为字幕内容依据）：`,
			`---`,
			(artifacts["script.md"] ?? "").trim().slice(0, 4000) || "（无脚本，请基于标题/主题生成示范字幕）",
			`---`,
			`要求：`,
			`1. 生成 SRT 格式字幕（序号\\n时间轴 HH:MM:SS,mmm --> HH:MM:SS,mmm\\n文本\\n空行分隔），写入 projects 同级目录：content/<id>/subtitle.srt（用文件写入工具）。`,
			`2. 时间轴为合理示范值，文本口语化、与脚本一致；如无法访问真实视频时间，明确标注「时间轴为示范，需按实际视频校准」。`,
			`3. 只写字幕文件，不要修改其它文件。`
		].join("\n");
		await this.runAgentTurn(agent, prompt, id, "subtitle.srt", meta);
		return { ok: true };
	}

	/** Drive the bound agent to produce cover plans (Cover Studio). */
	async generateCovers(id, sessionId) {
		const { item: meta, artifacts } = await this.get(id);
		if (typeof sessionId !== "string" || sessionId === "") throw new Error("content-manager: 需要当前会话 ID 才能驱动 Agent");
		const agent = this.agents.get(sessionId);
		if (agent === void 0) throw new Error("content-manager: 当前会话的 Agent 不在运行中，请先在浏览器中打开会话");
		if (agent.status !== "idle") throw new Error("content-manager: Agent 正在处理其他任务，请稍后再试");
		const prompt = [
			`[封面方案生成] 为内容「${meta.title}」（id: ${meta.id}）设计封面方案。`,
			`- 主题：${meta.theme || "（未填）"}`,
			`- 用户画像：${meta.persona || "（未填）"}`,
			`- 脚本摘要：${(artifacts["script.md"] ?? "").trim().slice(0, 800) || "（无脚本）"}`,
			`要求：`,
			`1. AI 分析：提炼标题、内容主题、用户画像；据此给出 3 个封面方案。`,
			`2. 每个方案包含：主标题（≤12字）、副文案、布局类型（大字/对比/清单/人物/极简）、配色建议、构图要点。`,
			`3. 把完整方案写入 content/<id>/cover.md（用文件写入工具），格式为 Markdown，每个方案用 "## 方案 N" 分隔，并标注推荐项。`,
			`4. 只写 cover.md，不要修改其它文件。`
		].join("\n");
		await this.runAgentTurn(agent, prompt, id, "cover.md", meta);
		return { ok: true };
	}

	/** One agent turn: followup → idle → verify artifact → record run state. */
	async runAgentTurn(agent, prompt, id, artifact, meta) {
		this.runs.set(id, { status: "running", error: null, startedAt: new Date().toISOString(), completedAt: null });
		const background = (async () => {
			try {
				agent.followup(createUserMessage({
					content: [{ type: "text", text: prompt }],
					source: { kind: "user" }
				}));
				await agent.whenIdle();
			} catch (error) {
				this.runs.set(id, { status: "failed", error: error instanceof Error ? error.message : String(error), startedAt: this.runs.get(id)?.startedAt ?? null, completedAt: new Date().toISOString() });
				return;
			}
			const { artifacts } = await this.get(id);
			const okArtifact = (artifacts[artifact] ?? "").trim() !== "";
			this.runs.set(id, {
				status: okArtifact ? "success" : "failed",
				error: okArtifact ? null : `Agent 未产出 ${artifact}（文件为空或不存在）`,
				startedAt: this.runs.get(id)?.startedAt ?? null,
				completedAt: new Date().toISOString()
			});
			await this.refreshCurrent();
		})();
		this.backgroundTasks.push(background);
		// Fire-and-forget like ContentWorkflows: the client polls get(id).run.
	}

	/** Remote exportSrt(id): return the SRT content for download. */
	async exportSrt(id) {
		const { artifacts } = await this.get(id);
		return { name: `${id}.srt`, content: artifacts["subtitle.srt"] ?? "" };
	}
}

/** The host Remote contribution. */
export function buildContentManagerContribution() {
	return {
		package: "maomao-creator-workbench.content",
		face: "host",
		model: void 0,
		schemas: [],
		invocations: [
			descriptor("list", [], "ContentListResult"),
			descriptor("get", [jsonParam("id")], "ContentDetailResult"),
			descriptor("create", [jsonParam("input")], "ContentResult"),
			descriptor("update", [jsonParam("id"), jsonParam("patch")], "ContentResult"),
			descriptor("remove", [jsonParam("id")], "OkResult"),
			descriptor("readArtifact", [jsonParam("id"), jsonParam("name")], "ArtifactResult"),
			descriptor("writeArtifact", [jsonParam("id"), jsonParam("name"), jsonParam("content")], "OkResult"),
			descriptor("setCurrent", [jsonParam("id")], "OkResult"),
			descriptor("current", [], "CurrentContentResult"),
			descriptor("generateSubtitles", [jsonParam("id"), jsonParam("sessionId")], "OkResult"),
			descriptor("generateCovers", [jsonParam("id"), jsonParam("sessionId")], "OkResult"),
			descriptor("exportSrt", [jsonParam("id")], "SrtExportResult")
		]
	};
}
