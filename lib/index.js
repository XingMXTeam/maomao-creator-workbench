import { ContentIntelligenceService } from "./host/intelligence.js";
import { buildIntelligenceContribution } from "./host/intelligence.js";
import { ContentManagerService } from "./host/content-manager.js";
import { buildContentManagerContribution } from "./host/content-manager.js";
import { registerWorkbenchSettings } from "./host/settings.js";

/**
 * Maomao Creator Workbench — AGGREGATOR plugin (host half).
 *
 * This plugin does NOT own ContentProjects / ContentWorkflows. Those services
 * are provided by the dedicated plugins:
 *
 *   @maomao/content-projects   → service `contentProjects`
 *   @maomao/content-workflows  → service `contentWorkflows`
 *   maomao-creator-workbench   → services `contentIntelligence` + `contentManager`
 *                               + UI + settings
 *
 * Dependency direction (inject, never provide):
 *   contentProjects · contentWorkflows · typert · agents · systemPrompt · settings
 *
 * Responsibilities of THIS plugin:
 *   - Creator UI (browser side: Workbench tab / Content Manager workspace /
 *     Settings card — all through official Slots)
 *   - Content Intelligence (knowledge on demand, style engine, Critic)
 *   - Content Manager (Phase 6: video/script/subtitle/cover/article/publish
 *     assets under workspace content/<id>/, subtitle + cover AI actions,
 *     agent context)
 *   - Creator Profile + durable user settings
 *
 * Engineering rules: `export const name`, `export const inject`, `export
 * function apply`; every `ctx.<service>` is explicitly injected; no default
 * export; no modification of DeepSeek Harness runtime files.
 */

export const name = "maomao-creator-workbench";
export const inject = ["contentProjects", "contentWorkflows", "typert", "agents", "systemPrompt", "settings"];

export function apply(ctx, config = {}) {
	// Intelligence owns the knowledge/style/critic layer.
	const intelligence = new ContentIntelligenceService(ctx, config.intelligence);
	// ContentManager owns the Phase-6 content assets + agent context.
	const contentManager = new ContentManagerService(ctx, config.contentManager);

	ctx.effect(() => {
		return ctx.typert.register(buildIntelligenceContribution());
	}, "maomao-workbench: contentIntelligence remotes");
	ctx.effect(() => {
		return ctx.typert.register(buildContentManagerContribution());
	}, "maomao-workbench: contentManager remotes");

	// On-demand knowledge index (Phase 4): path-only, never the content.
	// (The project-context prompt section is owned by @maomao/content-workflows.)
	ctx.effect(() => {
		return ctx.systemPrompt.section({
			name: "maomao:knowledge-index",
			order: 95,
			text: (context) => intelligence.knowledgeIndexSection()
		});
	}, "maomao-workbench: knowledge-index prompt section");

	// Agent Context (Phase 6): the currently open content is injected into
	// every composer request so the Agent can act on it directly.
	ctx.effect(() => {
		return ctx.systemPrompt.section({
			name: "maomao:content-context",
			order: 92,
			text: (context) => contentManager.contentContextSection()
		});
	}, "maomao-workbench: content-context prompt section");

	// Durable user settings (workspace root / series / platforms / profile).
	registerWorkbenchSettings(ctx);

	return { intelligence, contentManager };
}
