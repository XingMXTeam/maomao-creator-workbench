/**
 * Test orchestrator — npm run test
 * Order: unit → integration → persistence → cold boot → clean install.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SUITES = [
	["unit", "tests/unit/run.mjs"],
	["integration", "tests/integration/run.mjs"],
	["persistence", "tests/persistence/run.mjs"],
	["cold-boot", "tests/cold-boot/run.mjs"],
	["clean-install", "tests/clean-install/run.mjs"]
];

function run(name, script) {
	return new Promise((resolve, reject) => {
		console.log(`\n━━━ ${name} ━━━`);
		const child = spawn(process.execPath, [join(ROOT, script)], {
			stdio: ["ignore", "inherit", "inherit"]
		});
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${name} failed with exit ${code}`));
		});
	});
}

const results = [];
for (const [name, script] of SUITES) {
	try {
		await run(name, script);
		results.push([name, "PASS"]);
	} catch (error) {
		results.push([name, `FAIL (${error.message})`]);
	}
}
console.log("\n━━━ SUMMARY ━━━");
for (const [name, status] of results) console.log(`${status === "PASS" ? "✓" : "✗"} ${name}: ${status}`);
const failed = results.filter(([, s]) => s !== "PASS");
if (failed.length > 0) {
	console.error(`\n${failed.length} suite(s) failed.`);
	process.exit(1);
}
console.log("\nAll suites passed.");
