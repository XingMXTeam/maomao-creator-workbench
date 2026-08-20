#!/usr/bin/env node
/**
 * verify.mjs — pre-flight verification for contributors.
 * Runs: syntax checks → secret scan → unit → integration → persistence.
 * (Cold boot + clean install are heavier; run them with npm run test:cold-boot /
 * npm run test:clean-install, or everything with npm test.)
 */
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

async function run(name, script, args = []) {
	console.log(`\n━━━ ${name} ━━━`);
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [join(ROOT, script), ...args], { stdio: ["ignore", "inherit", "inherit"] });
		child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${name} exited ${code}`))));
	});
}

// 1) Syntax check the shipped modules.
console.log("━━━ syntax ━━━");
for (const file of ["lib/index.js", "lib/client.js", "lib/host/projects.js", "lib/host/workflows.js", "lib/host/intelligence.js", "lib/host/settings.js"]) {
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["--check", join(ROOT, file)], { stdio: ["ignore", "inherit", "inherit"] });
		child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${file} syntax failed`))));
	});
}
console.log("✓ all modules pass syntax check");

// 2) Secret scan.
await run("secret scan", "scripts/secret-scan.mjs");

// 3) Fast suites.
await run("unit", "tests/unit/run.mjs");
await run("integration", "tests/integration/run.mjs");
await run("persistence", "tests/persistence/run.mjs");

console.log("\n✓ verify: all fast checks passed. Run `npm test` for cold boot + clean install.");
