window.__ModuleLoader__.load({
	id: "@maomao/content-projects",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		/**
		* 毛毛星 Creator — ContentProject client service (Phase 2).
		*
		* Mounts the `contentProjects` Remote namespace over the api gateway, then
		* exposes a reactive client service on `ctx.contentProjects` AND on
		* `window.__maomaoContentProjects` (the bridge the Phase-1 static UI bundles
		* consume). State is a single frozen snapshot replaced on every mutation, so
		* `useSyncExternalStore(subscribe, getSnapshot)` stays valid.
		*/
		/** Passthrough strict codec (JSON wire; shape validation lives in the UI layer). */
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
				codec: passthrough(`@maomao/content-projects#${name}`)
			};
		}
		/** One direct Remote invocation descriptor. */
		function descriptor(method, parameters, resultType) {
			return {
				id: `@maomao/content-projects#contentProjects/${method}`,
				service: "contentProjects",
				namespace: "contentProjects",
				method,
				invocation: { kind: "direct" },
				parameters,
				result: passthrough(resultType)
			};
		}
		/** The Remote contribution mounted into the client gateway. */
		const CONTRIBUTION = {
			package: "@maomao/content-projects",
			descriptors: [
				descriptor("list", [], "ProjectListResult"),
				descriptor("get", [jsonParam("slug")], "ProjectDetailResult"),
				descriptor("create", [jsonParam("input")], "ProjectResult"),
				descriptor("updateStatus", [jsonParam("slug"), jsonParam("patch")], "ProjectResult"),
				descriptor("readFile", [jsonParam("slug"), jsonParam("name")], "ProjectFileResult"),
				descriptor("writeFile", [jsonParam("slug"), jsonParam("name"), jsonParam("content")], "WriteResult"),
				descriptor("bindSession", [jsonParam("slug"), jsonParam("sessionId")], "ProjectResult"),
				descriptor("setWorkflow", [jsonParam("slug"), jsonParam("action"), jsonParam("record")], "ProjectResult")
			]
		};
		/** Required client services. */
		const inject = ["remote", "sessions", "workspaces"];
		/**
		* Build the reactive client service bound to the mounted namespace.
		* @param ctx - client root context (carries `remote`).
		* @returns the service handle.
		*/
		function createClientService(ctx) {
			let state = {
				phase: "idle",
				error: null,
				projects: [],
				currentSlug: null,
				detail: null
			};
			const listeners = /* @__PURE__ */ new Set();
			const setState = (patch) => {
				state = { ...state, ...patch };
				for (const listener of [...listeners]) {
					try {
						listener();
					} catch (error) {
						console.error("content-projects: listener threw:", error);
					}
				}
			};
			const namespace = () => {
				// Dotted service access (ctx.remote.contentProjects) requires the
				// namespace name in inject — impossible here because THIS plugin
				// mounts it asynchronously. ctx.get() bypasses the inject guard and
				// resolves the provided "remote.contentProjects" service directly.
				const service = ctx.get("remote.contentProjects");
				if (service === void 0) throw new Error("content-projects: Remote namespace not mounted yet");
				return service;
			};
			/** Unwrap the { ok, value | error } Remote envelope. */
			const unwrap = async (promise) => {
				const result = await promise;
				if (result === void 0 || result === null || result.ok !== true) {
					const message = result?.error?.message ?? "content-projects: Remote call failed";
					throw new Error(message);
				}
				return result.value;
			};
			const refresh = async () => {
				setState({ phase: "loading", error: null });
				try {
					const value = await unwrap(namespace().list());
					const projects = Array.isArray(value?.projects) ? value.projects : [];
					setState({ phase: "ready", projects, error: null });
					return projects;
				} catch (error) {
					setState({ phase: "unavailable", error: error instanceof Error ? error.message : String(error) });
					throw error;
				}
			};
			const openProject = async (slug) => {
				const value = await unwrap(namespace().get(slug));
				await bindPrimarySession(value.project);
				setState({ currentSlug: slug, detail: value });
				return value;
			};
			/**
			* Project ↔ Session binding (v1: 1 project → 1 primary session).
			* Restore the recorded activeSessionId when it still exists; otherwise
			* create a session in the current workspace, persist the binding, and
			* switch to it (the composer then targets the project's session, so the
			* prompt section injects project context for arbitrary messages too).
			*/
			const bindPrimarySession = async (project) => {
				const sessions = ctx.get("sessions");
				const workspaces = ctx.get("workspaces");
				if (sessions === void 0 || workspaces === void 0) return;
				try {
					const sessionsState = sessions.list.getSnapshot();
					const current = sessionsState.current;
					const recorded = typeof project.activeSessionId === "string" ? project.activeSessionId : "";
					if (recorded !== "" && sessionsState.byId?.[recorded] !== void 0) {
						if (current !== recorded) sessions.open(recorded);
						return;
					}
					const workspaceState = workspaces.list.getSnapshot();
					const currentWorkspaceId = current === void 0 ? void 0 : workspaceState.items.find((item) => item.sessionIds.includes(current))?.workspaceId;
					const target = currentWorkspaceId ?? workspaceState.recentWorkspaceId;
					if (target === void 0) return;
					const sessionId = await workspaces.connectWorkspace(target);
					if (typeof sessionId === "string" && sessionId !== "") {
						await unwrap(namespace().bindSession(project.slug, sessionId));
						project.activeSessionId = sessionId;
						project.lastSessionId = sessionId;
					}
				} catch (error) {
					console.warn("content-projects: session binding failed:", error);
				}
			};
			/** Reload the open project's detail (post-run refresh; tab content updates). */
			const reload = async () => {
				const slug = state.currentSlug;
				if (slug === null) return null;
				const value = await unwrap(namespace().get(slug));
				setState({ detail: value });
				return value;
			};
			const setWorkflow = async (slug, action, record) => {
				const value = await unwrap(namespace().setWorkflow(slug, action, record));
				await refresh();
				if (state.currentSlug === slug && state.detail !== null) {
					setState({ detail: { ...state.detail, project: value.project } });
				}
				return value.project;
			};
			const bindSession = async (slug, sessionId) => {
				const value = await unwrap(namespace().bindSession(slug, sessionId));
				await refresh();
				if (state.currentSlug === slug && state.detail !== null) {
					setState({ detail: { ...state.detail, project: value.project } });
				}
				return value.project;
			};
			return {
				/** Current frozen state snapshot (stable identity until a mutation). */
				getSnapshot: () => state,
				/** Subscribe to state changes; returns the unsubscriber. */
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				markUnavailable: (error) => {
					setState({
						phase: "unavailable",
						error: error instanceof Error ? error.message : String(error)
					});
				},
				refresh,
				/** Open one project: load its detail and mark it current. */
				open: openProject,
				/** Close the current project (back to the dashboard). */
				close: () => {
					setState({ currentSlug: null, detail: null });
				},
				/** Create a project, refresh the list, and open it. */
				create: async (input) => {
					const value = await unwrap(namespace().create(input));
					await refresh();
					await openProject(value.project.slug);
					return value.project;
				},
				/** Persist status/stage changes, refresh, and update the open detail. */
				updateStatus: async (slug, patch) => {
					const value = await unwrap(namespace().updateStatus(slug, patch));
					await refresh();
					if (state.currentSlug === slug && state.detail !== null) {
						setState({ detail: { ...state.detail, project: value.project } });
					}
					return value.project;
				},
				/** Read one artifact file. */
				readFile: async (slug, name) => {
					const value = await unwrap(namespace().readFile(slug, name));
					return value.content;
				},
				/** Write one artifact file (bumps project.updatedAt). */
				writeFile: async (slug, name, content) => {
					await unwrap(namespace().writeFile(slug, name, content));
					await refresh();
				},
				/** Reload the open project's detail (auto-refresh tabs after runs). */
				reload,
				/** Persist one workflow action record (used by the workflow engine). */
				setWorkflow,
				/** Persist the project's primary session binding. */
				bindSession
			};
		}
		/** Client plugin body: provide the service and mount the Remote contribution. */
		function apply(ctx) {
			const service = createClientService(ctx);
			ctx.reflect.provide("contentProjects", service);
			window.__maomaoContentProjects = service;
			ctx.remote.$mount(CONTRIBUTION).then(() => {
				service.refresh().catch(() => {
				});
			}).catch((error) => {
				service.markUnavailable(error);
			});
		}
		exports.apply = apply;
		exports.inject = inject;
		exports.buildContribution = () => CONTRIBUTION;
		return module.exports;
	}
});
