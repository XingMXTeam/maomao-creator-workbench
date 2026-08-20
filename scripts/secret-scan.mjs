#!/usr/bin/env node
/**
 * secret-scan.mjs — scan the repository for secrets and private data.
 * Fails (exit 1) when anything is found. Patterns cover the items in the
 * Phase 5 privacy checklist; the demo workspace must stay fictional.
 *
 * Run: npm run secret-scan
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const SKIP_DIRS = new Set([".git", "node_modules", ".install", "dist", "docs/screenshots"]);
const SKIP_FILES = new Set([".DS_Store"]);

// (name, regex, hint) — regexes kept tight to avoid false positives on docs.
const PATTERNS = [
	["API key (sk-)", /\bsk-[A-Za-z0-9]{16,}\b/, "DeepSeek/OpenAI-style secret key"],
	["Bearer token", /\bBearer\s+[A-Za-z0-9._-]{16,}/i, "authorization header"],
	["Private key PEM", /-----BEGIN [A-Z ]*PRIVATE KEY-----/, "PEM private key"],
	["AWS access key", /\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
	["Generic secret field", /\b(secret|token|api[_-]?key|password)\s*[:=]\s*["'][^"']{8,}["']/i, "hardcoded credential (docs may use placeholders)"],
	["Felix username", /\bfelix\b/i, "author's personal username"],
	["Felix home path", /\/Users\/felix\b/, "author's absolute home path"],
	["Private email", /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "email address (docs must use example.com)"],
	["Phone number", /\b(\+?\d{1,3}[- ]?)?1?[- ]?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/, "phone number"],
	["Notion page id", /\b[0-9a-f]{32}\b/i, "Notion-style 32-hex page id"],
	["Browser session", /(session|cookie)[A-Za-z]*\s*[:=]\s*["'][A-Za-z0-9+/=_-]{16,}["']/i, "session/cookie value"],
	["Workspace absolute path (other)", /\/Users\/[A-Za-z0-9_-]+\/(?!Projects)/, "an absolute user path (only /Users/yourname and ~ are allowed)"]
];

const EXEMPT = new Set([
	"scripts/secret-scan.mjs", // the scanner itself
	"docs/security.md", // documents the scan policy (if present)
	".env.example" // placeholder keys only
]);

async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			yield* walk(join(dir, entry.name));
		} else if (!SKIP_FILES.has(entry.name)) {
			if (/\.credentials(\.ya?ml)?$|\.env$/i.test(entry.name)) {
				throw new Error(`secret-scan: credential file would be committed: ${join(dir, entry.name)}`);
			}
			yield join(dir, entry.name);
		}
	}
}

let findings = 0;
for await (const file of walk(ROOT)) {
	const rel = relative(ROOT, file);
	if (EXEMPT.has(rel)) continue;
	const info = await stat(file);
	if (info.size > 2 * 1024 * 1024) continue; // skip huge binaries
	let content;
	try {
		content = await readFile(file, "utf8");
	} catch {
		continue; // binary
	}
	const lines = content.split("\n");
	for (const [name, re, hint] of PATTERNS) {
		for (let i = 0; i < lines.length; i += 1) {
			if (re.test(lines[i])) {
				const snippet = lines[i].trim().slice(0, 120);
				// The generic secret field pattern trips on .env.example placeholders — allowed.
				console.error(`✗ ${rel}:${i + 1}  [${name}] ${snippet}`);
				console.error(`    hint: ${hint}`);
				findings += 1;
			}
		}
	}
}

if (findings > 0) {
	console.error(`\nSecret scan FAILED: ${findings} finding(s). Fix them before committing.`);
	process.exit(1);
}
console.log("✓ secret scan: no secrets or private data found.");
