/**
 * ContentWorkflows — ADAPTER module (Aggregator Plugin).
 *
 * The `contentWorkflows` service is OWNED by the dedicated plugin
 * `@maomao/content-workflows` (Phase 3). This workbench plugin must NOT
 * re-provide it — Cordis rejects duplicate service registration. Everything
 * here delegates to the real owner, or re-exports its pure helpers.
 *
 * Usage inside the workbench:
 *   const workflows = getWorkflowsService(ctx);   // === ctx.contentWorkflows
 */

/** Access the injected contentWorkflows service (must be in `inject`). */
export function getWorkflowsService(ctx) {
	return ctx.contentWorkflows;
}

export {
	WORKFLOW_ACTIONS,
	ARTIFACT_OF,
	ACTION_GUARD,
	STAGE_GUARD,
	ACTION_LABELS,
	TASKS,
	isBlankArtifact,
	WorkflowError,
	buildPrompt
} from "@maomao/content-workflows";
