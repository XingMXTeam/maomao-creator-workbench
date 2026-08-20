/**
 * Unit tests — ContentProject / Workflow Guard / Style Engine / Critic.
 * Run: node tests/unit/run.mjs  (or npm run test:unit)
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	ContentProjectsService,
	templateFor,
	PROJECT_FILE_NAMES
} from "@maomao/content-projects";
import {
	ContentWorkflowsService,
	ACTION_GUARD,
	isBlankArtifact,
	WorkflowError
} from "@maomao/content-workflows";
import {
	ContentIntelligenceService,
	resolveKnowledgePlan,
	parseCritique,
	buildCriticPrompt,
	CriticError,
	STYLE_RULES_PSEUDO_PATH,
	CRITIC_ACTION
} from "../../lib/host/intelligence.js";
import { makeFakeCtx, makeTempWorkspace, seedProject, makeFakeAgent, rm } from "../helpers.mjs";

const INDEX = JSON.parse(await readFile("profiles/maomao/knowledge/index.json", "utf8"));
let passed = 0;
function ok(name, cond, extra = "") {
	if (!cond) throw new Error(`FAIL: ${name} ${extra}`);
	passed += 1;
	console.log(`✓ ${name}`);
}

// ── 1. Style Engine: rules load with workspace override ────────────────────
{
	const root = await makeTempWorkspace({
		knowledgeIndex: INDEX,
		styleRules: { version: 9, name: "override", ruleGroups: [] }
	});
	const ctx = makeFakeCtx({
		contentProjects: { resolveRoot: async () => root }
	});
	const ci = new ContentIntelligenceService(ctx, {});
	const rules = await ci.styleRules();
	ok("style rules: workspace override wins", rules.rules.version === 9, JSON.stringify(rules.rules));
	ok("style rules: path points at workspace", rules.path.startsWith(root));
	await rm(root, { recursive: true, force: true });
}

// ── 2. Style Engine: package fallback when workspace has no style-rules.json ──
{
	const root = await makeTempWorkspace({ knowledgeIndex: INDEX });
	const ctx = makeFakeCtx({ contentProjects: { resolveRoot: async () => root } });
	const ci = new ContentIntelligenceService(ctx, {});
	const rules = await ci.styleRules();
	ok("style rules: package fallback (maomao profile default)", rules.rules.version === 1);
	ok("style rules: five rule groups", rules.rules.ruleGroups?.length === 5);
	await rm(root, { recursive: true, force: true });
}

// ── 3. KnowledgePlan resolution (loadGroups + triggers) ────────────────────
{
	const draft = resolveKnowledgePlan(INDEX, "draft");
	ok("knowledgePlan: draft group hit", draft.mode === "group" && draft.files.includes("writing/title-rules.md"));
	const critic = resolveKnowledgePlan(INDEX, CRITIC_ACTION);
	ok("knowledgePlan: critic includes style-rules", critic.files.includes(STYLE_RULES_PSEUDO_PATH));
	ok("knowledgePlan: critic includes quality-standard", critic.files.includes("content-system/quality-standard.md"));
	const company = resolveKnowledgePlan(INDEX, "写公司研究");
	ok("knowledgePlan: 写公司研究 alias", company.files.includes("investment/company-analysis.md") && company.files.includes("writing/structure-rules.md"));
	const biz = resolveKnowledgePlan(INDEX, "写普通商业观察");
	ok("knowledgePlan: 写普通商业观察 alias", biz.files.includes("brand/tone.md") && biz.files.includes("writing/title-rules.md"));
}

// ── 4. parseCritique ───────────────────────────────────────────────────────
{
	const parsed = parseCritique([
		"# Critique",
		"- [FAIL] 事实可靠性 — 无来源",
		"```json",
		'{ "score": 68, "issues": ["[风格] 标题平淡"], "suggestions": ["改标题"] }',
		"```"
	].join("\n"));
	ok("parseCritique: score/issues/suggestions", parsed.score === 68 && parsed.issues.length === 1 && parsed.suggestions.length === 1);
	ok("parseCritique: fallback score", parseCritique("score: 55").score === 55);
	ok("parseCritique: empty", parseCritique("   ").score === null);
}

// ── 5. buildCriticPrompt ───────────────────────────────────────────────────
{
	const prompt = buildCriticPrompt({ title: "T", slug: "s" }, { files: [{ rel: "x.md", abs: "/x.md" }] }, "/rules.json");
	ok("critic prompt: review role + no-rewrite discipline", prompt.includes("内容质量审查") && prompt.includes("不要修改或重写 draft.md"));
	ok("critic prompt: five dimensions", ["事实可靠性", "观点质量", "用户价值", "风格检查", "投资内容检查"].every((d) => prompt.includes(d)));
	ok("critic prompt: JSON contract", prompt.includes('"issues"'));
}

// ── 6. ContentProjects: template + blank detection ─────────────────────────
{
	const project = { title: "P", slug: "p", series: "S" };
	const template = templateFor("draft.md", project);
	ok("projects: draft template present", template.includes("# Draft"));
	ok("workflows: blank artifact detection", isBlankArtifact(template, "draft.md", project) === true);
	ok("workflows: real content not blank", isBlankArtifact("# real", "draft.md", project) === false);
	ok("workflows: ACTION_GUARD draft→thesis", ACTION_GUARD.draft.file === "thesis.md");
}

// ── 7. Workflow guard: run draft with blank thesis → WorkflowError ─────────
{
	const root = await makeTempWorkspace({ knowledgeIndex: INDEX });
	await seedProject(root, { draft: "# Draft — 正文" });
	const projects = new ContentProjectsService(makeFakeCtx(), { root });
	const ctx = makeFakeCtx({
		contentProjects: projects,
		agents: { get: () => makeFakeAgent() }
	});
	const workflows = new ContentWorkflowsService(ctx);
	await assert.rejects(
		() => workflows.run("test-project", "draft"),
		(error) => error instanceof WorkflowError && error.message.includes("Thesis")
	);
	ok("workflow guard: blank prerequisite blocks with WorkflowError", true);
	await rm(root, { recursive: true, force: true });
}

// ── 8. Critic guard: blank draft → CriticError ─────────────────────────────
{
	const root = await makeTempWorkspace({ knowledgeIndex: INDEX });
	await seedProject(root, { draft: "" });
	const projects = new ContentProjectsService(makeFakeCtx(), { root });
	const ctx = makeFakeCtx({
		contentProjects: projects,
		agents: { get: () => makeFakeAgent() }
	});
	const ci = new ContentIntelligenceService(ctx, {});
	await assert.rejects(
		() => ci.critic("test-project"),
		(error) => error instanceof CriticError && error.message.includes("draft.md")
	);
	ok("critic guard: blank draft blocked", true);
	await rm(root, { recursive: true, force: true });
}

// ── 9. Critic happy path (fake agent writes critique.md) ───────────────────
{
	const root = await makeTempWorkspace({ knowledgeIndex: INDEX });
	const dir = await seedProject(root, { draft: "# Draft — 正文" });
	const projects = new ContentProjectsService(makeFakeCtx(), { root });
	const agent = makeFakeAgent(async () => {
		await writeFile(join(dir, "critique.md"), [
			"# Critique",
			"```json",
			'{ "score": 70, "issues": ["[观点] 空结论"], "suggestions": ["改"] }',
			"```"
		].join("\n"), "utf8");
	});
	const ctx = makeFakeCtx({ contentProjects: projects, agents: { get: () => agent } });
	const ci = new ContentIntelligenceService(ctx, {});
	const run = await ci.critic("test-project");
	ok("critic run started", run.ok === true);
	ok("critic prompt delivered to agent", agent.lastPrompt.includes("Critic 动作") && agent.lastPrompt.includes("quality-standard.md"));
	await Promise.all(ci.backgroundTasks);
	ok("critic run success", ci.runs.get("test-project")?.status === "success");
	const result = await ci.critique("test-project");
	ok("critique parsed", result.critique.score === 70);
	await rm(root, { recursive: true, force: true });
}

// ── 10. Projects service: create → list → read round-trip ──────────────────
{
	const root = await makeTempWorkspace({ knowledgeIndex: INDEX });
	const projects = new ContentProjectsService(makeFakeCtx(), { root });
	const { project } = await projects.create({ title: "为什么 AI Coding Agent 越来越流行", series: "AI/技术", coreQuestion: "Q", coreConflict: "C", angle: "A" });
	ok("projects: create slug prefixed with date", /^\d{4}-\d{2}-\d{2}-/.test(project.slug));
	const { projects: list } = await projects.list();
	ok("projects: list returns created", list.length === 1 && list[0].slug === project.slug);
	const detail = await projects.get(project.slug);
	ok("projects: 8 artifact files", PROJECT_FILE_NAMES.length === 7 && typeof detail.files["draft.md"] === "string");
	await rm(root, { recursive: true, force: true });
}

console.log(`\nUnit: ${passed} passed.`);
