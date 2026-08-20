import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";

/**
 * Maomao Creator Workbench — durable settings (Host user-settings document).
 *
 * The workbench is GENERIC; a Creator Profile supplies the content rules. These
 * settings only hold user-owned choices: workspace root (empty = auto-resolve
 * from the active session's cwd), the active profile id, the content series
 * list, and platform toggles. Nothing personal is stored by default.
 */

/** Settings namespace owned by the workbench. */
export const WORKBENCH_SETTINGS_NAMESPACE = "maomao-workbench";

/** Default content series (generic; overridable per profile/user). */
export const DEFAULT_SERIES = ["商业观察", "公司研究", "投资系统", "经济观察", "AI/技术"];

/** Default platform rows (enable/disable in the workbench settings card). */
export const DEFAULT_PLATFORMS = {
	"xiaohongshu": "小红书",
	"douyin": "抖音",
	"bilibili": "B站",
	"shipinhao": "视频号"
};

/** Durable workbench settings schema (schemastery). */
export const WorkbenchSettingsSchema = z.object({
	/** Absolute workspace root; empty string = auto (first live session's cwd). */
	workspaceRoot: z.string().required(false),
	/** Active Creator Profile id; defaults to "maomao". */
	profile: z.string().required(false),
	/** Content series shown in the Dashboard and topic flow. */
	series: z.array(z.string()).required(false),
	/** Enabled platform flags; absent = disabled. */
	platforms: z.object({
		"xiaohongshu": z.boolean().required(false),
		"douyin": z.boolean().required(false),
		"bilibili": z.boolean().required(false),
		"shipinhao": z.boolean().required(false)
	}).required(false),
	/** Video/library directory used by the video pipeline. */
	videoDir: z.string().required(false),
	/** AI creation rules for scripts (free-form textarea). */
	scriptRules: z.string().required(false),
	/** Subtitle API key (stored in the local settings document; redacted in logs). */
	subtitleApiKey: z.string().required(false),
	/** Cover API key (stored in the local settings document; redacted in logs). */
	coverApiKey: z.string().required(false)
});

/** Defaults merged over whatever the user document holds. */
export function workbenchSettingsDefaults() {
	return {
		workspaceRoot: "",
		profile: "maomao",
		series: [...DEFAULT_SERIES],
		platforms: {},
		videoDir: "",
		scriptRules: "",
		subtitleApiKey: "",
		coverApiKey: ""
	};
}

/**
 * Register the workbench settings namespace on the host.
 * @param ctx - owning Cordis context (must inject `settings`).
 */
export function registerWorkbenchSettings(ctx) {
	ctx.effect(() => {
		const scope = ctx.settings.register(settingsNamespace(WORKBENCH_SETTINGS_NAMESPACE), WorkbenchSettingsSchema);
		return typeof scope?.dispose === "function" ? () => scope.dispose() : void 0;
	}, "maomao-workbench: settings namespace");
}

/** Read the merged workbench settings (defaults + user overrides). */
export async function readWorkbenchSettings(ctx) {
	const defaults = workbenchSettingsDefaults();
	try {
		const stored = ctx.settings.get(settingsNamespace(WORKBENCH_SETTINGS_NAMESPACE)) ?? {};
		return {
			...defaults,
			...stored,
			series: Array.isArray(stored.series) && stored.series.length > 0 ? stored.series : defaults.series
		};
	} catch {
		return defaults;
	}
}
