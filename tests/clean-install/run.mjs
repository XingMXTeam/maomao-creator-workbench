/**
 * Clean environment test — THE Phase 5 acceptance gate.
 *
 * On a BRAND-NEW DSH_HOME with NO local history (stock profile, stock
 * packages, empty patch layer):
 *   1. run scripts/install-local.mjs (the real user install path)
 *   2. verify the plugin row + package landed in the temp harness home
 *   3. verify the workspace was scaffolded (templates only, nothing overwritten)
 *   4. real `dsh web` cold boot with --with-plugin (manifest + client 200)
 *   5. uninstall:local removes the row + package and leaves the workspace alone
 *
 * Run: node tests/clean-install/run.mjs
 */
import { access, readFile, readdir, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { bootstrapStockHome } from "../bootstrap-home.mjs";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const NODE = process.execPath;

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

let passed = 0;
function ok(name, cond, extra = "") {
	if (!cond) throw new Error(`FAIL: ${name} ${extra}`);
	passed += 1;
	console.log(`✓ ${name}`);
}

async function run(cmd, args, env) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
		let out = "";
		child.stdout.on("data", (d) => {
			out += d.toString();
		});
		child.stderr.on("data", (d) => {
			out += d.toString();
		});
		child.on("exit", (code) => {
			if (code === 0) resolve(out);
			else reject(new Error(`exit ${code}: ${out.split("\n").slice(-5).join("\n")}`));
		});
	});
}

async function main() {
	const dshHome = await mkdtemp(join(tmpdir(), "maomao-clean-"));
	const workspace = join(dshHome, "workspace");
	console.log(`Clean environment: DSH_HOME=${dshHome}`);
	await bootstrapStockHome(dshHome);

	// 1) Install (the real user path).
	const installOut = await run(NODE, [join(ROOT, "scripts", "install-local.mjs"), "--workspace", workspace], { DSH_HOME: dshHome });
	ok("clean install: install-local ran", /✓ package copied/.test(installOut), installOut.split("\n").slice(-6).join(" | "));
	ok("clean install: plugin row added", /✓ plugin row added/.test(installOut));
	ok("clean install: workspace scaffolded", /✓ workspace scaffolded/.test(installOut));

	// 2) Verify artifacts landed.
	const pkgDir = join(dshHome, "profiles", "node_modules", "maomao-creator-workbench");
	ok("clean install: package on disk", await exists(join(pkgDir, "package.json")) && await exists(join(pkgDir, "lib", "index.js")) && await exists(join(pkgDir, "lib", "client.js")));
	const patch = await readFile(join(dshHome, "profiles", "web", "cordis.patch.yml"), "utf8");
	ok("clean install: only the workbench row mounted", patch.includes("maomao-creator-workbench") && !patch.includes("content-projects"), patch);
	ok("clean install: profile shipped", await exists(join(pkgDir, "profiles", "maomao", "profile.json")));
	ok("clean install: templates shipped", await exists(join(pkgDir, "templates", "workspace", "AGENTS.md")));
	const wsEntries = await readdir(workspace);
	ok("clean install: workspace has knowledge + AGENTS.md", wsEntries.includes("knowledge") && wsEntries.includes("AGENTS.md"), wsEntries.join(","));

	// 3) Real cold boot with the plugin expected.
	await run(NODE, [join(ROOT, "tests", "cold-boot", "run.mjs"), "--dsh-home", dshHome, "--with-plugin"], {});
	ok("clean install: cold boot with plugin passed", true);

	// 4) Uninstall leaves user content alone.
	const uninstallOut = await run(NODE, [join(ROOT, "scripts", "uninstall-local.mjs")], { DSH_HOME: dshHome });
	ok("clean install: uninstall removed the package", !(await exists(pkgDir)));
	ok("clean install: uninstall kept user workspace", await exists(join(workspace, "AGENTS.md")) && await exists(join(workspace, "knowledge")));
	ok("clean install: uninstall removed the row", !(await readFile(join(dshHome, "profiles", "web", "cordis.patch.yml"), "utf8")).includes("maomao-creator-workbench"));

	// 5) Re-install is idempotent-safe after uninstall (fresh again).
	const reinstallOut = await run(NODE, [join(ROOT, "scripts", "install-local.mjs"), "--workspace", workspace], { DSH_HOME: dshHome });
	ok("clean install: re-install works", /✓ package copied/.test(reinstallOut));

	await rm(dshHome, { recursive: true, force: true });
	console.log(`\nClean environment: ${passed} passed.`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
