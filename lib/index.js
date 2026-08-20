import { ContentProjectsService } from "./host/projects.js";
import { ContentWorkflowsService } from "./host/workflows.js";
import { ContentIntelligenceService } from "./host/intelligence.js";
import { buildProjectsContribution } from "./host/projects.js";
import { buildWorkflowsContribution } from "./host/workflows.js";
import { buildIntelligenceContribution } from "./host/intelligence.js";
import { registerWorkbenchSettings } from "./host/settings.js";

/**
 * Maomao Creator Workbench — single Cordis plugin (host half).
 *
 * The workbench is a GENERIC creator engine; `profiles/<id>/` supplies the
 * content rules (positioning, style, series, quality, investment). One plugin
 * row mounts everything; responsibility boundaries stay in separate modules:
 *
 *   lib/host/projects.js      → ContentProjects   (project.json + artifacts + state + session binding)
 *   lib/host/workflows.js     → ContentWorkflows  (research/facts/thesis/draft/publish-check + guards)
 *   lib/host/intelligence.js  → ContentIntelligence (knowledge/style/quality/critic + context routing)
 *   lib/host/settings.js      → durable user settings (workspace/series/platforms/profile)
 *
 * Engineering rules: `export const name`, `export const inject`, `export
 * function apply`; every `ctx.<service>` is explicitly injected; no default
 * export; no dependency on DeepSeek Core bundle internals.
 */

export const name = "maomao-creator-workbench";
export const inject = ["typert", "agents", "systemPrompt", "settings"];

export function apply(ctx, config = {}) {
	// 1) State owner first: ContentProjects registers ctx.contentProjects.
	const projects = new ContentProjectsService(ctx, config.projects);
	// 2) Action owner: ContentWorkflows consumes ctx.contentProjects.
	const workflows = new ContentWorkflowsService(ctx);
	// 3) Knowledge/Style/Critic owner: consumes ctx.contentProjects.
	const intelligence = new ContentIntelligenceService(ctx, config.intelligence);

	ctx.effect(() => {
		return ctx.typert.register(buildProjectsContribution());
	}, "maomao-workbench: contentProjects remotes");
	ctx.effect(() => {
		return ctx.typert.register(buildWorkflowsContribution());
	}, "maomao-workbench: contentWorkflows remotes");
	ctx.effect(() => {
		return ctx.typert.register(buildIntelligenceContribution());
	}, "maomao-workbench: contentIntelligence remotes");

	// Project-aware agent context (Phase 3): any composer message in a bound
	// session carries the current project.
	ctx.effect(() => {
		return ctx.systemPrompt.section({
			name: "maomao:project-context",
			order: 90,
			text: (context) => workflows.projectContextSection(context)
		});
	}, "maomao-workbench: project-context prompt section");

	// On-demand knowledge index (Phase 4): path-only, never the content.
	ctx.effect(() => {
		return ctx.systemPrompt.section({
			name: "maomao:knowledge-index",
			order: 95,
			text: (context) => intelligence.knowledgeIndexSection()
		});
	}, "maomao-workbench: knowledge-index prompt section");

	// Durable user settings (workspace root / series / platforms / profile).
	registerWorkbenchSettings(ctx);

	return { projects, workflows, intelligence };
}
