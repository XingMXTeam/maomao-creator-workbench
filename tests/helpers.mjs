/**
 * Shared test harness: fake Cordis ctx + temp workspace helpers.
 * Used by tests/unit and tests/integration — no Harness runtime required.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** Build a fake Cordis ctx with the services the workbench consumes. */
export function makeFakeCtx({ contentProjects, agents } = {}) {
	const services = new Map();
	const ctx = {
		contentProjects,
		agents,
		logger: { warn: () => {}, info: () => {} },
		get: (name) => services.get(name) ?? (name === "contentProjects" ? contentProjects : void 0),
		on: () => () => {},
		effect: (fn) => {
			const cleanup = fn();
			return () => (typeof cleanup === "function" ? cleanup() : void 0);
		},
		reflect: {
			provide: (name, value) => {
				services.set(name, value);
				return () => services.delete(name);
			}
		}
	};
	return ctx;
}

/** Temp workspace root with knowledge/index.json + projects/ + style-rules.json. */
export async function makeTempWorkspace({ knowledgeIndex, styleRules, withProjects = true } = {}) {
	const root = join(tmpdir(), `maomao-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
	await mkdir(join(root, "knowledge"), { recursive: true });
	await mkdir(join(root, "projects"), { recursive: true });
	if (knowledgeIndex !== void 0) {
		await writeFile(join(root, "knowledge", "index.json"), JSON.stringify(knowledgeIndex), "utf8");
	}
	if (styleRules !== void 0) {
		await writeFile(join(root, "style-rules.json"), JSON.stringify(styleRules), "utf8");
	}
	return root;
}

/** Fake project record + draft content, persisted under a temp workspace. */
export async function seedProject(root, { slug = "test-project", title = "测试项目", draft = "" } = {}) {
	const dir = join(root, "projects", slug);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "project.json"), JSON.stringify({
		id: `id-${slug}`,
		title,
		slug,
		series: "测试",
		status: "draft",
		stage: "draft",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		activeSessionId: "s1"
	}), "utf8");
	await writeFile(join(dir, "draft.md"), draft, "utf8");
	return dir;
}

/** Fake bound agent: followup records the prompt; whenIdle runs the work fn. */
export function makeFakeAgent(work) {
	const agent = {
		status: "idle",
		lastPrompt: "",
		followup(msg) {
			this.lastPrompt = typeof msg?.content?.[0]?.text === "string" ? msg.content[0].text : "";
		},
		whenIdle: async () => {
			if (work !== void 0) await work(agent);
		}
	};
	return agent;
}

export { rm, join };
