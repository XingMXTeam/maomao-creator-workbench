#!/usr/bin/env node
/**
 * maomao-creator-workbench — uninstall:local (aggregator uninstall)
 *
 * Removes the workbench AND its two service-provider plugins from a DeepSeek
 * Harness profile:
 *   1. removes every plugin row from $DSH_HOME/profiles/<profile>/cordis.patch.yml
 *   2. removes the three packages from $DSH_HOME/profiles/node_modules/
 *
 * NEVER deletes user content: projects/, knowledge/, AGENTS.md, skills and
 * anything else in the workspace are left untouched.
 *
 * Usage: node scripts/uninstall-local.mjs [--profile web]
 */
import { rm, readFile, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_NAMES = [
	"@maomao/content-projects",
	"@maomao/content-workflows",
	"maomao-creator-workbench"
];

function parseArgs(argv) {
	const args = { profile: "web" };
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === "--profile") args.profile = argv[i + 1];
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
	const patchPath = join(profileDir, "cordis.patch.yml");

	console.log(`maomao-creator-workbench uninstall:local`);
	console.log(`  DSH_HOME:  ${dshHome}`);
	console.log(`  profile:   ${args.profile}`);

	// 1) Remove every maomao plugin row (idempotent; keep the rest of the patch intact).
	if (await exists(patchPath)) {
		const patch = await readFile(patchPath, "utf8");
		// Split into `- insert:` blocks; drop any block referencing a maomao package.
		const blocks = patch.split(/(?=^- insert:)/m);
		const keptBlocks = blocks.filter((block) => !PACKAGE_NAMES.some((name) => block.includes(name)));
		const next = keptBlocks.join("").replace(/\n{3,}/g, "\n\n").trimEnd();
		await writeFile(patchPath, next === "" ? "" : `${next}\n`, "utf8");
		console.log(`✓ plugin rows removed from ${patchPath}`);
	} else {
		console.log(`- no patch file at ${patchPath}`);
	}

	// 2) Remove the packages (plugin code only; user content untouched).
	for (const name of PACKAGE_NAMES) {
		const dir = name.startsWith("@")
			? join(flatModules, name.split("/")[0], name.split("/")[1])
			: join(flatModules, name);
		if (await exists(dir)) {
			await rm(dir, { recursive: true, force: true });
			console.log(`✓ package removed → ${dir}`);
		} else {
			console.log(`- package not found at ${dir}`);
		}
	}

	console.log("");
	console.log("卸载完成（Uninstall complete）:");
	console.log("  DeepSeek Harness 已恢复正常。你的内容资产（projects/、knowledge/、");
	console.log("  AGENTS.md、skills/）**未被触碰**——插件与用户内容完全分离。");
	console.log("  重启 `npx @deepseek-ai/dsh web` 后生效。");
}

main().catch((error) => {
	console.error("uninstall:local failed:", error instanceof Error ? error.message : error);
	process.exit(1);
});
