#!/usr/bin/env node
/**
 * maomao-creator-workbench — uninstall:local
 *
 * Removes the workbench from a DeepSeek Harness profile:
 *   1. removes the plugin row from $DSH_HOME/profiles/<profile>/cordis.patch.yml
 *   2. removes $DSH_HOME/profiles/node_modules/maomao-creator-workbench
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

const PACKAGE_NAME = "maomao-creator-workbench";

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
	const targetDir = join(flatModules, PACKAGE_NAME);
	const patchPath = join(profileDir, "cordis.patch.yml");

	console.log(`maomao-creator-workbench uninstall:local`);
	console.log(`  DSH_HOME:  ${dshHome}`);
	console.log(`  profile:   ${args.profile}`);

	// 1) Remove the plugin row (idempotent; keep the rest of the patch intact).
	if (await exists(patchPath)) {
		const patch = await readFile(patchPath, "utf8");
		const lines = patch.split("\n");
		const kept = [];
		let skipping = false;
		for (let i = 0; i < lines.length; i += 1) {
			const line = lines[i];
			if (/^- insert:$/.test(line.trim())) {
				// look ahead: does this insert block reference the package?
				let block = [line];
				let j = i + 1;
				while (j < lines.length && /^\s+- /.test(lines[j])) {
					block.push(lines[j]);
					j += 1;
				}
				if (block.some((l) => l.includes(PACKAGE_NAME))) {
					skipping = true;
					i = j - 1;
				} else {
					kept.push(line);
				}
				continue;
			}
			if (skipping && /^\s*- /.test(line)) {
				skipping = false;
			}
			if (!skipping) kept.push(line);
		}
		const next = kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
		await writeFile(patchPath, `${next}\n`, "utf8");
		console.log(`✓ plugin row removed from ${patchPath}`);
	} else {
		console.log(`- no patch file at ${patchPath}`);
	}

	// 2) Remove the package (plugin code only).
	if (await exists(targetDir)) {
		await rm(targetDir, { recursive: true, force: true });
		console.log(`✓ package removed → ${targetDir}`);
	} else {
		console.log(`- package not found at ${targetDir}`);
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
