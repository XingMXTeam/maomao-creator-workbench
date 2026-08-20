#!/usr/bin/env node
/**
 * maomao-creator-workbench — install:local
 *
 * Installs the workbench into a DeepSeek Harness profile WITHOUT touching any
 * Harness installation file:
 *   1. copies this package into $DSH_HOME/profiles/node_modules/maomao-creator-workbench
 *   2. idempotently inserts one plugin row into $DSH_HOME/profiles/<profile>/cordis.patch.yml
 *   3. optionally scaffolds a workspace (only missing files; never overwrites)
 *
 * Usage:
 *   node scripts/install-local.mjs [--profile web] [--workspace <path>]
 *
 * Environment:
 *   DSH_HOME        harness home (default ~/.dsh)
 *   MAOMAO_WORKSPACE workspace to scaffold (default: --workspace or cwd)
 */
import { cp, mkdir, readFile, writeFile, access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PACKAGE_NAME = "maomao-creator-workbench";

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

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
	const profileDir = join(dshHome, "profiles", args.profile);
	const flatModules = join(dshHome, "profiles", "node_modules");
	const targetDir = join(flatModules, PACKAGE_NAME);
	const patchPath = join(profileDir, "cordis.patch.yml");
	const workspace = resolve(args.workspace || process.env.MAOMAO_WORKSPACE || process.cwd());

	console.log(`maomao-creator-workbench install:local`);
	console.log(`  repo:      ${ROOT}`);
	console.log(`  DSH_HOME:  ${dshHome}`);
	console.log(`  profile:   ${args.profile} (${profileDir})`);
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

	// 1) Copy the package into the flat module dir.
	await mkdir(flatModules, { recursive: true });
	await mkdir(targetDir, { recursive: true });
	await cp(join(ROOT, "package.json"), join(targetDir, "package.json"));
	await cp(join(ROOT, "lib"), join(targetDir, "lib"), { recursive: true });
	await cp(join(ROOT, "profiles"), join(targetDir, "profiles"), { recursive: true });
	await cp(join(ROOT, "templates"), join(targetDir, "templates"), { recursive: true });
	await cp(join(ROOT, "skills"), join(targetDir, "skills"), { recursive: true });
	await cp(join(ROOT, "LICENSE"), join(targetDir, "LICENSE"));
	for (const readme of ["README.md", "README.zh-CN.md"]) {
		const src = join(ROOT, readme);
		if (await exists(src)) await cp(src, join(targetDir, readme));
	}
	console.log(`✓ package copied → ${targetDir}`);

	// 2) Idempotently add the plugin row to the profile patch.
	let patch = "";
	if (await exists(patchPath)) {
		patch = await readFile(patchPath, "utf8");
	}
	if (patch.includes(`name: '${PACKAGE_NAME}'`)) {
		console.log(`✓ plugin row already present in ${patchPath} (idempotent)`);
	} else {
		const row = `- insert:\n    - id: ${PACKAGE_NAME}\n      name: '${PACKAGE_NAME}'\n`;
		// An empty patch (`[]` or blank) is replaced, not appended — `[]` +
		// a following list is invalid YAML.
		const trimmed = patch.trim();
		if (trimmed === "" || trimmed === "[]") {
			await writeFile(patchPath, row, "utf8");
		} else {
			await writeFile(patchPath, `${patch.trimEnd()}\n\n${row}`, "utf8");
		}
		console.log(`✓ plugin row added → ${patchPath}`);
	}

	// 3) Scaffold the workspace (only missing files; never overwrite).
	const templates = join(ROOT, "templates", "workspace");
	const scaffolded = [];
	for (const entry of await readdir(templates, { withFileTypes: true })) {
		const src = join(templates, entry.name);
		const dest = join(workspace, entry.name);
		if (!(await exists(dest))) {
			await cp(src, dest, { recursive: true });
			scaffolded.push(entry.name);
		}
	}
	if (scaffolded.length > 0) {
		console.log(`✓ workspace scaffolded (new files only): ${scaffolded.join(", ")}`);
		console.log(`  → ${workspace}`);
	} else {
		console.log(`✓ workspace already populated (nothing overwritten): ${workspace}`);
	}

	console.log("");
	console.log("下一步（Next steps）:");
	console.log("  1. 重启 Harness：退出当前 `npx @deepseek-ai/dsh web`，再重新运行。");
	console.log("  2. 在侧边栏底部点击「内容项目」打开工作台；设置 → 毛毛星内容工作台 查看环境状态。");
	console.log("  3. 卸载：npm run uninstall:local（不会删除你的 projects/ 与 knowledge/）。");
}

main().catch((error) => {
	console.error("install:local failed:", error instanceof Error ? error.message : error);
	process.exit(1);
});
