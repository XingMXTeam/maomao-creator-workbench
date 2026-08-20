#!/usr/bin/env node
/**
 * maomao-creator-workbench — install:local (aggregator install)
 *
 * Installs the workbench AND its two service-provider plugins into a DeepSeek
 * Harness profile WITHOUT touching any Harness installation file:
 *
 *   @maomao/content-projects     → service `contentProjects`   (Phase 2)
 *   @maomao/content-workflows    → service `contentWorkflows`  (Phase 3)
 *   maomao-creator-workbench     → service `contentIntelligence` + UI (Phase 4/5)
 *
 * Steps per package:
 *   1. copy the package into $DSH_HOME/profiles/node_modules/<name>
 *   2. idempotently ensure its plugin row in $DSH_HOME/profiles/<profile>/cordis.patch.yml
 *   3. optionally scaffold a workspace (only missing files; never overwrites)
 *
 * Usage:
 *   node scripts/install-local.mjs [--profile web] [--workspace <path>]
 *
 * Environment:
 *   DSH_HOME          harness home (default ~/.dsh)
 *   MAOMAO_WORKSPACE  workspace to scaffold (default: --workspace or cwd)
 */
import { cp, mkdir, readFile, writeFile, access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** (package name, source dir inside the repo, has workspace templates) */
const PACKAGES = [
	{ id: "content-projects", name: "@maomao/content-projects", src: "packages/content-projects", templates: false },
	{ id: "content-workflows", name: "@maomao/content-workflows", src: "packages/content-workflows", templates: false },
	{ id: "maomao-creator-workbench", name: "maomao-creator-workbench", src: ".", templates: true }
];

function parseArgs(argv) {
	const args = { profile: "web", workspace: null };
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === "--profile") args.profile = argv[i + 1];
		else if (argv[i] === "--workspace") args.workspace = argv[i + 1];
	}
	return args;
}

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/** Copy the runtime parts of one package into the flat module table. */
async function copyPackage(sourceDir, targetDir) {
	await mkdir(targetDir, { recursive: true });
	await cp(join(sourceDir, "package.json"), join(targetDir, "package.json"));
	await cp(join(sourceDir, "lib"), join(targetDir, "lib"), { recursive: true });
	for (const extra of ["profiles", "templates", "skills", "style-rules.json", "LICENSE", "README.md", "README.zh-CN.md"]) {
		const src = join(sourceDir, extra);
		if (await exists(src)) await cp(src, join(targetDir, extra), { recursive: true });
	}
}

/** Idempotently ensure the plugin row exists in the profile patch. */
async function ensureRow(patchPath, pkg) {
	const packageName = pkg.name;
	let patch = "";
	if (await exists(patchPath)) patch = await readFile(patchPath, "utf8");
	// Active row check only — commented-out rows must be re-added.
	const activeRow = new RegExp(`^\\s*-\\s+id: ${pkg.id}\\s*$`, "m");
	if (activeRow.test(patch) && patch.includes(`name: '${pkg.name}'`)) {
		console.log(`✓ plugin row already present: ${pkg.name} (idempotent)`);
		return;
	}
	// Strip any stale row/comment for this package before appending fresh.
	patch = patch.split("\n").filter((line) => !line.includes(pkg.name) && !line.trim().endsWith(`- id: ${pkg.id}`)).join("\n");
	const row = `- insert:\n    - id: ${pkg.id}\n      name: '${pkg.name}'\n`;
	const trimmed = patch.trim();
	if (trimmed === "" || trimmed === "[]") {
		await writeFile(patchPath, row, "utf8");
	} else {
		await writeFile(patchPath, `${patch.trimEnd()}\n\n${row}`, "utf8");
	}
	console.log(`✓ plugin row added: ${packageName} → ${patchPath}`);
}

/** Marker + block for the lifecycle-managed ui-sidebar disable. */
const UI_SIDEBAR_DISABLE_MARK = "# maomao-creator-workbench: ui-sidebar disabled (lifecycle-managed)";
const UI_SIDEBAR_DISABLE_BLOCK = `${UI_SIDEBAR_DISABLE_MARK}\n- id: ui-sidebar\n  disabled: true`;

/** Idempotently ensure the ui-sidebar disable block sits at the patch top. */
async function ensureUiSidebarDisabled(patchPath) {
	let patch = "";
	if (await exists(patchPath)) patch = await readFile(patchPath, "utf8");
	if (patch.includes(UI_SIDEBAR_DISABLE_MARK)) return;
	const block = `${UI_SIDEBAR_DISABLE_BLOCK}\n`;
	const trimmed = patch.trim();
	if (trimmed === "" || trimmed === "[]") {
		await writeFile(patchPath, block, "utf8");
	} else {
		await writeFile(patchPath, `${block}${patch.trimStart()}`, "utf8");
	}
	console.log("✓ ui-sidebar disabled (tabbed sidebar owns the left column)");
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
	const profileDir = join(dshHome, "profiles", args.profile);
	const flatModules = join(dshHome, "profiles", "node_modules");
	const patchPath = join(profileDir, "cordis.patch.yml");
	const workspace = resolve(args.workspace || process.env.MAOMAO_WORKSPACE || process.cwd());

	console.log(`maomao-creator-workbench install:local (aggregator)`);
	console.log(`  DSH_HOME:  ${dshHome}`);
	console.log(`  profile:   ${args.profile}`);
	console.log(`  workspace: ${workspace}`);

	if (!(await exists(profileDir))) {
		console.log(`· profile directory missing — bootstrapping a stock profile at ${profileDir}`);
		await mkdir(profileDir, { recursive: true });
		await writeFile(join(profileDir, "package.json"), JSON.stringify({
			name: `dsh-profile-${args.profile}`,
			private: true,
			dependencies: {},
			dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } }
		}, null, 2), "utf8");
		await writeFile(join(profileDir, "pnpm-workspace.yaml"), "packages:\n  - .\n", "utf8");
		await writeFile(join(profileDir, "cordis.patch.yml"), "[]\n", "utf8");
	}

	await mkdir(flatModules, { recursive: true });

	// 1) Copy every package into the flat module table.
	for (const pkg of PACKAGES) {
		const scoped = pkg.name.startsWith("@");
		const targetDir = scoped ? join(flatModules, pkg.name.split("/")[0], pkg.name.split("/")[1]) : join(flatModules, pkg.name);
		await copyPackage(join(ROOT, pkg.src), targetDir);
		console.log(`✓ package copied → ${targetDir}`);
	}

	// 2) Ensure the plugin rows (aggregation: 3 providers, no duplicates).
	for (const pkg of PACKAGES) {
		await ensureRow(patchPath, pkg);
	}

	// 2b) Tabbed sidebar owns the left column (lifecycle-managed disable).
	await ensureUiSidebarDisabled(patchPath);

	// 3) Scaffold the workspace from the workbench templates (missing files only).
	const templates = join(ROOT, "templates", "workspace");
	const scaffolded = [];
	if (await exists(templates)) {
		for (const entry of await readdir(templates, { withFileTypes: true })) {
			const dest = join(workspace, entry.name);
			if (!(await exists(dest))) {
				await cp(join(templates, entry.name), dest, { recursive: true });
				scaffolded.push(entry.name);
			}
		}
	}
	if (scaffolded.length > 0) {
		console.log(`✓ workspace scaffolded (new files only): ${scaffolded.join(", ")}`);
	} else {
		console.log(`✓ workspace already populated (nothing overwritten): ${workspace}`);
	}

	console.log("");
	console.log("下一步（Next steps）:");
	console.log("  1. 重启 Harness：退出当前 `npx @deepseek-ai/dsh web`，再重新运行。");
	console.log("  2. 三个插件将同时加载：content-projects / content-workflows / maomao-creator-workbench。");
	console.log("  3. 侧边栏底部「内容项目」打开工作台；设置 → 毛毛星内容工作台 查看环境状态。");
	console.log("  4. 卸载：npm run uninstall:local（不会删除你的 projects/ 与 knowledge/）。");
}

main().catch((error) => {
	console.error("install:local failed:", error instanceof Error ? error.message : error);
	process.exit(1);
});
