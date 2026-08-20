import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 毛毛星 Creator — ContentProject host service (Phase 2).
 *
 * `projects/<slug>/` is the single source of truth: `project.json` holds the
 * canonical record (id/title/slug/series/status/stage/timestamps/coreQuestion/
 * coreConflict/angle), and the seven markdown files are the stage artifacts.
 *
 * The projects root resolves in order: config.root override → the first live
 * session's header.cwd → process.cwd().
 */

/** The seven markdown artifacts of one project (plus project.json). */
export const PROJECT_FILE_NAMES = [
	"brief.md",
	"research.md",
	"facts.md",
	"thesis.md",
	"draft.md",
	"carousel.md",
	"publish.md"
];

/** Files the readFile Remote accepts. */
export const PROJECT_READABLE_NAMES = [...PROJECT_FILE_NAMES, "project.json"];

/** Valid status values. */
export const PROJECT_STATUSES = ["idea", "researching", "draft", "ready", "published", "archived"];

/** Valid stage values. */
export const PROJECT_STAGES = ["topic", "question", "conflict", "research", "facts", "thesis", "draft", "canva", "publish"];

/** Workflow actions recorded in project.json (state only, never content). */
export const WORKFLOW_ACTIONS = ["research", "facts", "thesis", "draft", "publish-check"];

/** Slug segment guard: letters, digits, dots, dashes, underscores only. */
const SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Serialize one project record to disk (two-space JSON + trailing newline). */
function serializeProject(project) {
	return `${JSON.stringify(project, null, 2)}\n`;
}

/** Initial markdown template per artifact file. */
function fileTemplate(name, project) {
	const headers = {
		"brief.md": `# ${project.title}\n\n> 系列：${project.series} ｜ 状态：${project.status} ｜ 阶段：${project.stage}\n\n## 选题来源\n\n## 目标读者\n\n## 切入角度\n\n## 一句话目标\n\n`,
		"research.md": `# Research — ${project.title}\n\n## 调研笔记\n\n## 信源清单\n\n## 关键数据\n\n## 反方证据\n\n`,
		"facts.md": `# Facts — ${project.title}\n\n| # | 事实 | 来源 | 信源级别 | 口径 | 状态 |\n|---|---|---|---|---|---|\n\n`,
		"thesis.md": `# Thesis — ${project.title}\n\n## 一句话主张\n\n## 支撑证据\n\n## 反方观点与回应\n\n`,
		"draft.md": `# Draft — ${project.title}\n\n## 标题候选\n\n1.\n\n## 正文\n\n## 话题标签\n\n`,
		"carousel.md": `# Canva — ${project.title}\n\n## 封面页\n\n## 内容页\n\n## 结尾页\n\n`,
		"publish.md": `# Publish — ${project.title}\n\n## 标题\n\n## 话题标签\n\n## 封面文案\n\n## 发布时段\n\n`
	};
	return headers[name] ?? "";
}

export { fileTemplate as templateFor };

/** Build a safe unique slug: YYYY-MM-DD-<slugified title>[-N]. */
async function uniqueSlug(projectsDir, datePart, slugBase) {
	const target = `${datePart}-${slugBase}`;
	let candidate = target;
	let counter = 2;
	for (;;) {
		try {
			await stat(join(projectsDir, candidate));
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
			return candidate;
		}
		candidate = `${target}-${String(counter)}`;
		counter += 1;
	}
}

/** Guard a slug before any path join. */
function assertSlug(slug) {
	if (typeof slug !== "string" || slug === "" || !SLUG_PATTERN.test(slug)) {
		throw new Error(`content-projects: invalid slug "${String(slug)}"`);
	}
}

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
		codec: passthrough(`@maomao/content-projects#${name}`)
	};
}

/** One direct Remote invocation descriptor. */
function descriptor(method, parameters, resultType) {
	return {
		id: `@maomao/content-projects#contentProjects/${method}`,
		service: "contentProjects",
		namespace: "contentProjects",
		method,
		invocation: { kind: "direct" },
		parameters,
		result: passthrough(resultType)
	};
}

/** The host service: every method is a Remote endpoint (see apply). */
export class ContentProjectsService extends TypertRemoteService {
	rootOverride;
	rootCache = null;

	constructor(ctx, config = {}) {
		super(ctx, "contentProjects");
		this.rootOverride = typeof config.root === "string" && config.root !== "" ? config.root : void 0;
	}

	/** Synchronous root accessor for sync consumers (prompt sections); undefined before the first resolve. */
	rootSync() {
		if (this.rootOverride !== void 0) return this.rootOverride;
		return this.rootCache;
	}

	/** Resolve the workspace/projects parent root (cached). */
	async resolveRoot() {
		if (this.rootOverride !== void 0) return this.rootOverride;
		if (this.rootCache !== null) return this.rootCache;
		const sessions = this.ctx.get("sessions");
		let cwd;
		if (sessions !== void 0 && typeof sessions.list === "function") {
			for (const session of sessions.list()) {
				const header = session?.header;
				if (header !== void 0 && typeof header.cwd === "string" && header.cwd.length > 0) {
					cwd = header.cwd;
					break;
				}
			}
		}
		const root = cwd ?? process.cwd();
		this.rootCache = root;
		return root;
	}

	/** Absolute projects directory for the resolved root. */
	async projectsDir() {
		return join(await this.resolveRoot(), "projects");
	}

	/** Read one project.json into a record (slug backfilled from the folder). */
	async readProject(slug) {
		assertSlug(slug);
		const raw = await readFile(join(await this.projectsDir(), slug, "project.json"), "utf8");
		const project = JSON.parse(raw);
		if (typeof project.slug !== "string" || project.slug === "") project.slug = slug;
		return project;
	}

	/** Persist one project record. */
	async writeProject(project) {
		assertSlug(project.slug);
		await writeFile(join(await this.projectsDir(), project.slug, "project.json"), serializeProject(project), "utf8");
	}

	/** Remote list(): every project, newest first. */
	async list() {
		const projectsDir = await this.projectsDir();
		let entries = [];
		try {
			entries = await readdir(projectsDir, { withFileTypes: true });
		} catch (error) {
			if (error.code === "ENOENT") return { projects: [] };
			throw error;
		}
		const projects = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const slug = entry.name;
			if (slug.startsWith(".")) continue;
			try {
				projects.push(await this.readProject(slug));
			} catch (error) {
				this.ctx.logger?.warn?.(`content-projects: skipping ${slug}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		projects.sort((a, b) => {
			const byTime = Date.parse(b.createdAt) - Date.parse(a.createdAt);
			if (byTime !== 0) return byTime;
			return a.slug < b.slug ? 1 : -1;
		});
		return { projects };
	}

	/** Remote get(): project record + every artifact file's content. */
	async get(slug) {
		assertSlug(slug);
		const projectsDir = await this.projectsDir();
		const project = await this.readProject(slug);
		const files = {};
		for (const name of PROJECT_FILE_NAMES) {
			try {
				files[name] = await readFile(join(projectsDir, slug, name), "utf8");
			} catch (error) {
				if (error.code === "ENOENT") files[name] = "";
				else throw error;
			}
		}
		return { project, files };
	}

	/** Remote create(): make projects/<slug>/ + project.json + the seven files. */
	async create(input) {
		const title = String(input?.title ?? "").trim();
		if (title === "") throw new Error("content-projects: create requires a title");
		const series = String(input?.series ?? "").trim() || "未分类";
		const coreQuestion = String(input?.coreQuestion ?? "").trim();
		const coreConflict = String(input?.coreConflict ?? "").trim();
		const angle = String(input?.angle ?? "").trim();
		const now = new Date();
		const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		const slugBase = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40) || "project";
		const projectsDir = await this.projectsDir();
		await mkdir(projectsDir, { recursive: true });
		const slug = await uniqueSlug(projectsDir, datePart, slugBase);
		const dir = join(projectsDir, slug);
		await mkdir(dir, { recursive: false });
		const project = {
			id: randomUUID(),
			title,
			slug,
			series,
			status: "idea",
			stage: "topic",
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
			coreQuestion,
			coreConflict,
			angle
		};
		await writeFile(join(dir, "project.json"), serializeProject(project), "utf8");
		for (const name of PROJECT_FILE_NAMES) {
			await writeFile(join(dir, name), fileTemplate(name, project), "utf8");
		}
		return { project };
	}

	/** Remote updateStatus(): persist status/stage transitions to project.json. */
	async updateStatus(slug, patch) {
		assertSlug(slug);
		const project = await this.readProject(slug);
		let changed = false;
		if (patch?.status !== void 0 && PROJECT_STATUSES.includes(patch.status) && patch.status !== project.status) {
			project.status = patch.status;
			changed = true;
		}
		if (patch?.stage !== void 0 && PROJECT_STAGES.includes(patch.stage) && patch.stage !== project.stage) {
			project.stage = patch.stage;
			changed = true;
		}
		if (changed) {
			project.updatedAt = new Date().toISOString();
			await this.writeProject(project);
		}
		return { project };
	}

	/** Remote readFile(): one artifact's content. */
	async readFile(slug, name) {
		assertSlug(slug);
		if (!PROJECT_READABLE_NAMES.includes(name)) throw new Error(`content-projects: unknown file "${String(name)}"`);
		const content = await readFile(join(await this.projectsDir(), slug, name), "utf8");
		return { name, content };
	}

	/** Remote writeFile(): persist one artifact (project.json untouched except updatedAt). */
	async writeFile(slug, name, content) {
		assertSlug(slug);
		if (!PROJECT_FILE_NAMES.includes(name)) throw new Error(`content-projects: unknown file "${String(name)}"`);
		const project = await this.readProject(slug);
		await writeFile(join(await this.projectsDir(), slug, name), String(content), "utf8");
		project.updatedAt = new Date().toISOString();
		await this.writeProject(project);
		return { ok: true };
	}

	/** Remote bindSession(): persist the project's primary session (1 project → 1 session). */
	async bindSession(slug, sessionId) {
		assertSlug(slug);
		if (typeof sessionId !== "string" || sessionId === "") throw new Error("content-projects: bindSession requires a sessionId");
		const project = await this.readProject(slug);
		const changed = project.activeSessionId !== sessionId || project.lastSessionId !== sessionId;
		project.activeSessionId = sessionId;
		project.lastSessionId = sessionId;
		if (changed) {
			project.updatedAt = new Date().toISOString();
			await this.writeProject(project);
		}
		return { project };
	}

	/** Remote setWorkflow(): persist one workflow action record (state only, never content). */
	async setWorkflow(slug, action, record) {
		assertSlug(slug);
		if (!WORKFLOW_ACTIONS.includes(action)) throw new Error(`content-projects: unknown workflow action "${String(action)}"`);
		const status = record?.status;
		if (typeof status !== "string" || !["idle", "running", "success", "failed"].includes(status)) {
			throw new Error(`content-projects: invalid workflow status "${String(status)}"`);
		}
		const project = await this.readProject(slug);
		const workflow = { ...(project.workflow ?? {}) };
		const previous = workflow[action] ?? {};
		workflow[action] = {
			status,
			startedAt: status === "running" ? new Date().toISOString() : typeof previous.startedAt === "string" ? previous.startedAt : null,
			completedAt: status === "running" ? null : new Date().toISOString(),
			error: typeof record.error === "string" && record.error !== "" ? record.error : null
		};
		project.workflow = workflow;
		project.updatedAt = new Date().toISOString();
		if (status === "running") {
			project.lastAction = action;
			if (typeof record.sessionId === "string" && record.sessionId !== "") project.lastSessionId = record.sessionId;
		}
		await this.writeProject(project);
		return { project };
	}
}

/** The host Remote contribution (registered in apply; exported for tests). */
export function buildContribution() {
	return {
		package: "@maomao/content-projects",
		face: "host",
		model: void 0,
		schemas: [],
		invocations: [
			descriptor("list", [], "ProjectListResult"),
			descriptor("get", [jsonParam("slug")], "ProjectDetailResult"),
			descriptor("create", [jsonParam("input")], "ProjectResult"),
			descriptor("updateStatus", [jsonParam("slug"), jsonParam("patch")], "ProjectResult"),
			descriptor("readFile", [jsonParam("slug"), jsonParam("name")], "ProjectFileResult"),
			descriptor("writeFile", [jsonParam("slug"), jsonParam("name"), jsonParam("content")], "WriteResult"),
			descriptor("bindSession", [jsonParam("slug"), jsonParam("sessionId")], "ProjectResult"),
			descriptor("setWorkflow", [jsonParam("slug"), jsonParam("action"), jsonParam("record")], "ProjectResult")
		]
	};
}

/** Loader plugin: provide the service and register its Remote endpoints. */
export const name = "content-projects";
export const inject = ["typert"];

export function apply(ctx, config) {
	const service = new ContentProjectsService(ctx, config);
	ctx.effect(() => {
		return ctx.typert.register(buildContribution());
	}, "content-projects: typert contribution");
}

