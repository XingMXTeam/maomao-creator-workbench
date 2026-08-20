/**
 * Integration test — full pipeline on a temp workspace:
 *   create → research → facts → thesis → draft → critic
 * The fake bound agent performs each action by writing the artifact file
 * (exactly what the real agent does when driven by ContentWorkflows.run /
 * ContentIntelligence.critic).
 * Run: node tests/integration/run.mjs
 */
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ContentProjectsService } from "@maomao/content-projects";
import { ContentWorkflowsService } from "@maomao/content-workflows";
import { ContentIntelligenceService } from "../../lib/host/intelligence.js";
import { makeFakeCtx, makeTempWorkspace, makeFakeAgent, rm } from "../helpers.mjs";

const INDEX = JSON.parse(await readFile("profiles/maomao/knowledge/index.json", "utf8"));
let passed = 0;
function ok(name, cond, extra = "") {
	if (!cond) throw new Error(`FAIL: ${name} ${extra}`);
	passed += 1;
	console.log(`✓ ${name}`);
}

const root = await makeTempWorkspace({ knowledgeIndex: INDEX });
const projects = new ContentProjectsService(makeFakeCtx(), { root });

/** Agent whose whenIdle writes the given artifact for the current action. */
function stageAgent(artifact, content) {
	return makeFakeAgent(async (agent) => {
		const slug = /slug: ([a-z0-9.-]+)/.exec(agent.lastPrompt)?.[1] ?? "test-project";
		await writeFile(join(root, "projects", slug, artifact), content, "utf8");
	});
}

const ctx = makeFakeCtx({ contentProjects: projects, agents: { get: () => stageAgent("research.md", "# Research\n\n## 调研笔记\n数据……\n## 信源清单\n- [来源A](https://example.com)\n") } });
const workflows = new ContentWorkflowsService(ctx);
const ci = new ContentIntelligenceService(ctx, {});

// create
const { project } = await projects.create({ title: "为什么 AI Coding Agent 越来越流行", series: "AI/技术", coreQuestion: "Q", coreConflict: "C", angle: "A" });
const slug = project.slug;
await projects.bindSession(slug, "s1");
ok("create project", slug.length > 0);

// research
await workflows.run(slug, "research");
await Promise.all(workflows.backgroundTasks);
let file = await readFile(join(root, "projects", slug, "research.md"), "utf8");
ok("research artifact written", file.includes("调研笔记"));

// facts (agent writes facts.md)
ctx.agents.get = () => stageAgent("facts.md", "# Facts\n\n| # | 事实 | 来源 | 级别 | 口径 | 状态 |\n|---|---|---|---|---|---|\n| 1 | X | S | 已核 |\n");
await workflows.run(slug, "facts");
await Promise.all(workflows.backgroundTasks);
file = await readFile(join(root, "projects", slug, "facts.md"), "utf8");
ok("facts artifact written", file.includes("事实"));

// thesis
ctx.agents.get = () => stageAgent("thesis.md", "# Thesis\n\n## 一句话主张\n\n可被反驳的判断。\n");
await workflows.run(slug, "thesis");
await Promise.all(workflows.backgroundTasks);
file = await readFile(join(root, "projects", slug, "thesis.md"), "utf8");
ok("thesis artifact written", file.includes("一句话主张"));

// draft
ctx.agents.get = () => stageAgent("draft.md", "# Draft\n\n## 正文\n\n草稿正文内容……\n");
await workflows.run(slug, "draft");
await Promise.all(workflows.backgroundTasks);
file = await readFile(join(root, "projects", slug, "draft.md"), "utf8");
ok("draft artifact written", file.includes("正文"));

// critic (agent writes critique.md)
const critiqueContent = [
	"# Critique",
	"- [FAIL] 事实可靠性 — 数字无来源",
	"- [WARN] 风格检查 — 标题平淡",
	"```json",
	'{ "score": 71, "issues": ["[事实] 数字无来源", "[风格] 标题平淡"], "suggestions": ["补来源", "改标题"] }',
	"```"
].join("\n");
const criticAgent = stageAgent("critique.md", critiqueContent);
ctx.agents.get = () => criticAgent;
const run = await ci.critic(slug);
ok("critic started", run.ok === true);
ok("critic prompt loads knowledge for action=critic", criticAgent.lastPrompt.includes("quality-standard.md"));
await Promise.all(ci.backgroundTasks);
ok("critic finished success", ci.runs.get(slug)?.status === "success");
const result = await ci.critique(slug);
ok("critique score parsed", result.critique.score === 71);
ok("critique issues/suggestions parsed", result.critique.issues.length === 2 && result.critique.suggestions.length === 2);

// stage advance guard
const advanced = await workflows.advanceStage(slug, "canva");
ok("advanceStage canva after draft", advanced.project.stage === "canva");

// workflow state recorded in project.json (state only)
const after = await projects.readProject(slug);
ok("workflow records present", ["research", "facts", "thesis", "draft"].every((a) => after.workflow?.[a]?.status === "success"));

// full artifact set
const detail = await projects.get(slug);
ok("artifacts: research/facts/thesis/draft present", ["research.md", "facts.md", "thesis.md", "draft.md"].every((name) => detail.files[name].length > 0));

await rm(root, { recursive: true, force: true });
console.log(`\nIntegration: ${passed} passed.`);
