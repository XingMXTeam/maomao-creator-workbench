/**
 * ContentProjects — ADAPTER module (Aggregator Plugin).
 *
 * The `contentProjects` service is OWNED by the dedicated plugin
 * `@maomao/content-projects` (Phase 2). This workbench plugin must NOT
 * re-provide it — Cordis rejects duplicate service registration. Everything
 * here delegates to the real owner, or re-exports its pure helpers.
 *
 * Usage inside the workbench:
 *   const projects = getProjectsService(ctx);   // === ctx.contentProjects
 */

/** Access the injected contentProjects service (must be in `inject`). */
export function getProjectsService(ctx) {
	return ctx.contentProjects;
}

export {
	PROJECT_FILE_NAMES,
	PROJECT_READABLE_NAMES,
	PROJECT_STATUSES,
	PROJECT_STAGES,
	WORKFLOW_ACTIONS,
	templateFor
} from "@maomao/content-projects";
