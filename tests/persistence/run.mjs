/**
 * Persistence test — projects and artifacts survive a "restart":
 * write a project through one service instance, then construct a fresh
 * service instance (simulating a cold boot) and read everything back from
 * disk — the single source of truth is projects/<slug>/ on disk.
 * Run: node tests/persistence/run.mjs
 */
import assert from "node:assert/strict";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ContentProjectsService } from "@maomao/content-projects";
import { makeFakeCtx, makeTempWorkspace, rm } from "../helpers.mjs";

const INDEX = JSON.parse(await readFile("profiles/maomao/knowledge/index.json", "utf8"));
let passed = 0;
function ok(name, cond, extra = "") {
	if (!cond) throw new Error(`FAIL: ${name} ${extra}`);
	passed += 1;
	console.log(`✓ ${name}`);
}

const root = await makeTempWorkspace({ knowledgeIndex: INDEX });

// "session 1" — create + write artifacts
{
	const projects = new ContentProjectsService(makeFakeCtx(), { root });
	const { project } = await projects.create({ title: "持久化测试", series: "测试" });
	await writeFile(join(root, "projects", project.slug, "draft.md"), "# Draft — 持久化内容\n", "utf8");
	await projects.writeFile(project.slug, "thesis.md", "# Thesis — 判断\n");
}

// "restart" — brand-new service instance reads the same disk state
{
	const projects = new ContentProjectsService(makeFakeCtx(), { root });
	const list = await projects.list();
	ok("persistence: project listed after restart", list.projects.length === 1);
	const detail = await projects.get(list.projects[0].slug);
	ok("persistence: draft.md survives", detail.files["draft.md"].includes("持久化内容"));
	ok("persistence: thesis.md survives", detail.files["thesis.md"].includes("判断"));
	ok("persistence: updatedAt bumped by writeFile", Date.parse(detail.project.updatedAt) > Date.parse(detail.project.createdAt));
	const raw = JSON.parse(await readFile(join(root, "projects", list.projects[0].slug, "project.json"), "utf8"));
	ok("persistence: project.json is valid JSON state", typeof raw.id === "string" && raw.slug === list.projects[0].slug);
}

await rm(root, { recursive: true, force: true });
console.log(`\nPersistence: ${passed} passed.`);
