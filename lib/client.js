window.__ModuleLoader__.load({
	id: "maomao-creator-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		/** Maomao Creator Workbench — client half (single package). */
		/** Seed words resolved by the shell module system (never DeepSeek Core internals). */
		var react = require("react");
		var react_jsx_runtime = require("react/jsx-runtime");

		// ────────────────────────────────────────────────────────────────────
		// Section A — Remote descriptors + client services
		// Namespaces: contentProjects / contentWorkflows / contentIntelligence.
		// ────────────────────────────────────────────────────────────────────
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
				codec: passthrough(`maomao-creator-workbench#${name}`)
			};
		}
		/** One direct Remote invocation descriptor. */
		function descriptor(namespace, method, parameters, resultType) {
			return {
				id: `maomao-creator-workbench#${namespace}/${method}`,
				service: namespace,
				namespace,
				method,
				invocation: { kind: "direct" },
				parameters,
				result: passthrough(resultType)
			};
		}
		/** The three Remote contributions mounted into the client gateway. */
		const PROJECTS_CONTRIBUTION = {
			package: "maomao-creator-workbench.projects",
			descriptors: [
				descriptor("contentProjects", "list", [], "ProjectListResult"),
				descriptor("contentProjects", "get", [jsonParam("slug")], "ProjectDetailResult"),
				descriptor("contentProjects", "create", [jsonParam("input")], "ProjectResult"),
				descriptor("contentProjects", "updateStatus", [jsonParam("slug"), jsonParam("patch")], "ProjectResult"),
				descriptor("contentProjects", "readFile", [jsonParam("slug"), jsonParam("name")], "ProjectFileResult"),
				descriptor("contentProjects", "writeFile", [jsonParam("slug"), jsonParam("name"), jsonParam("content")], "WriteResult"),
				descriptor("contentProjects", "bindSession", [jsonParam("slug"), jsonParam("sessionId")], "ProjectResult"),
				descriptor("contentProjects", "setWorkflow", [jsonParam("slug"), jsonParam("action"), jsonParam("record")], "ProjectResult")
			]
		};
		const WORKFLOWS_CONTRIBUTION = {
			package: "maomao-creator-workbench.workflows",
			descriptors: [
				descriptor("contentWorkflows", "run", [jsonParam("slug"), jsonParam("action")], "RunResult"),
				descriptor("contentWorkflows", "advanceStage", [jsonParam("slug"), jsonParam("stage")], "ProjectResult")
			]
		};
		const INTELLIGENCE_CONTRIBUTION = {
			package: "maomao-creator-workbench.intelligence",
			descriptors: [
				descriptor("contentIntelligence", "knowledgePlan", [jsonParam("task")], "KnowledgePlanResult"),
				descriptor("contentIntelligence", "styleRules", [], "StyleRulesResult"),
				descriptor("contentIntelligence", "critic", [jsonParam("slug")], "CriticRunResult"),
				descriptor("contentIntelligence", "critique", [jsonParam("slug")], "CritiqueResult"),
				descriptor("contentIntelligence", "status", [], "WorkbenchStatusResult")
			]
		};
		/** Module-scope handles (bridges the UI block below). */
		var cp = null;
		var wf = null;
		var ci = null;

		/** Resolve one mounted Remote namespace (bypasses the inject guard). */
		function namespace(ctx, name) {
			const service = ctx.get(`remote.${name}`);
			if (service === void 0) throw new Error(`maomao-workbench: Remote namespace "${name}" not mounted yet`);
			return service;
		}
		/** Unwrap the { ok, value | error } Remote envelope. */
		function unwrap(promise) {
			return promise.then((result) => {
				if (result === void 0 || result === null || result.ok !== true) {
					const message = result?.error?.message ?? "maomao-workbench: Remote call failed";
					throw new Error(message);
				}
				return result.value;
			});
		}

		/** Reactive ContentProjects client service (state = single frozen snapshot). */
		function createProjectsService(ctx) {
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
						console.error("maomao-workbench: listener threw:", error);
					}
				}
			};
			const projectsNs = () => namespace(ctx, "contentProjects");
			const refresh = async () => {
				setState({ phase: "loading", error: null });
				try {
					const value = await unwrap(projectsNs().list());
					const projects = Array.isArray(value?.projects) ? value.projects : [];
					setState({ phase: "ready", projects, error: null });
					return projects;
				} catch (error) {
					setState({ phase: "unavailable", error: error instanceof Error ? error.message : String(error) });
					throw error;
				}
			};
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
						await unwrap(projectsNs().bindSession(project.slug, sessionId));
						project.activeSessionId = sessionId;
						project.lastSessionId = sessionId;
					}
				} catch (error) {
					console.warn("maomao-workbench: session binding failed:", error);
				}
			};
			const openProject = async (slug) => {
				const value = await unwrap(projectsNs().get(slug));
				await bindPrimarySession(value.project);
				setState({ currentSlug: slug, detail: value });
				return value;
			};
			const reload = async () => {
				const slug = state.currentSlug;
				if (slug === null) return null;
				const value = await unwrap(projectsNs().get(slug));
				setState({ detail: value });
				return value;
			};
			return {
				getSnapshot: () => state,
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
				open: openProject,
				close: () => {
					setState({ currentSlug: null, detail: null });
				},
				create: async (input) => {
					const value = await unwrap(projectsNs().create(input));
					await refresh();
					await openProject(value.project.slug);
					return value.project;
				},
				updateStatus: async (slug, patch) => {
					const value = await unwrap(projectsNs().updateStatus(slug, patch));
					await refresh();
					if (state.currentSlug === slug && state.detail !== null) {
						setState({ detail: { ...state.detail, project: value.project } });
					}
					return value.project;
				},
				readFile: async (slug, name) => {
					const value = await unwrap(projectsNs().readFile(slug, name));
					return value.content;
				},
				writeFile: async (slug, name, content) => {
					await unwrap(projectsNs().writeFile(slug, name, content));
					await refresh();
				},
				reload,
				setWorkflow: async (slug, action, record) => {
					const value = await unwrap(projectsNs().setWorkflow(slug, action, record));
					await refresh();
					if (state.currentSlug === slug && state.detail !== null) {
						setState({ detail: { ...state.detail, project: value.project } });
					}
					return value.project;
				},
				bindSession: async (slug, sessionId) => {
					const value = await unwrap(projectsNs().bindSession(slug, sessionId));
					await refresh();
					if (state.currentSlug === slug && state.detail !== null) {
						setState({ detail: { ...state.detail, project: value.project } });
					}
					return value.project;
				}
			};
		}
		/** ContentWorkflows client service: run/advanceStage. */
		function createWorkflowsService(ctx) {
			return {
				run: async (slug, action) => unwrap(namespace(ctx, "contentWorkflows").run(slug, action)),
				advanceStage: async (slug, stage) => {
					const value = await unwrap(namespace(ctx, "contentWorkflows").advanceStage(slug, stage));
					return value.project;
				}
			};
		}
		/** ContentIntelligence client service: critic/critique/knowledgePlan/styleRules/status. */
		function createIntelligenceService(ctx) {
			const ns = () => namespace(ctx, "contentIntelligence");
			return {
				critic: async (slug) => unwrap(ns().critic(slug)),
				critique: async (slug) => unwrap(ns().critique(slug)),
				knowledgePlan: async (task) => unwrap(ns().knowledgePlan(task)),
				styleRules: async () => unwrap(ns().styleRules()),
				status: async () => unwrap(ns().status())
			};
		}

		// ────────────────────────────────────────────────────────────────────
		// Section B — Workbench UI (Dashboard / ProjectDetail / Critic).
		// Migrated verbatim from the Phase 1–4 product layer; self-contained.
		// ────────────────────────────────────────────────────────────────────
				//#region maomao: creator dashboard (Phase 1 product layer)
		const cssMaomaoDash = ".mxDashRoot{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:28px 24px 148px}.mxDashInner{width:100%;max-width:var(--dsh-composer-card-max-width);margin:0 auto;flex-direction:column;gap:22px;display:flex}.mxGreet{flex-direction:column;gap:4px;display:flex}.mxGreetTitle{font-size:24px;font-weight:600;line-height:32px}.mxGreetSub{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.mxSection{flex-direction:column;gap:10px;display:flex}.mxSectionTitle{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:600;letter-spacing:.04em}.mxTodayCard{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:16px;padding:14px 16px;gap:14px;align-items:center;display:flex}.mxTodayDate{font-size:15px;font-weight:600;flex:none}.mxTodayText{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;flex:1;min-width:0}.mxActionBtn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:12px;gap:10px;align-items:center;padding:12px 14px;font-size:13.5px;font-weight:500;line-height:20px;text-align:left;display:flex;font-family:inherit}.mxActionBtn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}.mxActionIcon{color:var(--dsw-alias-state-business-primary);flex:none}.mxGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;display:grid}.mxSeriesRow{flex-wrap:wrap;gap:6px;display:flex}.mxSeriesChip{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:999px;padding:4px 12px;font-size:12.5px;line-height:18px;font-family:inherit}.mxSeriesChip:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxPipeline{flex-wrap:wrap;gap:6px;align-items:center;display:flex}.mxStage{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:999px;padding:4px 10px;font-size:12px;line-height:18px;font-family:inherit}.mxStageArrow{color:var(--dsw-alias-label-caption);font-size:12px}.mxNote{color:var(--dsw-alias-label-caption);font-size:12px;line-height:18px}";
		var MaomaoDashboard_module_css_default = {
			"root": "mxDashRoot",
			"inner": "mxDashInner",
			"greet": "mxGreet",
			"greetTitle": "mxGreetTitle",
			"greetSub": "mxGreetSub",
			"section": "mxSection",
			"sectionTitle": "mxSectionTitle",
			"todayCard": "mxTodayCard",
			"todayDate": "mxTodayDate",
			"todayText": "mxTodayText",
			"actionBtn": "mxActionBtn",
			"actionIcon": "mxActionIcon",
			"grid": "mxGrid",
			"seriesRow": "mxSeriesRow",
			"seriesChip": "mxSeriesChip",
			"pipeline": "mxPipeline",
			"stage": "mxStage",
			"stageArrow": "mxStageArrow",
			"note": "mxNote"
		};
		/** Quick actions: prefill the composer with a scoped creator prompt. */
		const MAOMAO_QUICK_ACTIONS = [
			{ id: "topic", label: "找今天的选题", icon: "IconSparkle16", prompt: "找今天的选题：结合我的内容系列（商业观察 / 公司研究 / 投资系统 / 经济观察 / AI · 技术），用选题评分表挑出今天最值得做的 1–3 个选题，说明核心矛盾与切入角度。" },
			{ id: "research", label: "深度研究", icon: "IconThinkOutline14", workflow: "research", prompt: "深度研究：按内容项目流程执行深度调研，产出 research.md（关键数据、信源清单、反方证据）。" },
			{ id: "thesis", label: "生成观点", icon: "IconEnhanceOutline16", workflow: "thesis", prompt: "生成观点：基于已调研材料提炼核心 thesis —— 一句话主张 + 支撑证据 + 反方观点与回应。" },
			{ id: "xhs", label: "写小红书", icon: "IconListPenOutline16", workflow: "draft", prompt: "做成小红书：把 thesis/draft 素材写成可直接发布的小红书文字版（标题×3、正文 400–800 字、话题标签 5–8 个），遵循毛毛星语感。" },
			{ id: "canva", label: "生成 Canva", icon: "IconProjectAddOutline16", prompt: "做图文：输出页面级 Canva 图文结构（封面→内容页→结尾页，3:4 画布），每页含文案、版式与视觉要点。" },
			{ id: "publish", label: "发布检查", icon: "IconChecklistOutline14", workflow: "publish-check", prompt: "检查一下：执行发布前检查（事实、标题、可读性、判断质量、空话与合规），逐项 PASS/FAIL 并给出修改建议。" }
		];
		/** Pipeline stages of one content project. */
		const MAOMAO_PIPELINE_STAGES = ["选题", "核心问题", "核心矛盾", "Research", "Facts", "Thesis", "Draft", "Canva", "Publish"];
		/** Content series chips on the dashboard. */
		const MAOMAO_DASH_SERIES = ["商业观察", "公司研究", "投资系统", "经济观察", "AI / 技术"];
		/** Creator homepage: today's topics + quick actions + series + project pipeline. */
		function MaomaoDashboard({ t, cp, state }) {
			const [createOpen, setCreateOpen] = (0, react.useState)(false);
			const [dashNote, setDashNote] = (0, react.useState)(null);
			const d = new Date();
			const todayPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			const todayProjects = state !== null && Array.isArray(state?.projects) ? state.projects.filter((p) => p.createdAt.startsWith(todayPrefix)) : [];
			const runAction = (prompt) => {
				try {
					window.dispatchEvent(new CustomEvent("maomao:action", { detail: { prompt } }));
				} catch (e) {
				}
			};
			/** Phase 3: project actions run through the workflow engine (not fillComposer). */
			const runProjectAction = (action) => {
				if (cp === void 0 || state === null || state.currentSlug === null) {
					setDashNote("请先打开或创建一个内容项目，再执行该动作（左侧「内容项目」列表）。");
					return;
				}
				const wf = window.__maomaoContentWorkflows;
				if (wf === void 0) {
					setDashNote("工作流服务未就绪：重启 dsh web 后生效。");
					return;
				}
				setDashNote(null);
				wf.run(state.currentSlug, action).then(() => {
					setDashNote("动作已启动，正在执行… 可在项目页查看进度。");
				}).catch((reason) => {
					setDashNote(reason instanceof Error ? reason.message : String(reason));
				});
			};
			(0, react.useEffect)(() => {
				const onNav = (event) => {
					const view = event.detail?.view;
					if (view === void 0) return;
					const target = view === "today" ? "dash-today" : "dash-pipeline";
					const el = document.getElementById(target);
					if (el !== null) el.scrollIntoView({ behavior: "smooth", block: "start" });
				};
				window.addEventListener("maomao:nav", onNav);
				return () => window.removeEventListener("maomao:nav", onNav);
			}, []);
			const dateLine = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
			const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
			const iconOf = (name) => {
				const icons = {
					"IconSparkle16": _deepseek_ai_dsh_client_ui_primitives.IconSparkle16,
					"IconThinkOutline14": _deepseek_ai_dsh_client_ui_primitives.IconThinkOutline14,
					"IconEnhanceOutline16": _deepseek_ai_dsh_client_ui_primitives.IconEnhanceOutline16,
					"IconListPenOutline16": _deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16,
					"IconProjectAddOutline16": _deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutline16,
					"IconChecklistOutline14": _deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14
				};
				return icons[name] ?? void 0;
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MaomaoDashboard_module_css_default.root,
				"data-maomao-dashboard": "",
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MaomaoDashboard_module_css_default.inner,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: MaomaoDashboard_module_css_default.greet,
							children: [
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.greetTitle,
									children: "你好，毛毛星 👋"
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.greetSub,
									children: `今天是 ${dateLine} · ${weekday} · 这是你的内容创作台。`
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("section", {
							id: "dash-today",
							className: MaomaoDashboard_module_css_default.section,
							children: [
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.sectionTitle,
									children: "今日选题"
								}),
								cp === void 0 || state === null ? (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.note,
									children: "内容项目服务未就绪：重启 dsh web 后刷新即可启用（Phase 2 插件尚未挂载）。"
								}) : todayProjects.length === 0 ? (0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoDashboard_module_css_default.todayCard,
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoDashboard_module_css_default.todayDate,
											children: dateLine
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoDashboard_module_css_default.todayText,
											children: "还没有今日选题。让 Agent 找选题，或直接创建一个内容项目。"
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: MaomaoDashboard_module_css_default.actionBtn,
											onClick: () => runAction(MAOMAO_QUICK_ACTIONS[0].prompt),
											children: "找今天的选题"
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: MaomaoDashboard_module_css_default.actionBtn,
											onClick: () => setCreateOpen(true),
											children: "创建内容项目"
										})
									]
								}) : (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoProject_module_css_default.todayList,
									children: todayProjects.map((p) => (0, react_jsx_runtime.jsxs)("div", {
										className: MaomaoProject_module_css_default.todayRow,
										children: [
											(0, react_jsx_runtime.jsxs)("div", {
												className: MaomaoProject_module_css_default.todayRowMain,
												children: [
													(0, react_jsx_runtime.jsx)("div", {
														className: MaomaoProject_module_css_default.todayRowTitle,
														children: p.title
													}),
													(0, react_jsx_runtime.jsxs)("div", {
														className: MaomaoProject_module_css_default.todayRowMeta,
														children: [
															(0, react_jsx_runtime.jsx)("span", { children: p.series }),
															(0, react_jsx_runtime.jsx)("span", { children: MAOMAO_STATUS_LABELS[p.status] ?? p.status }),
															(0, react_jsx_runtime.jsx)("span", { children: MAOMAO_STAGE_LABELS[p.stage] ?? p.stage })
														]
													})
												]
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: MaomaoProject_module_css_default.todayOpen,
												onClick: () => {
													cp.open(p.slug).catch(() => {
													});
												},
												children: "打开"
											})
										]
									}, p.slug))
								}),
								createOpen && (0, react_jsx_runtime.jsx)(CreateProjectModal, {
									cp,
									onClose: () => setCreateOpen(false)
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("section", {
							id: "dash-actions",
							className: MaomaoDashboard_module_css_default.section,
							children: [
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.sectionTitle,
									children: "快捷动作"
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.grid,
									children: MAOMAO_QUICK_ACTIONS.map((action) => (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: MaomaoDashboard_module_css_default.actionBtn,
										onClick: () => {
											if (action.workflow !== void 0) runProjectAction(action.workflow);
											else runAction(action.prompt);
										},
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: MaomaoDashboard_module_css_default.actionIcon,
												children: iconOf(action.icon) === void 0 ? null : (0, react_jsx_runtime.jsx)(iconOf(action.icon), { size: 16 })
											}),
											(0, react_jsx_runtime.jsx)("span", { children: action.label })
										]
									}, action.id))
								}),
								dashNote !== null && (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfNote,
									children: dashNote
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("section", {
							id: "dash-series",
							className: MaomaoDashboard_module_css_default.section,
							children: [
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.sectionTitle,
									children: "内容系列"
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.seriesRow,
									children: MAOMAO_DASH_SERIES.map((name) => (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: MaomaoDashboard_module_css_default.seriesChip,
										onClick: () => runAction(`找今天的选题（系列：${name}）：用选题评分表挑出今天最值得做的 1–3 个选题，说明核心矛盾与切入角度。`),
										children: name
									}, name))
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("section", {
							id: "dash-pipeline",
							className: MaomaoDashboard_module_css_default.section,
							children: [
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.sectionTitle,
									children: "内容项目管线"
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.pipeline,
									children: MAOMAO_PIPELINE_STAGES.map((stage, i) => (0, react_jsx_runtime.jsxs)(react.Fragment, {
										children: [
											i > 0 && (0, react_jsx_runtime.jsx)("span", {
												className: MaomaoDashboard_module_css_default.stageArrow,
												children: "→"
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: MaomaoDashboard_module_css_default.stage,
												children: stage
											})
										]
									}, stage))
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoDashboard_module_css_default.note,
									children: "每个内容项目按此管线推进：选题 → 核心问题 → 核心矛盾 → Research → Facts → Thesis → Draft → Canva → Publish。Phase 2 接入 projects/<slug>/status.json 后自动驱动进度。"
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region maomao: content project detail (Phase 2 product layer)
		const cssMaomaoProj = ".mxProjRoot{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable;padding:24px 24px 148px}.mxProjInner{width:100%;max-width:var(--dsh-composer-card-max-width);margin:0 auto;flex-direction:column;gap:18px;display:flex}.mxProjHeader{flex-direction:column;gap:10px;display:flex}.mxProjTop{flex-direction:row;gap:10px;align-items:center;display:flex}.mxProjBack{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;padding:4px 8px;font-size:13px;font-family:inherit}.mxProjBack:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxProjTitle{font-size:22px;font-weight:600;line-height:30px;flex:1;min-width:0}.mxProjChip{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:2px 10px;font-size:12px;flex:none}.mxProjSelect{background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:8px;padding:4px 8px;font-size:12.5px;font-family:inherit}.mxProjStages{flex-wrap:wrap;gap:6px;align-items:center;display:flex}.mxProjStage{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:999px;padding:4px 10px;font-size:12px;line-height:18px;font-family:inherit}.mxProjStage:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxProjStage[data-active]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary)}.mxProjMeta{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;display:grid}.mxProjMetaCard{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:12px;padding:10px 12px;flex-direction:column;gap:4px;display:flex}.mxProjMetaLabel{color:var(--dsw-alias-label-caption);font-size:11.5px}.mxProjMetaValue{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}.mxProjTabs{gap:4px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex}.mxProjTab{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-bottom:2px solid transparent;padding:6px 12px;font-size:13px;font-weight:500;font-family:inherit}.mxProjTab[data-active]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-state-business-primary)}.mxProjBody{flex-direction:column;gap:10px;display:flex}.mxProjField{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:12px;padding:10px 12px;gap:10px;align-items:flex-start;display:flex}.mxProjFieldKey{color:var(--dsw-alias-label-caption);font-size:12px;flex:none;width:90px}.mxProjFieldVal{font-size:13px;line-height:20px;min-width:0;overflow-wrap:anywhere}.mxProjTextarea{box-sizing:border-box;width:100%;min-height:320px;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:12px;padding:12px;font-size:13px;line-height:20px;font-family:var(--ds-font-family-code);resize:vertical}.mxProjSave{align-self:flex-start;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:500;font-family:inherit}.mxProjSave:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxProjSave[disabled]{opacity:.5;cursor:default}.mxProjSaved{color:var(--dsw-alias-state-success-primary);font-size:12px}.mxProjError{color:var(--dsw-alias-state-error-primary);font-size:12px}.mxTodayList{flex-direction:column;gap:8px;display:flex}.mxTodayRow{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:12px;padding:10px 14px;gap:12px;align-items:center;display:flex}.mxTodayRowMain{flex:1;min-width:0;flex-direction:column;gap:4px;display:flex}.mxTodayRowTitle{font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.mxTodayRowMeta{color:var(--dsw-alias-label-caption);font-size:12px;gap:10px;display:flex}.mxTodayOpen{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-state-business-primary);cursor:pointer;background:0 0;border-radius:8px;padding:4px 12px;font-size:12.5px;font-family:inherit;flex:none}.mxTodayOpen:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxModalBackdrop{position:fixed;inset:0;z-index:60;background:rgb(0 0 0/.4);align-items:center;justify-content:center;display:flex}.mxModal{width:min(480px,calc(100vw - 48px));background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:16px;padding:20px;flex-direction:column;gap:12px;display:flex;box-shadow:var(--dsw-shadow-lv2)}.mxModalTitle{font-size:16px;font-weight:600}.mxField{flex-direction:column;gap:4px;display:flex}.mxFieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px}.mxInput{box-sizing:border-box;width:100%;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit}.mxModalActions{justify-content:flex-end;gap:8px;display:flex}";
		var MaomaoProject_module_css_default = {
			"projRoot": "mxProjRoot",
			"projInner": "mxProjInner",
			"projHeader": "mxProjHeader",
			"projTop": "mxProjTop",
			"projBack": "mxProjBack",
			"projTitle": "mxProjTitle",
			"projChip": "mxProjChip",
			"projSelect": "mxProjSelect",
			"projStages": "mxProjStages",
			"projStage": "mxProjStage",
			"projMeta": "mxProjMeta",
			"projMetaCard": "mxProjMetaCard",
			"projMetaLabel": "mxProjMetaLabel",
			"projMetaValue": "mxProjMetaValue",
			"projTabs": "mxProjTabs",
			"projTab": "mxProjTab",
			"projBody": "mxProjBody",
			"projField": "mxProjField",
			"projFieldKey": "mxProjFieldKey",
			"projFieldVal": "mxProjFieldVal",
			"projTextarea": "mxProjTextarea",
			"projSave": "mxProjSave",
			"projSaved": "mxProjSaved",
			"projError": "mxProjError",
			"todayList": "mxTodayList",
			"todayRow": "mxTodayRow",
			"todayRowMain": "mxTodayRowMain",
			"todayRowTitle": "mxTodayRowTitle",
			"todayRowMeta": "mxTodayRowMeta",
			"todayOpen": "mxTodayOpen",
			"modalBackdrop": "mxModalBackdrop",
			"modal": "mxModal",
			"modalTitle": "mxModalTitle",
			"field": "mxField",
			"fieldLabel": "mxFieldLabel",
			"input": "mxInput",
			"modalActions": "mxModalActions"
		};
		/** Chinese labels for the project statuses. */
		const MAOMAO_STATUS_LABELS = {
			"idea": "构思",
			"researching": "调研中",
			"draft": "草稿",
			"ready": "待发布",
			"published": "已发布",
			"archived": "已归档"
		};
		/** Chinese labels for the pipeline stages. */
		const MAOMAO_STAGE_LABELS = {
			"topic": "选题",
			"question": "核心问题",
			"conflict": "核心矛盾",
			"research": "Research",
			"facts": "Facts",
			"thesis": "Thesis",
			"draft": "Draft",
			"canva": "Canva",
			"publish": "Publish"
		};
		/** Detail tabs: overview + one tab per artifact file. */
		const MAOMAO_DETAIL_TABS = [
			{ id: "overview", label: "概览" },
			{ id: "research", label: "Research", file: "research.md" },
			{ id: "facts", label: "Facts", file: "facts.md" },
			{ id: "thesis", label: "Thesis", file: "thesis.md" },
			{ id: "draft", label: "Draft", file: "draft.md" },
			{ id: "canva", label: "Canva", file: "carousel.md" },
			{ id: "publish", label: "Publish", file: "publish.md" },
			{ id: "critique", label: "Critique" }
		];
		/** Phase-3 workflow actions shown on the Detail page. */
		const MAOMAO_WORKFLOW_ACTIONS = [
			{ action: "research", label: "深度研究" },
			{ action: "facts", label: "事实核查" },
			{ action: "thesis", label: "生成观点" },
			{ action: "draft", label: "写小红书" },
			{ action: "publish-check", label: "发布检查" }
		];
		/** action → Detail tab to auto-switch to after success. */
		const MAOMAO_TAB_OF_ACTION = {
			"research": "research",
			"facts": "facts",
			"thesis": "thesis",
			"draft": "draft",
			"publish-check": "publish"
		};
		/** action → user label. */
		const MAOMAO_ACTION_LABELS = {
			"research": "深度研究",
			"facts": "事实核查",
			"thesis": "生成观点",
			"draft": "写小红书",
			"publish-check": "发布检查"
		};
		/** Phase-3 workflow action-run CSS (MaomaoWorkflow module). */
		const cssMaomaoWf = ".mxWfSection{flex-direction:column;gap:8px;display:flex}.mxWfTitle{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:600;letter-spacing:.04em}.mxWfRow{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:12px;padding:10px 12px;gap:10px;align-items:center;display:flex}.mxWfDot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-border-l3);flex:none}.mxWfRow[data-running] .mxWfDot{background:var(--dsw-alias-state-business-primary);animation:mxWfPulse 1s ease-in-out infinite alternate}@keyframes mxWfPulse{0%{opacity:.3}to{opacity:1}}.mxWfRow[data-success] .mxWfDot{background:var(--dsw-alias-state-success-primary)}.mxWfRow[data-failed] .mxWfDot{background:var(--dsw-alias-state-error-primary)}.mxWfLabel{flex:1;font-size:13.5px;font-weight:500;min-width:0}.mxWfStatus{color:var(--dsw-alias-label-caption);font-size:12px}.mxWfBtn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:8px;padding:4px 12px;font-size:12.5px;font-family:inherit;flex:none}.mxWfBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxWfBtn[disabled]{opacity:.5;cursor:default}.mxWfNote{color:var(--dsw-alias-label-caption);font-size:12px;line-height:18px}.mxWfErr{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}.mxWfOk{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}";
		var MaomaoWorkflow_module_css_default = {
			"wfSection": "mxWfSection",
			"wfTitle": "mxWfTitle",
			"wfRow": "mxWfRow",
			"wfDot": "mxWfDot",
			"wfLabel": "mxWfLabel",
			"wfStatus": "mxWfStatus",
			"wfBtn": "mxWfBtn",
			"wfNote": "mxWfNote",
			"wfErr": "mxWfErr",
			"wfOk": "mxWfOk"
		};
		/** Create-project modal: fields → host create() → opens the new project. */
		function CreateProjectModal({ cp, onClose }) {
			const [title, setTitle] = (0, react.useState)("");
			const [series, setSeries] = (0, react.useState)(MAOMAO_DASH_SERIES[0]);
			const [coreQuestion, setCoreQuestion] = (0, react.useState)("");
			const [coreConflict, setCoreConflict] = (0, react.useState)("");
			const [angle, setAngle] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const field = (label, control) => (0, react_jsx_runtime.jsxs)("label", {
				className: MaomaoProject_module_css_default.field,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: MaomaoProject_module_css_default.fieldLabel,
						children: label
					}),
					control
				]
			});
			const submit = () => {
				if (busy || title.trim() === "") return;
				setBusy(true);
				setError(null);
				cp.create({
					title: title.trim(),
					series,
					coreQuestion: coreQuestion.trim(),
					coreConflict: coreConflict.trim(),
					angle: angle.trim()
				}).then(onClose).catch((reason) => {
					setBusy(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MaomaoProject_module_css_default.modalBackdrop,
				onClick: (event) => {
					if (event.target === event.currentTarget && !busy) onClose();
				},
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MaomaoProject_module_css_default.modal,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: MaomaoProject_module_css_default.modalTitle,
							children: "创建内容项目"
						}),
						field("标题 *", (0, react_jsx_runtime.jsx)("input", {
							className: MaomaoProject_module_css_default.input,
							value: title,
							placeholder: "例如：伯克希尔为什么开始买股票",
							onChange: (e) => setTitle(e.target.value)
						})),
						field("系列", (0, react_jsx_runtime.jsx)("select", {
							className: MaomaoProject_module_css_default.input,
							value: series,
							onChange: (e) => setSeries(e.target.value),
							children: MAOMAO_DASH_SERIES.map((option) => (0, react_jsx_runtime.jsx)("option", {
								value: option,
								children: option
							}, option))
						})),
						field("核心问题", (0, react_jsx_runtime.jsx)("input", {
							className: MaomaoProject_module_css_default.input,
							value: coreQuestion,
							placeholder: "这个选题要回答什么问题？",
							onChange: (e) => setCoreQuestion(e.target.value)
						})),
						field("核心矛盾", (0, react_jsx_runtime.jsx)("input", {
							className: MaomaoProject_module_css_default.input,
							value: coreConflict,
							placeholder: "张力在哪里？",
							onChange: (e) => setCoreConflict(e.target.value)
						})),
						field("切入角度", (0, react_jsx_runtime.jsx)("input", {
							className: MaomaoProject_module_css_default.input,
							value: angle,
							placeholder: "从哪个角度切入？",
							onChange: (e) => setAngle(e.target.value)
						})),
						error !== null && (0, react_jsx_runtime.jsx)("div", {
							className: MaomaoProject_module_css_default.projError,
							children: error
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: MaomaoProject_module_css_default.modalActions,
							children: [
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: MaomaoProject_module_css_default.projSave,
									disabled: busy,
									onClick: onClose,
									children: "取消"
								}),
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: MaomaoProject_module_css_default.projSave,
									disabled: busy || title.trim() === "",
									onClick: submit,
									children: busy ? "创建中…" : "创建"
								})
							]
						})
					]
				})]
			});
		}
		/** Content Project Detail: reads real workspace files; persists status/stage to project.json. */
		function ProjectDetail({ cp, state }) {
			const project = state.detail.project;
			const files = state.detail.files;
			const [tab, setTab] = (0, react.useState)("overview");
			const [drafts, setDrafts] = (0, react.useState)({});
			const [busy, setBusy] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const wf = window.__maomaoContentWorkflows;
			const ci = window.__maomaoContentIntelligence;
			const [critiqueState, setCritiqueState] = (0, react.useState)({ run: null, critique: null });
			const [criticNote, setCriticNote] = (0, react.useState)(null);
			const [criticPolling, setCriticPolling] = (0, react.useState)(false);
			const criticPollRef = (0, react.useRef)(null);
			const [stageError, setStageError] = (0, react.useState)(null);
			const [actionNote, setActionNote] = (0, react.useState)(null);
			const [polling, setPolling] = (0, react.useState)(false);
			const pollRef = (0, react.useRef)(null);
			const workflow = project.workflow ?? {};
			(0, react.useEffect)(() => () => {
				if (pollRef.current !== null) window.clearInterval(pollRef.current);
				if (criticPollRef.current !== null) window.clearInterval(criticPollRef.current);
			}, []);
			/** Poll project.workflow until the run leaves "running", then refresh the tab. */
			const startPolling = (action) => {
				if (pollRef.current !== null) window.clearInterval(pollRef.current);
				setPolling(true);
				const tick = () => {
					cp.reload().then((value) => {
						const w = value?.project?.workflow ?? {};
						const rec = w[action];
						if (rec === void 0 || rec.status === "running") return;
						if (pollRef.current !== null) {
							window.clearInterval(pollRef.current);
							pollRef.current = null;
						}
						setPolling(false);
						if (rec.status === "success") {
							setActionNote(`✓ ${MAOMAO_ACTION_LABELS[action] ?? action} 已更新`);
							const targetTab = MAOMAO_TAB_OF_ACTION[action];
							if (targetTab !== void 0) setTab(targetTab);
						} else {
							setActionNote(`✗ ${MAOMAO_ACTION_LABELS[action] ?? action} 失败：${rec.error ?? "未知错误"}`);
						}
					}).catch(() => {
					});
				};
				pollRef.current = window.setInterval(tick, 2000);
				tick();
			};
			/** Run one workflow action against the project (Phase 3: run(), not fillComposer). */
			const runWorkflowAction = (action) => {
				if (wf === void 0) {
					setActionNote("工作流服务未就绪：重启 dsh web 后生效。");
					return;
				}
				const rec = workflow[action];
				if (rec?.status === "running") return;
				setActionNote(null);
				setStageError(null);
				wf.run(project.slug, action).then(() => startPolling(action)).catch((reason) => {
					setActionNote(`✗ ${MAOMAO_ACTION_LABELS[action] ?? action} 无法启动：${reason instanceof Error ? reason.message : String(reason)}`);
				});
			};
			/** Phase-4 Critic: read run state + parsed critique (score/issues/suggestions). */
			const refreshCritique = () => {
				if (ci === void 0) return Promise.resolve(null);
				return ci.critique(project.slug).then((value) => {
					setCritiqueState(value);
					return value;
				}).catch(() => null);
			};
			/** Poll critique state until the critic run leaves "running", then switch to the Critique tab. */
			const startCriticPolling = () => {
				if (criticPollRef.current !== null) window.clearInterval(criticPollRef.current);
				setCriticPolling(true);
				const tick = () => {
					refreshCritique().then((value) => {
						const rec = value?.run ?? null;
						if (rec === null || rec.status === "running") return;
						if (criticPollRef.current !== null) {
							window.clearInterval(criticPollRef.current);
							criticPollRef.current = null;
						}
						setCriticPolling(false);
						if (rec.status === "success") {
							setCriticNote("✓ 内容质量检查完成，已生成 critique.md");
							setTab("critique");
						} else {
							setCriticNote(`✗ 内容质量检查失败：${rec.error ?? "未知错误"}`);
						}
					}).catch(() => {
					});
				};
				criticPollRef.current = window.setInterval(tick, 2000);
				tick();
			};
			/** Run the Critic agent against draft.md (Phase 4: 只审查，不重写). */
			const runCritic = () => {
				if (ci === void 0) {
					setCriticNote("内容智能服务未就绪：重启 dsh web 后生效。");
					return;
				}
				const rec = critiqueState.run ?? null;
				if (rec !== null && rec.status === "running") return;
				setCriticNote(null);
				ci.critic(project.slug).then(() => {
					refreshCritique();
					startCriticPolling();
				}).catch((reason) => {
					setCriticNote(`✗ 内容质量检查无法启动：${reason instanceof Error ? reason.message : String(reason)}`);
				});
			};
			(0, react.useEffect)(() => {
				refreshCritique();
			}, []);
			const active = MAOMAO_DETAIL_TABS.find((entry) => entry.id === tab) ?? MAOMAO_DETAIL_TABS[0];
			const file = active.file;
			const content = file === void 0 ? null : drafts[file] ?? files[file] ?? "";
			const saveFile = () => {
				if (file === void 0 || drafts[file] === void 0 || busy) return;
				setBusy(true);
				setError(null);
				cp.writeFile(project.slug, file, drafts[file]).then(() => {
					setBusy(false);
					setDrafts((prev) => {
						const next = { ...prev };
						delete next[file];
						return next;
					});
					setSaved(true);
					window.setTimeout(() => setSaved(false), 1500);
				}).catch((reason) => {
					setBusy(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const setStatus = (status) => {
				cp.updateStatus(project.slug, { status }).catch(() => {
				});
			};
			const setStage = (stage) => {
				if (wf === void 0) {
					setStageError("工作流服务未就绪：重启 dsh web 后生效。");
					return;
				}
				if (stage === project.stage) return;
				setStageError(null);
				wf.advanceStage(project.slug, stage).then(() => cp.reload()).catch((reason) => {
					setStageError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MaomaoProject_module_css_default.projRoot,
				"data-maomao-project": "",
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MaomaoProject_module_css_default.projInner,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: MaomaoProject_module_css_default.projHeader,
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoProject_module_css_default.projTop,
									children: [
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: MaomaoProject_module_css_default.projBack,
											onClick: () => cp.close(),
											children: "← 工作台"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projTitle,
											children: project.title
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: MaomaoProject_module_css_default.projChip,
											children: project.series
										}),
										(0, react_jsx_runtime.jsx)("select", {
											className: MaomaoProject_module_css_default.projSelect,
											value: project.status,
											"aria-label": "项目状态",
											onChange: (e) => setStatus(e.target.value),
											children: Object.keys(MAOMAO_STATUS_LABELS).map((status) => (0, react_jsx_runtime.jsx)("option", {
												value: status,
												children: MAOMAO_STATUS_LABELS[status]
											}, status))
										})
									]
								}),
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoProject_module_css_default.projStages,
									children: MAOMAO_PIPELINE_STAGES.map((stage) => (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: MaomaoProject_module_css_default.projStage,
										"data-active": project.stage === stage || void 0,
										onClick: () => setStage(stage),
										children: stage
									}, stage))
								}),
								stageError !== null && (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfErr,
									children: stageError
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: MaomaoProject_module_css_default.projMeta,
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoProject_module_css_default.projMetaCard,
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projMetaLabel,
											children: "核心问题"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projMetaValue,
											children: project.coreQuestion || "—"
										})
									]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoProject_module_css_default.projMetaCard,
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projMetaLabel,
											children: "核心矛盾"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projMetaValue,
											children: project.coreConflict || "—"
										})
									]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoProject_module_css_default.projMetaCard,
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projMetaLabel,
											children: "切入角度"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projMetaValue,
											children: project.angle || "—"
										})
									]
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("section", {
							className: MaomaoWorkflow_module_css_default.wfSection,
							children: [
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfTitle,
									children: "执行动作"
								}),
								MAOMAO_WORKFLOW_ACTIONS.map((entry) => {
									const rec = workflow[entry.action] ?? {};
									const running = rec.status === "running";
									return (0, react_jsx_runtime.jsxs)("div", {
										className: MaomaoWorkflow_module_css_default.wfRow,
										"data-running": running || void 0,
										"data-success": rec.status === "success" || void 0,
										"data-failed": rec.status === "failed" || void 0,
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: MaomaoWorkflow_module_css_default.wfDot
											}),
											(0, react_jsx_runtime.jsx)("div", {
												className: MaomaoWorkflow_module_css_default.wfLabel,
												children: entry.label
											}),
											(0, react_jsx_runtime.jsx)("div", {
												className: MaomaoWorkflow_module_css_default.wfStatus,
												children: running ? "● 正在执行…" : rec.status === "success" ? "✓ 已更新" : rec.status === "failed" ? `✗ ${rec.error ?? "失败"}` : ""
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: MaomaoWorkflow_module_css_default.wfBtn,
												disabled: running || polling,
												onClick: () => runWorkflowAction(entry.action),
												children: running ? "执行中" : "执行"
											})
										]
									}, entry.action);
								}),
								actionNote !== null && (0, react_jsx_runtime.jsx)("div", {
									className: actionNote.startsWith("✓") ? MaomaoWorkflow_module_css_default.wfOk : MaomaoWorkflow_module_css_default.wfErr,
									children: actionNote
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("section", {
							className: MaomaoWorkflow_module_css_default.wfSection,
							children: [
								(0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfTitle,
									children: "内容质量检查（Critic）"
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoWorkflow_module_css_default.wfRow,
									"data-running": critiqueState.run !== null && critiqueState.run.status === "running" || void 0,
									"data-success": critiqueState.run !== null && critiqueState.run.status === "success" || void 0,
									"data-failed": critiqueState.run !== null && critiqueState.run.status === "failed" || void 0,
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: MaomaoWorkflow_module_css_default.wfDot
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoWorkflow_module_css_default.wfLabel,
											children: "Critic 审查 draft.md（只审查，不重写）"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoWorkflow_module_css_default.wfStatus,
											children: critiqueState.run === null ? "未检查" : critiqueState.run.status === "running" ? "● 正在审查…" : critiqueState.run.status === "success" ? "✓ 已生成 critique.md" : `✗ ${critiqueState.run.error ?? "失败"}`
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: MaomaoWorkflow_module_css_default.wfBtn,
											disabled: critiqueState.run !== null && critiqueState.run.status === "running" || criticPolling,
											onClick: runCritic,
											children: critiqueState.run !== null && critiqueState.run.status === "running" ? "审查中" : "开始检查"
										})
									]
								}),
								critiqueState.critique !== null && critiqueState.critique.score !== null && (0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoWorkflow_module_css_default.wfRow,
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: MaomaoWorkflow_module_css_default.wfDot
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoWorkflow_module_css_default.wfLabel,
											children: `评分：${critiqueState.critique.score} / 100`
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoWorkflow_module_css_default.wfStatus,
											children: critiqueState.critique.score >= 85 ? "可直接发布" : critiqueState.critique.score >= 70 ? "需小改" : "需重写关键部分"
										})
									]
								}),
								critiqueState.critique !== null && critiqueState.critique.issues.length > 0 && (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfNote,
									children: "问题："
								}),
								critiqueState.critique !== null && critiqueState.critique.issues.map((issue) => (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfNote,
									children: `• ${issue}`
								}, issue)),
								critiqueState.critique !== null && critiqueState.critique.suggestions.length > 0 && (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfNote,
									children: "建议："
								}),
								critiqueState.critique !== null && critiqueState.critique.suggestions.map((suggestion) => (0, react_jsx_runtime.jsx)("div", {
									className: MaomaoWorkflow_module_css_default.wfNote,
									children: `• ${suggestion}`
								}, suggestion)),
								criticNote !== null && (0, react_jsx_runtime.jsx)("div", {
									className: criticNote.startsWith("✓") ? MaomaoWorkflow_module_css_default.wfOk : MaomaoWorkflow_module_css_default.wfErr,
									children: criticNote
								})
							]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: MaomaoProject_module_css_default.projTabs,
							children: MAOMAO_DETAIL_TABS.map((entry) => (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: MaomaoProject_module_css_default.projTab,
								"data-active": entry.id === tab || void 0,
								onClick: () => setTab(entry.id),
								children: entry.label
							}, entry.id))
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: MaomaoProject_module_css_default.projBody,
							children: [
								active.id === "critique" ? (0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoProject_module_css_default.projBody,
									children: [
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoWorkflow_module_css_default.wfNote,
											children: "critique.md 由「内容质量检查」生成，只读展示；Critic 不修改草稿。"
										}),
										(0, react_jsx_runtime.jsx)("div", {
											className: MaomaoProject_module_css_default.projTextarea,
											style: { whiteSpace: "pre-wrap", overflowWrap: "break-word", minHeight: "320px" },
											children: critiqueState.critique !== null ? critiqueState.critique.raw || "（暂无内容）" : "（尚未运行内容质量检查）"
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: MaomaoProject_module_css_default.projSave,
											onClick: () => refreshCritique(),
											children: "刷新"
										})
									]
								}) : file === void 0 ? (0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoProject_module_css_default.projBody,
									children: [
										overviewField("ID", project.id),
										overviewField("标题", project.title),
										overviewField("Slug", project.slug),
										overviewField("系列", project.series),
										overviewField("状态", MAOMAO_STATUS_LABELS[project.status] ?? project.status),
										overviewField("阶段", MAOMAO_STAGE_LABELS[project.stage] ?? project.stage),
										overviewField("核心问题", project.coreQuestion || "—"),
										overviewField("核心矛盾", project.coreConflict || "—"),
										overviewField("切入角度", project.angle || "—"),
										overviewField("创建时间", project.createdAt),
										overviewField("更新时间", project.updatedAt)
									]
								}) : (0, react_jsx_runtime.jsxs)("div", {
									className: MaomaoProject_module_css_default.projBody,
									children: [
										(0, react_jsx_runtime.jsx)("textarea", {
											className: MaomaoProject_module_css_default.projTextarea,
											value: content,
											onChange: (e) => setDrafts((prev) => ({
												...prev,
												[file]: e.target.value
											}))
										}),
										(0, react_jsx_runtime.jsxs)("div", {
											className: MaomaoProject_module_css_default.modalActions,
											children: [
												saved && (0, react_jsx_runtime.jsx)("span", {
													className: MaomaoProject_module_css_default.projSaved,
													children: "已保存 ✓"
												}),
												error !== null && (0, react_jsx_runtime.jsx)("span", {
													className: MaomaoProject_module_css_default.projError,
													children: error
												}),
												(0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: MaomaoProject_module_css_default.projSave,
													disabled: busy || drafts[file] === void 0,
													onClick: saveFile,
													children: busy ? "保存中…" : "保存到文件"
												})
											]
										})
									]
								})
							]
						})
					]
				})]
			});
			function overviewField(key, value) {
				return (0, react_jsx_runtime.jsxs)("div", {
					className: MaomaoProject_module_css_default.projField,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: MaomaoProject_module_css_default.projFieldKey,
							children: key
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: MaomaoProject_module_css_default.projFieldVal,
							children: value
						})
					]
				}, key);
			}
		}
		/** Hero home: project detail when one is open, otherwise the dashboard. */
		function MaomaoHome({ t }) {
			const [state, setState] = (0, react.useState)(() => {
				const cp = window.__maomaoContentProjects;
				return cp === void 0 ? null : cp.getSnapshot();
			});
			(0, react.useEffect)(() => {
				const cp = window.__maomaoContentProjects;
				if (cp === void 0) return;
				const update = () => setState(cp.getSnapshot());
				update();
				return cp.subscribe(update);
			}, []);
			const cp = window.__maomaoContentProjects;
			if (cp !== void 0 && state !== null && state.currentSlug !== null && state.detail !== null) {
				return (0, react_jsx_runtime.jsx)(ProjectDetail, { cp, state });
			}
			return (0, react_jsx_runtime.jsx)(MaomaoDashboard, { t, cp, state });
		}


		// ────────────────────────────────────────────────────────────────────
		// Section C — Workbench surfaces via official Harness slots.
		// conversation.view (workbench tab) · settings.section (settings card)
		// sidebar.footer.action (open button) · shell.overlay (workbench panel)
		// ────────────────────────────────────────────────────────────────────
		/** Extra CSS for the overlay panel and the settings card. */
		const cssMaomaoExtra = ".mxOverlayRoot{position:fixed;inset:0;z-index:40;pointer-events:auto;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}.mxOverlayBar{flex:none;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2)}.mxOverlayTitle{flex:1;font-size:14px;font-weight:600;min-width:0}.mxOverlayClose{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:8px;padding:4px 10px;font-size:13px;font-family:inherit}.mxOverlayClose:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxOverlayBody{flex:1;min-height:0;overflow-y:auto}.mxSetRoot{flex-direction:column;gap:16px;display:flex}.mxSetGroup{flex-direction:column;gap:8px;display:flex}.mxSetGroupTitle{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:600;letter-spacing:.04em}.mxSetRow{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:12px;padding:10px 12px;gap:10px;align-items:center;display:flex}.mxSetRowLabel{flex:1;font-size:13.5px;font-weight:500;min-width:0}.mxSetRowValue{color:var(--dsw-alias-label-caption);font-size:12px;flex:none}.mxSetDot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none}.mxSetDot[data-off]{background:var(--dsw-alias-border-l3)}.mxSetInput{box-sizing:border-box;flex:1;min-width:0;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:8px;padding:7px 10px;font-size:13px;font-family:inherit}.mxSetBtn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:8px;padding:5px 12px;font-size:12.5px;font-family:inherit;flex:none}.mxSetBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxSetBtn[disabled]{opacity:.5;cursor:default}.mxSetNote{color:var(--dsw-alias-label-caption);font-size:12px;line-height:18px}.mxSetChips{flex-wrap:wrap;gap:6px;display:flex}.mxSetChip{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:999px;padding:3px 10px;font-size:12.5px;line-height:18px;font-family:inherit;display:inline-flex;gap:6px;align-items:center}.mxSetChipDel{cursor:pointer;color:var(--dsw-alias-label-caption);font-family:inherit;background:0 0;border:none;font-size:13px;padding:0}";

		/** Tiny module-scope store for the sidebar→overlay toggle. */
		var overlayStore = {
			open: false,
			listeners: /* @__PURE__ */ new Set(),
			subscribe(fn) {
				this.listeners.add(fn);
				return () => this.listeners.delete(fn);
			},
			getSnapshot() {
				return this.open;
			},
			set(open) {
				this.open = !!open;
				for (const fn of [...this.listeners]) {
					try {
						fn();
					} catch (error) {
						console.error("maomao-workbench: overlay listener threw:", error);
					}
				}
			}
		};
		/** Module-scope settings scope (bound in apply). */
		var workbenchScope = null;

		/** Settings card page (settings.section entry). */
		function WorkbenchSettingsSection({ close }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [settings, setSettings] = (0, react.useState)(null);
			const [workspaceDraft, setWorkspaceDraft] = (0, react.useState)("");
			const [seriesDraft, setSeriesDraft] = (0, react.useState)("");
			const [note, setNote] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				if (ci !== null) {
					ci.status().then((value) => {
						if (alive) setStatus(value);
					}).catch(() => {
					});
				}
				const scope = workbenchScope;
				if (scope === null) {
					setNote("设置服务未就绪：重启 dsh web 后生效。");
					return;
				}
				const update = () => {
					if (!alive) return;
					const snap = scope.getSnapshot();
					setSettings(snap);
					setWorkspaceDraft((prev) => prev === "" ? (typeof snap.workspaceRoot === "string" ? snap.workspaceRoot : "") : prev);
				};
				update();
				const off = scope.subscribe(update);
				return () => {
					alive = false;
					off();
				};
			}, []);
			const rules = status?.knowledge ?? {};
			const series = Array.isArray(settings?.series) && settings.series.length > 0 ? settings.series : ["商业观察", "公司研究", "投资系统", "经济观察", "AI/技术"];
			const saveWorkspace = () => {
				if (workbenchScope === null) return;
				workbenchScope.set("workspaceRoot", workspaceDraft.trim()).then(() => {
					setNote("✓ Workspace 已保存（重启后生效）");
				}).catch((error) => {
					setNote(`✗ ${error instanceof Error ? error.message : String(error)}`);
				});
			};
			const pickWorkspace = async () => {
				if (workbenchScope === null) return;
				try {
					const workspaces = window.__maomaoWorkspaces ?? null;
					if (workspaces === null || typeof workspaces.pickDirectory !== "function") return;
					const path = await workspaces.pickDirectory();
					if (typeof path === "string" && path !== "") {
						setWorkspaceDraft(path);
						setNote("已选择目录，点击保存生效。");
					}
				} catch (error) {
					setNote(`✗ ${error instanceof Error ? error.message : String(error)}`);
				}
			};
			const addSeries = () => {
				const value = seriesDraft.trim();
				if (value === "" || workbenchScope === null) return;
				const next = [...series, value];
				workbenchScope.set("series", next).then(() => {
					setSeriesDraft("");
					setNote("✓ 系列已更新");
				}).catch((error) => {
					setNote(`✗ ${error instanceof Error ? error.message : String(error)}`);
				});
			};
			const removeSeries = (value) => {
				if (workbenchScope === null) return;
				workbenchScope.set("series", series.filter((item) => item !== value)).then(() => {
					setNote("✓ 系列已更新");
				}).catch((error) => {
					setNote(`✗ ${error instanceof Error ? error.message : String(error)}`);
				});
			};
			const row = (label, value, dotOn) => (0, react_jsx_runtime.jsxs)("div", {
				className: "mxSetRow",
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: "mxSetDot",
						"data-off": dotOn ? void 0 : ""
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "mxSetRowLabel",
						children: label
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "mxSetRowValue",
						children: value
					})
				]
			}, label);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxSetRoot",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxSetGroup",
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxSetGroupTitle",
								children: "环境状态"
							}),
							row("Content Projects", "可用", true),
							row("Content Workflows", "可用", true),
							row("Content Intelligence", "可用", true),
							row("Web Research", "可用（Harness 内置）", true),
							row("Canva", "未配置 · Coming Soon", false),
							row("Notion", "未配置 · Coming Soon", false)
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxSetGroup",
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxSetGroupTitle",
								children: "Workspace"
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxSetRow",
								children: [
									(0, react_jsx_runtime.jsx)("input", {
										className: "mxSetInput",
										value: workspaceDraft,
										placeholder: "留空 = 自动使用当前会话目录",
										onChange: (e) => setWorkspaceDraft(e.target.value)
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxSetBtn",
										onClick: pickWorkspace,
										children: "选择目录"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxSetBtn",
										onClick: saveWorkspace,
										children: "保存"
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxSetNote",
								children: status?.knowledge?.root ? `当前内容根目录：${status.knowledge.root}` : "内容根目录：自动解析"
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxSetGroup",
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxSetGroupTitle",
								children: "Content Series"
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxSetChips",
								children: series.map((item) => (0, react_jsx_runtime.jsxs)("span", {
									className: "mxSetChip",
									children: [
										item,
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "mxSetChipDel",
											onClick: () => removeSeries(item),
											children: "×"
										})
									]
								}, item))
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxSetRow",
								children: [
									(0, react_jsx_runtime.jsx)("input", {
										className: "mxSetInput",
										value: seriesDraft,
										placeholder: "新增系列",
										onChange: (e) => setSeriesDraft(e.target.value)
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxSetBtn",
										onClick: addSeries,
										children: "添加"
									})
								]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxSetGroup",
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxSetGroupTitle",
								children: "Platforms"
							}),
							row("小红书", "Coming Soon", false),
							row("公众号", "Coming Soon", false),
							row("视频号", "Coming Soon", false),
							row("X", "Coming Soon", false)
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxSetGroup",
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxSetGroupTitle",
								children: "Content Rules"
							}),
							row("AGENTS.md", rules.root !== void 0 ? "已加载" : "—", rules.root !== void 0),
							row("Writing Rules", rules.writing ? "已加载" : "未加载", rules.writing),
							row("Style Rules", status?.styleRules ? "已加载" : "未加载", status?.styleRules),
							row("Quality Rules", rules.quality ? "已加载" : "未加载", rules.quality)
						]
					}),
					note !== null && (0, react_jsx_runtime.jsx)("div", {
						className: note.startsWith("✓") ? "mxWfOk" : "mxWfErr",
						children: note
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "mxSetNote",
						children: "工作台是通用引擎：内容规则来自 Creator Profile（默认 profiles/maomao），可在工作区 knowledge/ 与 style-rules.json 中自定义。"
					})
				]
			});
		}

		/** Sidebar foot action: opens the workbench overlay. */
		function SidebarWorkbenchAction({ wide }) {
			const open = (0, react.useSyncExternalStore)(overlayStore.subscribe.bind(overlayStore), overlayStore.getSnapshot.bind(overlayStore));
			return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				"data-maomao-sidebar-action": "",
				onClick: () => overlayStore.set(!open),
				style: {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					border: "1px solid var(--dsw-alias-border-l2-darkmode-thin)",
					background: "var(--dsw-specific-input-major)",
					color: "var(--dsw-alias-label-primary)",
					borderRadius: "10px",
					padding: wide ? "8px 12px" : "8px",
					fontSize: "12.5px",
					fontFamily: "inherit",
					cursor: "pointer"
				},
				"aria-label": "内容项目工作台",
				children: open ? "关闭工作台" : "内容项目"
			});
		}

		/** Frame overlay (shell.overlay): the workbench panel. */
		function WorkbenchOverlay() {
			const open = (0, react.useSyncExternalStore)(overlayStore.subscribe.bind(overlayStore), overlayStore.getSnapshot.bind(overlayStore));
			if (!open) return null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxOverlayRoot",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxOverlayBar",
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxOverlayTitle",
								children: "毛毛星 Creator Workbench"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mxOverlayClose",
								onClick: () => overlayStore.set(false),
								children: "关闭"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "mxOverlayBody",
						children: (0, react_jsx_runtime.jsx)(MaomaoHome, {})
					})
				]
			});
		}

		/** Conversation view entry: the workbench tab (Dashboard or ProjectDetail). */
		function WorkbenchView(props) {
			return (0, react_jsx_runtime.jsx)(MaomaoHome, {});
		}

		/** Client plugin body: services + Remotes + slots + settings + styles. */
		function apply(ctx) {
			cp = createProjectsService(ctx);
			wf = createWorkflowsService(ctx);
			ci = createIntelligenceService(ctx);
			window.__maomaoContentProjects = cp;
			window.__maomaoContentWorkflows = wf;
			window.__maomaoContentIntelligence = ci;
			window.__maomaoWorkspaces = ctx.get("workspaces") ?? null;

			ctx.remote.$mount(PROJECTS_CONTRIBUTION).then(() => {
				cp.refresh().catch(() => {
				});
			}).catch((error) => {
				cp.markUnavailable(error);
			});
			ctx.remote.$mount(WORKFLOWS_CONTRIBUTION).catch((error) => {
				console.error("maomao-workbench: workflows mount failed:", error);
			});
			ctx.remote.$mount(INTELLIGENCE_CONTRIBUTION).catch((error) => {
				console.error("maomao-workbench: intelligence mount failed:", error);
			});

			// Static loader bundles inject their stylesheet directly (the
			// `styles` builtin is dynamic-plugin-only).
			const styleTag = document.createElement("style");
			styleTag.dataset.plugin = "maomao-creator-workbench";
			styleTag.dataset.pluginCss = "maomao-creator-workbench/styles";
			styleTag.textContent = cssMaomaoDash + cssMaomaoProj + cssMaomaoWf + cssMaomaoExtra;
			document.head.appendChild(styleTag);
			ctx.effect(() => () => {
				styleTag.remove();
			}, "maomao-workbench: styles");

			const settingsScope = ctx.get("settingsScope");
			if (settingsScope !== void 0 && typeof settingsScope.bind === "function") {
				workbenchScope = settingsScope.bind({ namespace: "maomao-workbench" });
			}

			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "maomao-workbench",
				order: 5,
				label: "内容项目"
			}, WorkbenchView));

			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "maomao-workbench",
				order: 25,
				label: "毛毛星内容工作台"
			}, WorkbenchSettingsSection));

			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "maomao-workbench",
				order: 5,
				label: "内容项目"
			}, SidebarWorkbenchAction));

			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "maomao-workbench-overlay",
				order: 10
			}, WorkbenchOverlay));
		}
		exports.apply = apply;
		exports.inject = ["remote", "slots", "settingsScope", "sessions", "workspaces"];
		return module.exports;
	}
});
