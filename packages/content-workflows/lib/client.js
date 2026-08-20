window.__ModuleLoader__.load({
	id: "@maomao/content-workflows",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		/**
		* 毛毛星 Creator — ContentWorkflows client service (Phase 3).
		*
		* Exposes run(slug, action) / advanceStage(slug, stage) over the
		* `contentWorkflows` Remote namespace, on `ctx.contentWorkflows` AND
		* `window.__maomaoContentWorkflows` (the bridge the static UI bundles use).
		*/
		/** Passthrough strict codec (JSON wire). */
		function passthrough(typeSymbol) {
			return {
				mode: "strict",
				typeSymbol,
				schema: { parse: (value) => value }
			};
		}
		/** One JSON parameter declaration. */
		function jsonParam(name) {
			return {
				name,
				wire: name,
				source: "json",
				codec: passthrough(`@maomao/content-workflows#${name}`)
			};
		}
		/** One direct Remote invocation descriptor. */
		function descriptor(method, parameters, resultType) {
			return {
				id: `@maomao/content-workflows#contentWorkflows/${method}`,
				service: "contentWorkflows",
				namespace: "contentWorkflows",
				method,
				invocation: { kind: "direct" },
				parameters,
				result: passthrough(resultType)
			};
		}
		/** The Remote contribution mounted into the client gateway. */
		const CONTRIBUTION = {
			package: "@maomao/content-workflows",
			descriptors: [
				descriptor("run", [jsonParam("slug"), jsonParam("action")], "RunResult"),
				descriptor("advanceStage", [jsonParam("slug"), jsonParam("stage")], "ProjectResult")
			]
		};
		/** Required client services. */
		const inject = ["remote"];
		/** Build the client service bound to the mounted namespace. */
		function createClientService(ctx) {
			const namespace = () => {
				const service = ctx.get("remote.contentWorkflows");
				if (service === void 0) throw new Error("content-workflows: Remote namespace not mounted yet");
				return service;
			};
			const unwrap = async (promise) => {
				const result = await promise;
				if (result === void 0 || result === null || result.ok !== true) {
					const message = result?.error?.message ?? "content-workflows: Remote call failed";
					throw new Error(message);
				}
				return result.value;
			};
			return {
				/** Kick off one workflow action on the project (host drives the agent). */
				run: async (slug, action) => {
					const value = await unwrap(namespace().run(slug, action));
					return value;
				},
				/** Guarded stage transition (blocked with reason when the prerequisite artifact is empty). */
				advanceStage: async (slug, stage) => {
					const value = await unwrap(namespace().advanceStage(slug, stage));
					return value.project;
				}
			};
		}
		/** Client plugin body: provide the service and mount the Remote contribution. */
		function apply(ctx) {
			const service = createClientService(ctx);
			ctx.reflect.provide("contentWorkflows", service);
			window.__maomaoContentWorkflows = service;
			ctx.remote.$mount(CONTRIBUTION).catch((error) => {
				console.error("content-workflows: mount failed:", error);
			});
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.buildContribution = () => CONTRIBUTION;
		return module.exports;
	}
});
