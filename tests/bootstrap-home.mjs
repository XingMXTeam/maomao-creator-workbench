/**
 * Bootstrap a STOCK DeepSeek Harness home at a fresh DSH_HOME:
 * stock web profile (bundle list + empty patch) + the flat package table
 * (symlink farm to the harness install) + base settings/credentials.
 * No author-local content is copied — only harness-standard files.
 */
import { mkdir, rm, cp, writeFile, access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export async function bootstrapStockHome(dshHome) {
	const realHome = process.env.DSH_HOME || join(homedir(), ".dsh");
	await mkdir(join(dshHome, "profiles", "web"), { recursive: true });
	await rm(join(dshHome, "profiles", "node_modules"), { recursive: true, force: true });
	await cp(join(realHome, "profiles", "node_modules"), join(dshHome, "profiles", "node_modules"), { recursive: true });
	await writeFile(join(dshHome, "profiles", "web", "package.json"), JSON.stringify({
		name: "dsh-profile-web",
		private: true,
		dependencies: {},
		dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"] } }
	}, null, 2), "utf8");
	await writeFile(join(dshHome, "profiles", "web", "pnpm-workspace.yaml"), "packages:\n  - .\n", "utf8");
	await writeFile(join(dshHome, "profiles", "web", "cordis.patch.yml"), "[]\n", "utf8");
	for (const name of ["settings.yaml", ".credentials.yaml", ".anonymous-user-id"]) {
		const src = join(realHome, name);
		if (await exists(src)) {
			await cp(src, join(dshHome, name));
		}
	}
}
