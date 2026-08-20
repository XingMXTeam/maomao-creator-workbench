import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { templateFor } from "./projects.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 毛毛星 Creator — ContentWorkflows host service (Phase 3).
 *
 * ContentProjects owns STATE (projects/<slug>/project.json); ContentWorkflows
 * owns ACTION (run(projectId, action)). Every action drives the project's
 * bound Harness Agent (agent.followup + whenIdle), then verifies the produced
 * artifact and records running/success/failed in project.json.
 *
 * Also registers the per-session "project context" prompt section, so ANY
 * composer request in a bound session automatically knows the current project.
 */

/** Phase-1 workflow actions and their artifact files. */
export const WORKFLOW_ACTIONS = ["research", "facts", "thesis", "draft", "publish-check"];

/** action → artifact file. */
export const ARTIFACT_OF = {
	"research": "research.md",
	"facts": "facts.md",
	"thesis": "thesis.md",
	"draft": "draft.md",
	"publish-check": "publish.md"
};

/** action guard: the artifact that must be non-empty before this action runs. */
export const ACTION_GUARD = {
	"facts": { file: "research.md", label: "Research" },
	"thesis": { file: "facts.md", label: "Facts" },
	"draft": { file: "thesis.md", label: "Thesis" },
	"publish-check": { file: "draft.md", label: "Draft" }
};

/** stage guard: the artifact that must be non-empty before a stage can be entered. */
export const STAGE_GUARD = {
	"facts": { file: "research.md", label: "Research" },
	"thesis": { file: "facts.md", label: "Facts" },
	"draft": { file: "thesis.md", label: "Thesis" },
	"canva": { file: "draft.md", label: "Draft" },
	"publish": { file: "draft.md", label: "Draft" }
};

/** User-facing action labels. */
export const ACTION_LABELS = {
	"research": "深度研究",
	"facts": "事实核查",
	"thesis": "生成观点",
	"draft": "写小红书",
	"publish-check": "发布检查"
};

/** Per-action agent task instructions. */
const TASKS = {
	"research": "深度调研核心问题。产出：关键事实与数据、信源清单（含可访问链接）、反方证据。把完整结果写入 projects/<slug>/research.md（覆盖旧内容，Markdown 格式）。",
	"facts": "把 research.md 整理成事实核查表：列 # / 事实 / 来源 / 信源级别 / 口径 / 状态，逐条核查并给出结论。写入 projects/<slug>/facts.md。",
	"thesis": "基于 facts.md 提炼核心观点：一句话主张 + 支撑证据（标注来源）+ 反方观点与回应。写入 projects/<slug>/thesis.md。",
	"draft": "按毛毛星语感把 thesis.md 写成可直接发布的小红书文字版：标题候选×3、正文 400–800 字、话题标签 5–8 个。写入 projects/<slug>/draft.md。",
	"publish-check": "对 draft.md 执行发布前检查：事实 / 标题 / 可读性 / 判断质量 / 空话 / 合规，逐项 PASS/FAIL 并给出修改建议。写入 projects/<slug>/publish.md。"
};

/** True when the artifact is empty or still the initial creation template. */
export function isBlankArtifact(content, file, project) {
	const text = (content ?? "").trim();
	if (text === "") return true;
	const template = templateFor(file, project).trim();
	return text === template;
}

/** Guard error: distinguishable so the UI can show the blocking reason. */
export class WorkflowError extends Error {
	code = "workflow-guard";
	constructor(message) {
		super(message);
		this.name = "WorkflowError";
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
		id: `maomao-creator-workbench#contentWorkflows/${method}`,
		service: "contentWorkflows",
		namespace: "contentWorkflows",
		method,
		invocation: { kind: "direct" },
		parameters,
		result: passthrough(resultType)
	};
}

/** Build one action prompt for the project's agent. */
export function buildPrompt(project, action) {
	const header = `[Workflow 动作] 对当前内容项目执行动作「${ACTION_LABELS[action] ?? action}」。项目：${project.title}（slug: ${project.slug}）。`;
	return `${header}\n${TASKS[action] ?? ""}`.replaceAll("<slug>", project.slug);
}

/** The workflow engine service. */
export class ContentWorkflowsService extends TypertRemoteService {
	contentProjects;
	agents;
	constructor(ctx) {
		super(ctx, "contentWorkflows");
		this.contentProjects = ctx.contentProjects;
		this.agents = ctx.agents;
		this.backgroundTasks = [];
		/** sessionId → project (sync prompt-section cache; warmed on boot/events). */
		this.projectCache = /* @__PURE__ */ new Map();
		ctx.effect(() => {
			this.refreshCache().catch(() => {
			});
			const timer = setInterval(() => {
				this.refreshCache().catch(() => {
				});
			}, 5000);
			timer.unref?.();
			return () => clearInterval(timer);
		}, "content-workflows: project cache warmer");
		ctx.effect(() => {
			const off = ctx.on("agent/status", () => {
				this.refreshCache().catch(() => {
				});
			});
			return off;
		}, "content-workflows: cache refresh on agent status");
	}

	/**
	* Remote run(projectId, action): orchestrate one workflow action.
	* Guards → record running → drive the project's agent → verify artifact →
	* record success/failed. Returns immediately; completion happens in the
	* background task (the client polls project.workflow).
	*/
	async run(slug, action) {
		if (!WORKFLOW_ACTIONS.includes(action)) throw new WorkflowError(`未知动作「${String(action)}」`);
		const { project, files } = await this.contentProjects.get(slug);
		const actionGuard = ACTION_GUARD[action];
		if (actionGuard !== void 0 && isBlankArtifact(files[actionGuard.file], actionGuard.file, project)) {
			throw new WorkflowError(`阶段校验失败：${actionGuard.label}（${actionGuard.file}）为空或仍为初始模板。请先完成前置动作，再执行「${ACTION_LABELS[action] ?? action}」。`);
		}
		const sessionId = typeof project.activeSessionId === "string" ? project.activeSessionId : "";
		if (sessionId === "") throw new WorkflowError("项目尚未绑定会话：请先在浏览器中打开该项目。");
		const agent = this.agents.get(sessionId);
		if (agent === void 0) throw new WorkflowError("项目会话的 Agent 不在运行中：请在浏览器中打开该项目所在会话。");
		if (agent.status !== "idle") throw new WorkflowError("Agent 正在处理其他任务，请稍后再试。");
		await this.contentProjects.setWorkflow(slug, action, { status: "running", sessionId });
		const prompt = buildPrompt(project, action);
		const background = this.runAgentTurn(agent, prompt, slug, action).catch((error) => {
			this.ctx.logger?.warn?.(`content-workflows: ${slug}/${action} failed: ${error instanceof Error ? error.message : String(error)}`);
		});
		this.backgroundTasks.push(background);
		return { ok: true, slug, action, sessionId };
	}

	/** Drive one agent turn and record the terminal workflow state. */
	async runAgentTurn(agent, prompt, slug, action) {
		try {
			agent.followup(createUserMessage({
				content: [{ type: "text", text: prompt }],
				source: { kind: "user" }
			}));
			await agent.whenIdle();
		} catch (error) {
			await this.contentProjects.setWorkflow(slug, action, {
				status: "failed",
				error: error instanceof Error ? error.message : String(error)
			});
			return;
		}
		const { project: after, files } = await this.contentProjects.get(slug);
		const artifact = ARTIFACT_OF[action];
		const ok = !isBlankArtifact(files[artifact], artifact, after);
		await this.contentProjects.setWorkflow(slug, action, ok
			? { status: "success" }
			: { status: "failed", error: `Agent 未产出 ${artifact}（文件为空或仍为初始模板）。` });
	}

	/**
	* Remote advanceStage(projectId, stage): guarded stage transition.
	* Blocks (with reason) when the target stage's prerequisite artifact is empty.
	*/
	async advanceStage(slug, stage) {
		if (typeof stage !== "string" || stage === "") throw new WorkflowError("未知阶段");
		const { project, files } = await this.contentProjects.get(slug);
		const guard = STAGE_GUARD[stage];
		if (guard !== void 0 && isBlankArtifact(files[guard.file], guard.file, project)) {
			throw new WorkflowError(`阶段校验失败：进入「${stage}」前需要 ${guard.label}（${guard.file}）有真实内容（当前为空或初始模板）。请先完成对应动作。`);
		}
		await this.contentProjects.updateStatus(slug, { stage });
		return { project: { ...project, stage } };
	}

	/** Compact project context for the prompt section; "" when the session is unbound. */
	projectContextSection(context) {
		const sessionId = context?.agent?.session?.id;
		if (typeof sessionId !== "string" || sessionId === "") return "";
		let project = this.projectCache.get(sessionId) ?? null;
		if (project === null) {
			// warm asynchronously; next assembly in this turn picks it up
			this.refreshCache().catch(() => {
			});
			return "";
		}
		const root = this.contentProjects.rootSync();
		if (root === void 0 || root === null) {
			this.refreshCache().catch(() => {
			});
			return "";
		}
		return [
			`[内容项目上下文] 当前 Agent 正在处理内容项目「${project.title}」。`,
			`- projectId: ${project.id} ｜ slug: ${project.slug} ｜ 系列: ${project.series}`,
			`- 状态: ${project.status} ｜ 当前阶段: ${project.stage} ｜ 最近动作: ${project.lastAction ?? "无"}`,
			`- 核心问题: ${project.coreQuestion || "—"}`,
			`- 核心矛盾: ${project.coreConflict || "—"}`,
			`- 切入角度: ${project.angle || "—"}`,
			`- 项目目录: ${root}/projects/${project.slug}/（project.json 为唯一状态源；brief/research/facts/thesis/draft/carousel/publish.md 为产物文件）`,
			"按需读取这些文件，不要一次性读入全部内容；执行动作后把结果写入对应产物文件。"
		].join("\n");
	}

	/** Rebuild the sessionId → project cache from the projects directory records. */
	async refreshCache() {
		const root = await this.contentProjects.resolveRoot();
		const projectsDir = join(root, "projects");
		let entries = [];
		try {
			entries = await readdir(projectsDir, { withFileTypes: true });
		} catch (error) {
			if (error.code === "ENOENT") {
				this.projectCache.clear();
				return;
			}
			throw error;
		}
		const next = /* @__PURE__ */ new Map();
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
			try {
				const raw = await readFile(join(projectsDir, entry.name, "project.json"), "utf8");
				const project = JSON.parse(raw);
				if (typeof project.activeSessionId === "string" && project.activeSessionId !== "") {
					next.set(project.activeSessionId, project);
				}
			} catch (error) {
				this.ctx.logger?.warn?.(`content-workflows: skip ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		this.projectCache = next;
	}

	/** Find the project whose activeSessionId equals the given session. */
	async findProjectBySession(sessionId) {
		const root = await this.contentProjects.resolveRoot();
		const projectsDir = join(root, "projects");
		let entries = [];
		try {
			entries = await readdir(projectsDir, { withFileTypes: true });
		} catch (error) {
			if (error.code === "ENOENT") return null;
			throw error;
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
			try {
				const raw = await readFile(join(projectsDir, entry.name, "project.json"), "utf8");
				const project = JSON.parse(raw);
				if (project.activeSessionId === sessionId) return project;
			} catch (error) {
				this.ctx.logger?.warn?.(`content-workflows: skip ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return null;
	}
}

/** The host Remote contribution (registered by the workbench assembler). */
export function buildWorkflowsContribution() {
	return {
		package: "maomao-creator-workbench.workflows",
		face: "host",
		model: void 0,
		schemas: [],
		invocations: [
			descriptor("run", [jsonParam("slug"), jsonParam("action")], "RunResult"),
			descriptor("advanceStage", [jsonParam("slug"), jsonParam("stage")], "ProjectResult")
		]
	};
}
