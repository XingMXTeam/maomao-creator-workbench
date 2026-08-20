import { ContentIntelligenceService } from "./host/intelligence.js";
import { buildIntelligenceContribution } from "./host/intelligence.js";
import { registerWorkbenchSettings } from "./host/settings.js";

/**
 * Maomao Creator Workbench — AGGREGATOR plugin (host half).
 *
 * This plugin does NOT own ContentProjects / ContentWorkflows. Those services
 * are provided by the dedicated plugins:
 *
 *   @maomao/content-projects   → service `contentProjects`
 *   @maomao/content-workflows  → service `contentWorkflows`
 *   maomao-creator-workbench   → service `contentIntelligence` + UI + settings
 *
 * Dependency direction (inject, never provide):
 *   contentProjects · contentWorkflows · typert · agents · systemPrompt · settings
 *
 * Responsibilities of THIS plugin:
 *   - Creator UI (browser side: Workbench tab / Dashboard / ProjectDetail /
 *     Settings card / sidebar action — all through official Slots)
 *   - Content Intelligence (knowledge on demand, style engine, Critic)
 *   - Creator Profile + durable user settings
 *
 * Engineering rules: `export const name`, `export const inject`, `export
 * function apply`; every `ctx.<service>` is explicitly injected; no default
 * export; no modification of DeepSeek Harness runtime files.
 */

export const name = "maomao-creator-workbench";
export const inject = ["contentProjects", "contentWorkflows", "typert", "agents", "systemPrompt", "settings"];

export function apply(ctx, config = {}) {
	// Intelligence is the one service this plugin OWNS. It consumes the
	// injected `contentProjects` service (knowledge root resolution) and the
	// old plugins' `isBlankArtifact` helper (critic guard).
	const intelligence = new ContentIntelligenceService(ctx, config.intelligence);

	ctx.effect(() => {
		return ctx.typert.register(buildIntelligenceContribution());
	}, "maomao-workbench: contentIntelligence remotes");

	// On-demand knowledge index (Phase 4): path-only, never the content.
	// (The project-context prompt section is owned by @maomao/content-workflows.)
	ctx.effect(() => {
		return ctx.systemPrompt.section({
			name: "maomao:knowledge-index",
			order: 95,
			text: (context) => intelligence.knowledgeIndexSection()
		});
	}, "maomao-workbench: knowledge-index prompt section");

	// Durable user settings (workspace root / series / platforms / profile).
	registerWorkbenchSettings(ctx);

	return { intelligence };
}
