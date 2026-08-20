/**
 * Cold boot test — boots a REAL `dsh web` instance against a fresh DSH_HOME
 * (stock profile + stock packages, no local patches) and verifies:
 *   - the server boots without fatal errors
 *   - with --with-plugin: the boot manifest carries maomao-creator-workbench
 *     and its client bundle serves HTTP 200
 *
 * Usage:
 *   node tests/cold-boot/run.mjs [--dsh-home <path>] [--with-plugin]
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, access, rm, cp } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { bootstrapStockHome } from "../bootstrap-home.mjs";

const NODE = process.execPath;
// Resolve the Harness CLI portably: npx --no-install uses the local cache
// without prompting for a download (the machine must already run dsh).
const DSH_BIN = "npx";

function parseArgs(argv) {
	const args = { dshHome: null, withPlugin: false };
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === "--dsh-home") args.dshHome = argv[i + 1];
		else if (argv[i] === "--with-plugin") args.withPlugin = true;
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

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

let passed = 0;
function ok(name, cond, extra = "") {
	if (!cond) throw new Error(`FAIL: ${name} ${extra}`);
	passed += 1;
	console.log(`✓ ${name}`);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const dshHome = args.dshHome || join("/tmp", `maomao-coldboot-${Date.now()}`);
	const fresh = !(await exists(dshHome));
	const realHome = process.env.DSH_HOME || join(homedir(), ".dsh");

	if (fresh) {
		await mkdir(dshHome, { recursive: true });
		await bootstrapStockHome(dshHome);
	}

	const port = 3900 + Math.floor(Math.random() * 500);
	const logPath = join(dshHome, "coldboot.log");
	const child = spawn(DSH_BIN, ["--no-install", "@deepseek-ai/dsh", "web", "--port", String(port)], {
		env: { ...process.env, DSH_HOME: dshHome },
		stdio: ["ignore", "pipe", "pipe"]
	});
	let log = "";
	child.stdout.on("data", (d) => {
		log += d.toString();
	});
	child.stderr.on("data", (d) => {
		log += d.toString();
	});

	let up = false;
	for (let i = 0; i < 60; i += 1) {
		try {
			const res = await fetch(`http://127.0.0.1:${port}/`);
			if (res.ok) {
				up = true;
				break;
			}
		} catch {
			// not up yet
		}
		await sleep(1000);
	}
	ok("cold boot: server up", up, `port ${port}`);

	if (up) {
		const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
		const manifestMatch = /window\.__DSH_BOOT__ = (\{.*?\});?\s*<\/script>/s.exec(html);
		ok("cold boot: boot manifest present", manifestMatch !== null);
		if (manifestMatch !== null) {
			const manifest = JSON.parse(manifestMatch[1]);
			const entry = manifest.entries.find((e) => e.id === "maomao-creator-workbench");
			if (args.withPlugin) {
				ok("cold boot: manifest entry for maomao-creator-workbench", entry !== void 0);
				if (entry !== void 0) {
					const res = await fetch(`http://127.0.0.1:${port}${entry.url.split("?")[0]}`);
					ok("cold boot: client bundle HTTP 200", res.status === 200, `${entry.url} → ${res.status}`);
				}
			} else {
				console.log(`- (no --with-plugin: manifest has ${manifest.entries.length} entries)`);
			}
		}
	}

	child.kill("SIGTERM");
	await new Promise((resolve) => {
		child.on("exit", resolve);
		setTimeout(resolve, 3000);
	});
	await writeFile(logPath, log, "utf8");
	ok("cold boot: no fatal errors in log", !/(fatal load failure|plugin\(s\) failed to load|ERR_MODULE_NOT_FOUND)/.test(log), log.split("\n").slice(-3).join(" | "));

	console.log(`\nCold boot: ${passed} passed. (log: ${logPath})`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
