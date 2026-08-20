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
		var primitives = require("@deepseek-ai/dsh-client-ui-primitives");

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
		/**
		 * The ONE Remote contribution this plugin mounts: contentIntelligence.
		 * The contentProjects / contentWorkflows namespaces are mounted by the
		 * dedicated plugins @maomao/content-projects and @maomao/content-workflows.
		 */
		const CONTENT_MANAGER_CONTRIBUTION = {
			package: "maomao-creator-workbench.content",
			descriptors: [
				descriptor("contentManager", "list", [], "ContentListResult"),
				descriptor("contentManager", "get", [jsonParam("id")], "ContentDetailResult"),
				descriptor("contentManager", "create", [jsonParam("input")], "ContentResult"),
				descriptor("contentManager", "update", [jsonParam("id"), jsonParam("patch")], "ContentResult"),
				descriptor("contentManager", "remove", [jsonParam("id")], "OkResult"),
				descriptor("contentManager", "readArtifact", [jsonParam("id"), jsonParam("name")], "ArtifactResult"),
				descriptor("contentManager", "writeArtifact", [jsonParam("id"), jsonParam("name"), jsonParam("content")], "OkResult"),
				descriptor("contentManager", "setCurrent", [jsonParam("id")], "OkResult"),
				descriptor("contentManager", "current", [], "CurrentContentResult"),
				descriptor("contentManager", "generateSubtitles", [jsonParam("id"), jsonParam("sessionId")], "OkResult"),
				descriptor("contentManager", "generateCovers", [jsonParam("id"), jsonParam("sessionId")], "OkResult"),
				descriptor("contentManager", "exportSrt", [jsonParam("id")], "SrtExportResult")
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
		/** Module-scope handle for the intelligence service (UI + settings card). */
		var ci = null;
		var cm = null;

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
		// conversation.view (workbench tab) · settings.plugin.item (plugin config
		// card inside 设置 → 插件 → 可配置插件)
		// conversation.view (workbench tab)
		// ────────────────────────────────────────────────────────────────────
		/** Extra CSS for the overlay panel and the settings card. */
		const cssMaomaoExtra = ".mxPcRow{transition:background .14s,border-color .14s;border:1px solid transparent;border-radius:10px;padding:8px 10px;gap:10px;align-items:center;display:flex}.mxPcRow:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2-darkmode-thin)}.mxPcRow:focus-within{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover)}.mxPcDot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none}.mxPcRowLabel{flex:1;font-size:13.5px;font-weight:500;min-width:0}.mxPcRowValue{color:var(--dsw-alias-label-secondary);font-size:12.5px;flex:none}.mxPcInput{box-sizing:border-box;flex:1;min-width:0;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:8px;padding:7px 10px;font-size:13px;font-family:inherit;outline:none;transition:border-color .14s,box-shadow .14s}.mxPcInput:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}.mxPcBtn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:8px;padding:6px 14px;font-size:12.5px;font-family:inherit;flex:none;transition:background .14s,border-color .14s}.mxPcBtn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}.mxPcCheck{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;transition:border-color .14s,background .14s;user-select:none}.mxPcCheck:hover{border-color:var(--dsw-alias-border-l3)}.mxPcCheck input{accent-color:var(--dsw-alias-brand-primary);cursor:pointer;width:14px;height:14px}.mxPcTextarea{box-sizing:border-box;width:100%;min-height:88px;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:10px;padding:10px 12px;font-size:13px;line-height:20px;font-family:inherit;resize:vertical;outline:none;transition:border-color .14s,box-shadow .14s}.mxPcTextarea:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}.mxPcKeyOk{color:var(--dsw-alias-state-success-primary);font-size:12px;flex:none;white-space:nowrap}.mxPcKeyOff{color:var(--dsw-alias-label-caption);font-size:12px;flex:none;white-space:nowrap}.mxPc{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;transition:border-color .16s,background .16s}.mxPc:hover{border-color:var(--dsw-alias-label-dimmed)}.mxPc[data-open]{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.mxPcHeader{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.mxPcHeader:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.mxPcHeadText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.mxPcName{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.mxPcDesc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.mxPcChevron{color:var(--dsw-alias-label-secondary);transition:transform .16s;flex:none}.mxPcChevron[data-open]{transform:rotate(180deg)}.mxPcBody{flex-direction:column;gap:14px;padding:0 16px 16px;display:flex}" + ".mxSetRoot{flex-direction:column;gap:16px;display:flex}.mxSetGroup{flex-direction:column;gap:8px;display:flex}.mxSetGroupTitle{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:600;letter-spacing:.04em}.mxSetRow{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:12px;padding:10px 12px;gap:10px;align-items:center;display:flex}.mxSetRowLabel{flex:1;font-size:13.5px;font-weight:500;min-width:0}.mxSetRowValue{color:var(--dsw-alias-label-caption);font-size:12px;flex:none}.mxSetDot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none}.mxSetDot[data-off]{background:var(--dsw-alias-border-l3)}.mxSetInput{box-sizing:border-box;flex:1;min-width:0;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:8px;padding:7px 10px;font-size:13px;font-family:inherit}.mxSetBtn{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:8px;padding:5px 12px;font-size:12.5px;font-family:inherit;flex:none}.mxSetBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxSetBtn[disabled]{opacity:.5;cursor:default}.mxSetNote{color:var(--dsw-alias-label-caption);font-size:12px;line-height:18px}.mxSetChips{flex-wrap:wrap;gap:6px;display:flex}.mxSetChip{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:999px;padding:3px 10px;font-size:12.5px;line-height:18px;font-family:inherit;display:inline-flex;gap:6px;align-items:center}.mxSetChipDel{cursor:pointer;color:var(--dsw-alias-label-caption);font-family:inherit;background:0 0;border:none;font-size:13px;padding:0}.mxWs{flex:1;min-height:0;display:grid;grid-template-columns:280px minmax(0,1fr) 270px;gap:12px;padding:14px;overflow:hidden}.mxWsLeft{flex-direction:column;gap:10px;min-height:0;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:14px;padding:12px;display:flex;overflow-y:auto}.mxWsLeftHead{justify-content:space-between;align-items:center;display:flex}.mxWsTitle{font-size:15px;font-weight:600}.mxWsFilters{flex-wrap:wrap;gap:6px;display:flex}.mxWsFilter{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:999px;padding:3px 10px;font-size:12px;font-family:inherit;cursor:pointer}.mxWsFilter[data-active]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}.mxWsList{flex-direction:column;gap:6px;display:flex}.mxWsItem{border:1px solid transparent;border-radius:10px;padding:8px 10px;cursor:pointer;flex-direction:column;gap:4px;display:flex;transition:background .14s,border-color .14s}.mxWsItem:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxWsItem[data-active]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover)}.mxWsItemTitle{font-size:13px;font-weight:500;line-height:18px}.mxWsItemMeta{color:var(--dsw-alias-label-caption);font-size:11.5px;gap:8px;align-items:center;display:flex}.mxWsItemDel{color:var(--dsw-alias-state-error-primary);background:0 0;border:none;font-size:11.5px;cursor:pointer;font-family:inherit;padding:0;margin-left:auto}.mxCreateMenu{flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:10px;padding:6px;display:flex}.mxCreateItem{border:0;background:0 0;color:var(--dsw-alias-label-primary);text-align:left;border-radius:8px;padding:6px 8px;font-size:13px;cursor:pointer;font-family:inherit}.mxCreateItem:hover{background:var(--dsw-alias-interactive-bg-hover)}.mxWsCenter{min-width:0;min-height:0;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:14px;padding:12px;overflow-y:auto;flex-direction:column;display:flex}.mxWsEmpty{color:var(--dsw-alias-label-caption);font-size:13px;padding:40px 0;text-align:center}.mxWsRight{min-height:0;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);background:var(--dsw-specific-input-major);border-radius:14px;padding:12px;overflow-y:auto;flex-direction:column;display:flex}.mxAgent{flex-direction:column;gap:8px;display:flex}.mxAgentTitle{font-size:14px;font-weight:600}.mxAgentRow{font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-primary);word-break:break-all}.mxAgentNote{color:var(--dsw-alias-label-caption);font-size:12px;line-height:19px}.mxAgentActions{flex-wrap:wrap;gap:6px;display:flex;margin-top:4px}.mxDetail{flex-direction:column;gap:12px;min-height:0;display:flex}.mxDetailHead{gap:8px;align-items:center;display:flex}.mxDetailTitle{font-size:17px;font-weight:600;flex:1;min-width:0}.mxDetailTabs{flex-wrap:wrap;gap:6px;display:flex;border-bottom:1px solid var(--dsw-alias-border-l2-darkmode-thin);padding-bottom:10px}.mxDetailTab{border:1px solid transparent;color:var(--dsw-alias-label-secondary);background:0 0;border-radius:8px;padding:5px 12px;font-size:13px;cursor:pointer;font-family:inherit}.mxDetailTab[data-active]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}.mxDetailBody{flex-direction:column;gap:10px;display:flex}.mxSetSelect{background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:8px;padding:6px 8px;font-size:12.5px;font-family:inherit}.mxSub{flex-direction:column;gap:10px;display:flex}.mxSubBar{flex-wrap:wrap;gap:6px;display:flex}.mxSubTimeline{flex-direction:column;gap:6px;display:flex;max-height:520px;overflow-y:auto}.mxSubRow{align-items:center;gap:8px;display:flex;border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:8px;padding:6px 8px}.mxSubIdx{color:var(--dsw-alias-label-caption);font-size:11.5px;width:20px;flex:none}.mxSubTime{width:120px;flex:none;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:6px;padding:4px 6px;font-size:12px;font-family:inherit}.mxSubArrow{color:var(--dsw-alias-label-caption);flex:none}.mxSubText{flex:1;min-width:0;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:6px;padding:4px 6px;font-size:12.5px;font-family:inherit}.mxSubDel{color:var(--dsw-alias-state-error-primary);background:0 0;border:none;cursor:pointer;font-size:14px;flex:none}.mxCov{flex-direction:column;gap:10px;display:flex}.mxCovForm{flex-direction:column;gap:8px;display:flex}.mxCovLayouts{flex-wrap:wrap;gap:6px;display:flex}.mxCovLayout{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);color:var(--dsw-alias-label-secondary);background:0 0;border-radius:999px;padding:3px 12px;font-size:12.5px;cursor:pointer;font-family:inherit}.mxCovLayout[data-active]{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}.mxCovPlan{border:1px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:10px;padding:10px 12px;flex-direction:column;gap:6px;display:flex}.mxCovPlanHead{font-size:13px;font-weight:600}.mxCovPlanBody{white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:20px;margin:0;font-family:inherit}";

		/** Tiny module-scope store for the sidebar→overlay toggle. */
		/** Module-scope settings scope (bound in apply). */
		var workbenchScope = null;

		/** Plugin configuration card (settings.plugin.item, inside 设置 → 插件 → 可配置插件).
		 * Layout: 环境状态 / 影片目录 / 启用平台 / 脚本规则 / 接口密钥 + 内容系列 /
		 * 内容规则 (merged back from the original workbench design). */
		function WorkbenchPluginCard() {
			const [open, setOpen] = (0, react.useState)(false);
			const [snap, setSnap] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)(null);
			const [videoDirDraft, setVideoDirDraft] = (0, react.useState)("");
			const [scriptRulesDraft, setScriptRulesDraft] = (0, react.useState)("");
			const [seriesDraft, setSeriesDraft] = (0, react.useState)("");
			const [keyDrafts, setKeyDrafts] = (0, react.useState)({});
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
					const current = scope.getSnapshot();
					setSnap(current);
					const doc = current.value ?? {};
					setVideoDirDraft((prev) => prev === "" ? (typeof doc.videoDir === "string" ? doc.videoDir : "") : prev);
					setScriptRulesDraft((prev) => prev === "" ? (typeof doc.scriptRules === "string" ? doc.scriptRules : "") : prev);
				};
				update();
				const off = scope.subscribe(update);
				return () => {
					alive = false;
					off();
				};
			}, []);
			const doc = snap?.value ?? {};
			const platforms = doc.platforms ?? {};
			const series = Array.isArray(doc.series) && doc.series.length > 0 ? doc.series : ["商业观察", "公司研究", "投资系统", "经济观察", "AI/技术"];
			const rules = status?.knowledge ?? {};
			const envStatusList = ["内容目录", "字幕", "自动剪辑", "公众号图文", "Screen Studio", "封面", "自动发布", "Ego Browser"];
			const platformKeys = [
				{ key: "xiaohongshu", label: "小红书" },
				{ key: "douyin", label: "抖音" },
				{ key: "bilibili", label: "B站" },
				{ key: "shipinhao", label: "视频号" }
			];
			/** Persist one field; the client set() resolves even on failure, so
			 * verify the write actually landed and surface a visible result. */
			const saveField = (field, value) => {
				if (workbenchScope === null) return;
				workbenchScope.set(field, value).then(() => {
					window.setTimeout(() => {
						const after = workbenchScope?.getSnapshot().value?.[field];
						setNote(JSON.stringify(after) === JSON.stringify(value) ? "✓ 已保存" : `✗ 保存失败：${field} 未更新（请确认服务已重启加载新配置）`);
					}, 300);
				});
			};
			const togglePlatform = (key) => {
				saveField("platforms", { ...platforms, [key]: !platforms[key] });
			};
			const pickVideoDir = async () => {
				const workspaces = window.__maomaoWorkspaces;
				if (workspaces === null || typeof workspaces.pickDirectory !== "function") return;
				try {
					const path = await workspaces.pickDirectory();
					if (typeof path === "string" && path !== "") {
						setVideoDirDraft(path);
						saveField("videoDir", path);
					}
				} catch (error) {
					setNote(`✗ ${error instanceof Error ? error.message : String(error)}`);
				}
			};
			const addSeries = () => {
				const value = seriesDraft.trim();
				if (value === "") return;
				saveField("series", [...series, value]);
				setSeriesDraft("");
			};
			const removeSeries = (value) => {
				saveField("series", series.filter((item) => item !== value));
			};
			const envRow = (label) => (0, react_jsx_runtime.jsxs)("div", {
				className: "mxPcRow",
				children: [
					(0, react_jsx_runtime.jsx)("span", { className: "mxPcDot" }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowLabel", children: label }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowValue", children: "可用" })
				]
			}, label);
			const ruleRow = (label, loaded) => (0, react_jsx_runtime.jsxs)("div", {
				className: "mxPcRow",
				children: [
					(0, react_jsx_runtime.jsx)("span", { className: "mxPcDot", "data-off": loaded ? void 0 : "" }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowLabel", children: label }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowValue", children: loaded ? "已加载" : "未加载" })
				]
			}, label);
			const keyRow = (label, field) => {
				const saved = typeof doc[field] === "string" ? doc[field] : "";
				const configured = saved !== "";
				return (0, react_jsx_runtime.jsxs)("div", {
					className: "mxPcRow",
					children: [
						(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowLabel", children: label }),
						(0, react_jsx_runtime.jsx)("input", {
							className: "mxPcInput",
							type: "password",
							value: keyDrafts[field] ?? saved,
							placeholder: "粘贴接口 Key",
							onChange: (e) => setKeyDrafts((prev) => ({ ...prev, [field]: e.target.value })),
							onBlur: (e) => {
								const value = e.target.value.trim();
								setKeyDrafts((prev) => ({ ...prev, [field]: "" }));
								if (value !== saved) saveField(field, value);
							}
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: configured ? "mxPcKeyOk" : "mxPcKeyOff",
							children: configured ? "已配置" : "未配置"
						})
					]
				}, field);
			};
			const group = (title, body) => (0, react_jsx_runtime.jsxs)("div", {
				className: "mxSetGroup",
				children: [
					(0, react_jsx_runtime.jsx)("div", { className: "mxSetGroupTitle", children: title }),
					body
				]
			}, title);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxPc",
				"data-open": open || void 0,
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "mxPcHeader",
						"aria-expanded": open || void 0,
						onClick: () => setOpen(!open),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxPcHeadText",
								children: [
									(0, react_jsx_runtime.jsx)("div", { className: "mxPcName", children: "内容工作台" }),
									(0, react_jsx_runtime.jsx)("div", { className: "mxPcDesc", children: "环境状态、影片目录、启用平台、脚本规则、接口密钥、内容系列与内容规则。" })
								]
							}),
							(0, react_jsx_runtime.jsx)(primitives.IconChevronDownOutline14, {
								className: "mxPcChevron",
								"data-open": open || void 0,
								size: 14
							})
						]
					}),
					open && (0, react_jsx_runtime.jsxs)("div", {
						className: "mxPcBody",
						children: [
							group("环境状态", envStatusList.map(envRow)),
							group("影片目录", (0, react_jsx_runtime.jsxs)("div", {
								className: "mxPcRow",
								children: [
									(0, react_jsx_runtime.jsx)("input", {
										className: "mxPcInput",
										value: videoDirDraft,
										placeholder: "/Users/demo/Movies/视频项目",
										onChange: (e) => setVideoDirDraft(e.target.value),
										onBlur: (e) => {
											const value = e.target.value.trim();
											if (value !== (doc.videoDir ?? "")) saveField("videoDir", value);
										}
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxPcBtn",
										onClick: pickVideoDir,
										children: "选择"
									})
								]
							})),
							group("启用平台", platformKeys.map(({ key, label }) => (0, react_jsx_runtime.jsxs)("label", {
								className: "mxPcCheck",
								children: [
									(0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: platforms[key] === true,
										onChange: () => togglePlatform(key)
									}),
									(0, react_jsx_runtime.jsx)("span", { children: label })
								]
							}, key))),
							group("脚本规则", (0, react_jsx_runtime.jsx)("textarea", {
								className: "mxPcTextarea",
								rows: 4,
								value: scriptRulesDraft,
								placeholder: "用于填写 AI 创作规则，例如：\u201c口语化表达，开头3秒给结论，不堆砌术语。\u201d",
								onChange: (e) => setScriptRulesDraft(e.target.value),
								onBlur: (e) => {
									const value = e.target.value;
									if (value !== (doc.scriptRules ?? "")) saveField("scriptRules", value);
								}
							})),
							group("接口密钥", (0, react_jsx_runtime.jsxs)(react.Fragment, {
								children: [
									keyRow("字幕接口 Key", "subtitleApiKey"),
									keyRow("封面接口 Key", "coverApiKey")
								]
							})),
							group("内容系列", (0, react_jsx_runtime.jsxs)(react.Fragment, {
								children: [
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
										className: "mxPcRow",
										children: [
											(0, react_jsx_runtime.jsx)("input", {
												className: "mxPcInput",
												value: seriesDraft,
												placeholder: "新增系列（如：AI/技术）",
												onChange: (e) => setSeriesDraft(e.target.value)
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "mxPcBtn",
												onClick: addSeries,
												children: "添加"
											})
										]
									})
								]
							})),
							group("内容规则", (0, react_jsx_runtime.jsxs)(react.Fragment, {
								children: [
									ruleRow("AGENTS.md", rules.root !== void 0),
									ruleRow("Writing Rules", rules.writing === true),
									ruleRow("Style Rules", status?.styleRules === true),
									ruleRow("Quality Rules", rules.quality === true)
								]
							})),
							note !== null && (0, react_jsx_runtime.jsx)("div", {
								className: note.startsWith("✓") ? "mxWfOk" : "mxWfErr",
								children: note
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxSetNote",
								children: "接口密钥仅保存在本机设置文档（日志自动脱敏）；请勿提交到任何 Git 仓库。"
							})
						]
					})
				]
			});
		}

		/** Conversation view entry: the workbench tab (Dashboard or ProjectDetail). */
		function WorkbenchView(props) {
			return (0, react_jsx_runtime.jsx)(MaomaoHome, {});
		}

		// ────────────────────────────────────────────────────────────────────
		// Section D — Phase 6: Content Manager workspace.
		// 三栏工作台：左=内容资产列表 · 中=编辑工作区 · 右=Agent 上下文。
		// ────────────────────────────────────────────────────────────────────
		const CONTENT_TYPE_LABELS = { "video": "视频", "script": "脚本", "subtitle": "字幕", "cover": "封面", "article": "文章", "publish": "发布" };
		const CONTENT_STATUS_LABELS = { "idea": "构思", "draft": "草稿", "editing": "编辑中", "review": "审查中", "ready": "就绪", "published": "已发布", "archived": "已归档" };
		/** contentManager client service. */
		function createContentManagerService(ctx) {
			const ns = () => namespace(ctx, "contentManager");
			return {
				list: async () => unwrap(ns().list()),
				get: async (id) => unwrap(ns().get(id)),
				create: async (input) => unwrap(ns().create(input)),
				update: async (id, patch) => unwrap(ns().update(id, patch)),
				remove: async (id) => unwrap(ns().remove(id)),
				readArtifact: async (id, name) => unwrap(ns().readArtifact(id, name)),
				writeArtifact: async (id, name, content) => unwrap(ns().writeArtifact(id, name, content)),
				setCurrent: async (id) => unwrap(ns().setCurrent(id)),
				current: async () => unwrap(ns().current()),
				generateSubtitles: async (id, sessionId) => unwrap(ns().generateSubtitles(id, sessionId)),
				generateCovers: async (id, sessionId) => unwrap(ns().generateCovers(id, sessionId)),
				exportSrt: async (id) => unwrap(ns().exportSrt(id))
			};
		}
		/** Parse SRT text into timeline rows. */
		function parseSrt(text) {
			const blocks = String(text ?? "").trim().split(/\n{2,}/);
			const rows = [];
			for (const block of blocks) {
				const lines = block.split("\n").map((l) => l.trim()).filter((l) => l !== "");
				if (lines.length < 2) continue;
				const timeLine = lines.find((l) => l.includes("-->")) ?? lines[1] ?? lines[0];
				const m = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/.exec(timeLine);
				const textStart = m ? lines.indexOf(timeLine) + 1 : 1;
				const text = lines.slice(textStart).join("\n");
				rows.push({
					index: rows.length + 1,
					start: m ? m[1].replace(".", ",") : "00:00:00,000",
					end: m ? m[2].replace(".", ",") : "00:00:01,000",
					text
				});
			}
			return rows;
		}
		/** Serialize timeline rows into SRT. */
		function formatSrt(rows) {
			return rows.map((r, i) => `${i + 1}\n${r.start} --> ${r.end}\n${r.text}`).join("\n\n") + "\n";
		}
		/** Trigger a browser download of a text file. */
		function downloadText(name, content) {
			const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = name;
			a.click();
			URL.revokeObjectURL(url);
		}
		/** 右栏：Agent 上下文面板。对话本体在「聊天」视图；上下文已自动注入。 */
		function AgentContextPanel({ detail, running, onSubtitle, onCover, onOpenChat }) {
			const item = detail?.item;
			if (item === void 0) {
				return (0, react_jsx_runtime.jsx)("div", {
					className: "mxAgent",
					children: [
						(0, react_jsx_runtime.jsx)("div", { className: "mxAgentTitle", children: "Agent 上下文" }),
						(0, react_jsx_runtime.jsx)("div", { className: "mxAgentNote", children: "打开一个内容后，Agent 会自动获得它的标题、视频、脚本、字幕与封面信息。" })
					]
				});
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxAgent",
				children: [
					(0, react_jsx_runtime.jsx)("div", { className: "mxAgentTitle", children: "Agent 上下文" }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxAgentRow", children: `标题：${item.title ?? "—"}` }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxAgentRow", children: `类型：${CONTENT_TYPE_LABELS[item.type] ?? item.type}｜状态：${CONTENT_STATUS_LABELS[item.status] ?? item.status}` }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxAgentRow", children: `视频：${item.videoPath || "—"}` }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxAgentRow", children: `主题：${item.theme || "—"}｜画像：${item.persona || "—"}` }),
					(0, react_jsx_runtime.jsx)("div", {
						className: "mxAgentNote",
						children: "上下文已注入当前会话的 Agent（聊天视图）。你可以说「优化这个封面 / 生成字幕 / 修改脚本」，Agent 会直接基于这个内容处理。"
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxAgentActions",
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mxPcBtn",
								disabled: running,
								onClick: onSubtitle,
								children: running ? "生成中…" : "AI 生成字幕"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mxPcBtn",
								disabled: running,
								onClick: onCover,
								children: running ? "生成中…" : "AI 生成封面方案"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mxPcBtn",
						onClick: onOpenChat,
						children: "去「聊天」视图和 Agent 对话"
					})
				]
			});
		}
		/** 字幕编辑器：时间轴行编辑 + AI 生成 + SRT 导出。 */
		function SubtitleEditor({ id, srt, onChanged, running, onGenerate }) {
			const [rows, setRows] = (0, react.useState)(() => parseSrt(srt));
			(0, react.useEffect)(() => {
				setRows(parseSrt(srt));
			}, [srt]);
			const patch = (index, field, value) => {
				setRows((prev) => prev.map((r) => (r.index === index ? { ...r, [field]: value } : r)));
			};
			const addRow = () => {
				const last = rows[rows.length - 1];
				const end = last === void 0 ? "00:00:01,000" : last.end;
				setRows((prev) => [...prev, { index: prev.length + 1, start: end, end, text: "" }]);
			};
			const removeRow = (index) => {
				setRows((prev) => prev.filter((r) => r.index !== index).map((r, i) => ({ ...r, index: i + 1 })));
			};
			const save = () => {
				onChanged(formatSrt(rows));
			};
			const doExport = () => {
				downloadText(`${id}.srt`, formatSrt(rows));
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxSub",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxSubBar",
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mxPcBtn",
								disabled: running,
								onClick: onGenerate,
								children: running ? "AI 生成中…" : "AI 生成字幕"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mxPcBtn",
								onClick: addRow,
								children: "＋ 添加字幕行"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mxPcBtn",
								onClick: save,
								children: "保存字幕"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "mxPcBtn",
								onClick: doExport,
								children: "导出 SRT"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "mxSubTimeline",
						children: rows.map((row) => (0, react_jsx_runtime.jsxs)("div", {
							className: "mxSubRow",
							children: [
								(0, react_jsx_runtime.jsx)("span", { className: "mxSubIdx", children: row.index }),
								(0, react_jsx_runtime.jsx)("input", {
									className: "mxSubTime",
									value: row.start,
									onChange: (e) => patch(row.index, "start", e.target.value)
								}),
								(0, react_jsx_runtime.jsx)("span", { className: "mxSubArrow", children: "→" }),
								(0, react_jsx_runtime.jsx)("input", {
									className: "mxSubTime",
									value: row.end,
									onChange: (e) => patch(row.index, "end", e.target.value)
								}),
								(0, react_jsx_runtime.jsx)("input", {
									className: "mxSubText",
									value: row.text,
									onChange: (e) => patch(row.index, "text", e.target.value)
								}),
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "mxSubDel",
									onClick: () => removeRow(row.index),
									children: "×"
								})
							]
						}, row.index))
					}),
					rows.length === 0 && (0, react_jsx_runtime.jsx)("div", { className: "mxSetNote", children: "暂无字幕。点击「AI 生成字幕」（依据脚本/主题生成 SRT），或手动添加。" })
				]
			});
		}
		/** 封面工作室：标题/主题/画像 → AI 多方案；支持改标题、选布局、重新生成。 */
		function CoverStudio({ detail, setDetail, running, onGenerate }) {
			const item = detail.item;
			const [titleDraft, setTitleDraft] = (0, react.useState)(item.title ?? "");
			const [themeDraft, setThemeDraft] = (0, react.useState)(item.theme ?? "");
			const [personaDraft, setPersonaDraft] = (0, react.useState)(item.persona ?? "");
			const [layout, setLayout] = (0, react.useState)("大字");
			const [note, setNote] = (0, react.useState)(null);
			const coverText = detail.artifacts["cover.md"] ?? "";
			const plans = coverText.split(/^##\s*方案\s*(\d+)/m).filter((_, i) => i % 2 === 1).map((_, i) => ({ n: i + 1 }));
			const planBodies = coverText.split(/^##\s*方案\s*\d+/m).filter((s) => s.trim() !== "");
			const layouts = ["大字", "对比", "清单", "人物", "极简"];
			const saveMeta = () => {
				cm.update(item.id, { title: titleDraft, theme: themeDraft, persona: personaDraft }).then((r) => {
					setDetail((prev) => ({ ...prev, item: r.item }));
					setNote("✓ 已保存");
				}).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxCov",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxCovForm",
						children: [
							(0, react_jsx_runtime.jsx)("div", { className: "mxSetGroupTitle", children: "封面信息" }),
							(0, react_jsx_runtime.jsx)("input", { className: "mxPcInput", value: titleDraft, placeholder: "标题", onChange: (e) => setTitleDraft(e.target.value) }),
							(0, react_jsx_runtime.jsx)("input", { className: "mxPcInput", value: themeDraft, placeholder: "内容主题（如：AI 工具评测）", onChange: (e) => setThemeDraft(e.target.value) }),
							(0, react_jsx_runtime.jsx)("input", { className: "mxPcInput", value: personaDraft, placeholder: "用户画像（如：25-40 岁创作者）", onChange: (e) => setPersonaDraft(e.target.value) }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxCovLayouts",
								children: layouts.map((l) => (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "mxCovLayout",
									"data-active": layout === l || void 0,
									onClick: () => setLayout(l),
									children: [l]
								}, l))
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxAgentActions",
								children: [
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxPcBtn",
										onClick: saveMeta,
										children: "保存信息"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxPcBtn",
										disabled: running,
										onClick: onGenerate,
										children: running ? "生成中…" : "AI 生成封面方案"
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxPcBtn",
										disabled: running,
										onClick: onGenerate,
										children: "重新生成"
									})
								]
							}),
							note !== null && (0, react_jsx_runtime.jsx)("div", {
								className: note.startsWith("✓") ? "mxWfOk" : "mxWfErr",
								children: note
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", { className: "mxSetGroupTitle", children: "封面方案" }),
					planBodies.length === 0 ? (0, react_jsx_runtime.jsx)("div", { className: "mxSetNote", children: "还没有封面方案。点击「AI 生成封面方案」：Agent 会分析标题、主题与用户画像，输出多个方案到 cover.md。" }) : planBodies.map((body, i) => (0, react_jsx_runtime.jsxs)("div", {
						className: "mxCovPlan",
						children: [
							(0, react_jsx_runtime.jsx)("div", { className: "mxCovPlanHead", children: `方案 ${i + 1}${body.includes("推荐") ? " ★ 推荐" : ""}` }),
							(0, react_jsx_runtime.jsx)("pre", { className: "mxCovPlanBody", children: body.trim() })
						]
					}, i))
				]
			});
		}
		/** 内容详情：概览/视频/脚本/字幕/封面/文章/发布 Tabs。 */
		function ContentDetail({ detail, setDetail, sessionId, setNote }) {
			const item = detail.item;
			const [tab, setTab] = (0, react.useState)("overview");
			const [drafts, setDrafts] = (0, react.useState)({});
			const [running, setRunning] = (0, react.useState)(detail.run?.status === "running");
			const tabs = [
				{ id: "overview", label: "概览" },
				{ id: "video", label: "视频" },
				{ id: "script", label: "脚本" },
				{ id: "subtitle", label: "字幕" },
				{ id: "cover", label: "封面" },
				{ id: "article", label: "文章" },
				{ id: "publish", label: "发布" }
			];
			const artifact = (name) => drafts[name] ?? detail.artifacts[name] ?? "";
			const saveArtifact = (name) => {
				const content = drafts[name];
				if (content === void 0) return;
				cm.writeArtifact(item.id, name, content).then(() => {
					setDrafts((prev) => {
						const next = { ...prev };
						delete next[name];
						return next;
					});
					setNote("✓ 已保存");
					cm.get(item.id).then((r) => setDetail(r)).catch(() => {
					});
				}).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
			};
			const startGenerate = (kind) => {
				setRunning(true);
				const call = kind === "subtitle" ? cm.generateSubtitles(item.id, sessionId) : cm.generateCovers(item.id, sessionId);
				call.then(() => {
					const timer = window.setInterval(() => {
						cm.get(item.id).then((r) => {
							const run = r.run ?? null;
							if (run === null || run.status === "running") return;
							window.clearInterval(timer);
							setRunning(false);
							setDetail(r);
							setNote(run.status === "success" ? "✓ AI 生成完成" : `✗ 生成失败：${run.error ?? "未知错误"}`);
						}).catch(() => {
						});
					}, 2000);
				}).catch((e) => {
					setRunning(false);
					setNote(`✗ ${e instanceof Error ? e.message : String(e)}`);
				});
			};
			const fieldRow = (label, value) => (0, react_jsx_runtime.jsxs)("div", {
				className: "mxPcRow",
				children: [
					(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowLabel", children: label }),
					(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowValue", children: value })
				]
			}, label);
			const editable = (label, field) => {
				const value = drafts[field] ?? item[field] ?? "";
				return (0, react_jsx_runtime.jsxs)("div", {
					className: "mxPcRow",
					children: [
						(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowLabel", children: label }),
						(0, react_jsx_runtime.jsx)("input", {
							className: "mxPcInput",
							value: value,
							onChange: (e) => setDrafts((prev) => ({ ...prev, [field]: e.target.value }))
						})
					]
				}, label);
			};
			const saveMetaDraft = () => {
				const patch = {};
				for (const f of ["title", "videoPath", "theme", "persona", "cover"]) {
					if (drafts[f] !== void 0) patch[f] = drafts[f];
				}
				if (Object.keys(patch).length === 0) return;
				cm.update(item.id, patch).then((r) => {
					setDetail((prev) => ({ ...prev, item: r.item }));
					setDrafts({});
					setNote("✓ 已保存");
				}).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
			};
			const body = () => {
				switch (tab) {
					case "overview":
						return (0, react_jsx_runtime.jsxs)(react.Fragment, {
							children: [
								fieldRow("ID", item.id),
								editable("标题", "title"),
								fieldRow("类型", CONTENT_TYPE_LABELS[item.type] ?? item.type),
								(0, react_jsx_runtime.jsxs)("div", {
									className: "mxPcRow",
									children: [
										(0, react_jsx_runtime.jsx)("div", { className: "mxPcRowLabel", children: "状态" }),
										(0, react_jsx_runtime.jsx)("select", {
											className: "mxSetSelect",
											value: item.status,
											onChange: (e) => cm.update(item.id, { status: e.target.value }).then((r) => setDetail((prev) => ({ ...prev, item: r.item }))).catch(() => {
											}),
											children: Object.keys(CONTENT_STATUS_LABELS).map((s) => (0, react_jsx_runtime.jsx)("option", { value: s, children: CONTENT_STATUS_LABELS[s] }, s))
										})
									]
								}),
								fieldRow("创建时间", item.createdAt),
								fieldRow("更新时间", item.updatedAt),
								(0, react_jsx_runtime.jsx)("button", { type: "button", className: "mxPcBtn", onClick: saveMetaDraft, children: "保存概览" })
							]
						});
					case "video":
						return (0, react_jsx_runtime.jsxs)(react.Fragment, {
							children: [
								editable("视频文件路径", "videoPath"),
								(0, react_jsx_runtime.jsx)("div", { className: "mxSetNote", children: "填写视频文件路径（如 ~/Movies/项目/xxx.mp4）。后续版本支持本地目录扫描与上传。" }),
								(0, react_jsx_runtime.jsx)("button", { type: "button", className: "mxPcBtn", onClick: saveMetaDraft, children: "保存视频信息" })
							]
						});
					case "script":
						return (0, react_jsx_runtime.jsxs)(react.Fragment, {
							children: [
								(0, react_jsx_runtime.jsx)("textarea", {
									className: "mxPcTextarea",
									style: { minHeight: "320px" },
									value: artifact("script.md"),
									placeholder: "脚本内容…（可让 Agent 在聊天里直接写回）",
									onChange: (e) => setDrafts((prev) => ({ ...prev, "script.md": e.target.value }))
								}),
								(0, react_jsx_runtime.jsx)("button", { type: "button", className: "mxPcBtn", onClick: () => saveArtifact("script.md"), children: "保存脚本" })
							]
						});
					case "subtitle":
						return (0, react_jsx_runtime.jsx)(SubtitleEditor, {
							id: item.id,
							srt: artifact("subtitle.srt"),
							running,
							onChanged: (text) => {
								setDrafts((prev) => ({ ...prev, "subtitle.srt": text }));
								cm.writeArtifact(item.id, "subtitle.srt", text).then(() => setNote("✓ 字幕已保存")).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
							},
							onGenerate: () => startGenerate("subtitle")
						});
					case "cover":
						return (0, react_jsx_runtime.jsx)(CoverStudio, {
							detail,
							setDetail,
							running,
							onGenerate: () => startGenerate("cover")
						});
					case "article":
						return (0, react_jsx_runtime.jsxs)(react.Fragment, {
							children: [
								(0, react_jsx_runtime.jsx)("textarea", {
									className: "mxPcTextarea",
									style: { minHeight: "320px" },
									value: artifact("article.md"),
									placeholder: "文章正文…",
									onChange: (e) => setDrafts((prev) => ({ ...prev, "article.md": e.target.value }))
								}),
								(0, react_jsx_runtime.jsx)("button", { type: "button", className: "mxPcBtn", onClick: () => saveArtifact("article.md"), children: "保存文章" })
							]
						});
					case "publish":
						return (0, react_jsx_runtime.jsxs)(react.Fragment, {
							children: [
								(0, react_jsx_runtime.jsx)("textarea", {
									className: "mxPcTextarea",
									style: { minHeight: "200px" },
									value: artifact("publish.md"),
									placeholder: "发布信息：平台 / 发布时间 / 话题标签 / 封面文案…",
									onChange: (e) => setDrafts((prev) => ({ ...prev, "publish.md": e.target.value }))
								}),
								(0, react_jsx_runtime.jsx)("button", { type: "button", className: "mxPcBtn", onClick: () => saveArtifact("publish.md"), children: "保存发布信息" })
							]
						});
					default:
						return null;
				}
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxDetail",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxDetailHead",
						children: [
							(0, react_jsx_runtime.jsx)("div", { className: "mxDetailTitle", children: item.title ?? "未命名内容" }),
							(0, react_jsx_runtime.jsx)("span", { className: "mxProjChip", children: CONTENT_TYPE_LABELS[item.type] ?? item.type }),
							(0, react_jsx_runtime.jsx)("span", { className: "mxProjChip", children: CONTENT_STATUS_LABELS[item.status] ?? item.status })
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "mxDetailTabs",
						children: tabs.map((entry) => (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "mxDetailTab",
							"data-active": entry.id === tab || void 0,
							onClick: () => setTab(entry.id),
							children: entry.label
						}, entry.id))
					}),
					(0, react_jsx_runtime.jsx)("div", { className: "mxDetailBody", children: body() })
				]
			});
		}
		/** 三栏工作台视图（conversation.view「内容管理」）。 */
		function ContentManagerWorkspace({ sessionId }) {
			const [items, setItems] = (0, react.useState)([]);
			const [filter, setFilter] = (0, react.useState)("all");
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)(null);
			const [createMenu, setCreateMenu] = (0, react.useState)(false);
			const [contextSection, setContextSection] = (0, react.useState)("");
			const refreshList = () => {
				return cm.list().then((r) => setItems(r.items)).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
			};
			const openItem = (id) => {
				setSelectedId(id);
				cm.setCurrent(id).then(() => cm.get(id)).then((r) => {
					setDetail(r);
					return cm.current();
				}).then((c) => setContextSection(c.section ?? "")).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
			};
			const createItem = (type) => {
				setCreateMenu(false);
				cm.create({ title: `未命名${CONTENT_TYPE_LABELS[type] ?? type}`, type }).then((r) => {
					refreshList();
					openItem(r.item.id);
				}).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
			};
			const removeItem = (id) => {
				if (!window.confirm("删除该内容及其所有产物？此操作不可撤销。")) return;
				cm.remove(id).then(() => {
					if (selectedId === id) {
						setSelectedId(null);
						setDetail(null);
					}
					refreshList();
				}).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
			};
			(0, react.useEffect)(() => {
				refreshList();
				cm.current().then((c) => setContextSection(c.section ?? "")).catch(() => {
				});
			}, []);
			const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);
			const running = detail?.run?.status === "running";
			const startGenerate = (kind) => {
				if (detail === null) return;
				const id = detail.item.id;
				cm.get(id).then(() => {
					const call = kind === "subtitle" ? cm.generateSubtitles(id, sessionId) : cm.generateCovers(id, sessionId);
					call.then(() => {
						const timer = window.setInterval(() => {
							cm.get(id).then((r) => {
								const run = r.run ?? null;
								if (run === null || run.status === "running") return;
								window.clearInterval(timer);
								setDetail(r);
								cm.current().then((c) => setContextSection(c.section ?? "")).catch(() => {
								});
								refreshList();
								setNote(run.status === "success" ? "✓ AI 生成完成" : `✗ 生成失败：${run.error ?? "未知错误"}`);
							}).catch(() => {
							});
						}, 2000);
					}).catch((e) => setNote(`✗ ${e instanceof Error ? e.message : String(e)}`));
				}).catch(() => {
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "mxWs",
				children: [
					(0, react_jsx_runtime.jsxs)("aside", {
						className: "mxWsLeft",
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxWsLeftHead",
								children: [
									(0, react_jsx_runtime.jsx)("div", { className: "mxWsTitle", children: "内容管理" }),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "mxPcBtn",
										onClick: () => setCreateMenu(!createMenu),
										children: "＋ 新建"
									})
								]
							}),
							createMenu && (0, react_jsx_runtime.jsxs)("div", {
								className: "mxCreateMenu",
								children: Object.keys(CONTENT_TYPE_LABELS).map((type) => (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "mxCreateItem",
									onClick: () => createItem(type),
									children: CONTENT_TYPE_LABELS[type]
								}, type))
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "mxWsFilters",
								children: ["all", ...Object.keys(CONTENT_TYPE_LABELS)].map((f) => (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "mxWsFilter",
									"data-active": filter === f || void 0,
									onClick: () => setFilter(f),
									children: f === "all" ? "全部" : CONTENT_TYPE_LABELS[f]
								}, f))
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: "mxWsList",
								children: filtered.map((item) => (0, react_jsx_runtime.jsxs)("div", {
									className: "mxWsItem",
									"data-active": item.id === selectedId || void 0,
									onClick: () => openItem(item.id),
									children: [
										(0, react_jsx_runtime.jsx)("div", { className: "mxWsItemTitle", children: item.title }),
										(0, react_jsx_runtime.jsxs)("div", {
											className: "mxWsItemMeta",
											children: [
												(0, react_jsx_runtime.jsx)("span", { children: CONTENT_TYPE_LABELS[item.type] ?? item.type }),
												(0, react_jsx_runtime.jsx)("span", { children: CONTENT_STATUS_LABELS[item.status] ?? item.status }),
												(0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "mxWsItemDel",
													onClick: (e) => {
														e.stopPropagation();
														removeItem(item.id);
													},
													children: "删除"
												})
											]
										})
									]
								}, item.id))
							}),
							filtered.length === 0 && (0, react_jsx_runtime.jsx)("div", { className: "mxSetNote", children: "还没有内容。点「＋ 新建」创建视频 / 脚本 / 字幕 / 封面 / 文章 / 发布。" }),
							note !== null && (0, react_jsx_runtime.jsx)("div", {
								className: note.startsWith("✓") ? "mxWfOk" : "mxWfErr",
								children: note
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("main", {
						className: "mxWsCenter",
						children: detail === null ? (0, react_jsx_runtime.jsx)("div", {
							className: "mxWsEmpty",
							children: "从左侧选择一个内容，或点击「＋ 新建」。"
						}) : (0, react_jsx_runtime.jsx)(ContentDetail, { detail, setDetail, sessionId, setNote })
					}),
					(0, react_jsx_runtime.jsx)("aside", {
						className: "mxWsRight",
						children: (0, react_jsx_runtime.jsx)(AgentContextPanel, {
							detail,
							running,
							onSubtitle: () => startGenerate("subtitle"),
							onCover: () => startGenerate("cover"),
							onOpenChat: () => {
							}
						})
					})
				]
			});
		}

		/** Client plugin body: intelligence Remote + slots + settings + styles.
		 * The contentProjects / contentWorkflows client services and window
		 * bridges are provided by @maomao/content-projects and
		 * @maomao/content-workflows (this plugin never re-mounts them). */
		function apply(ctx) {
			ci = createIntelligenceService(ctx);
			window.__maomaoContentIntelligence = ci;
			cm = createContentManagerService(ctx);
			window.__maomaoContentManager = cm;
			window.__maomaoWorkspaces = ctx.get("workspaces") ?? null;

			ctx.remote.$mount(INTELLIGENCE_CONTRIBUTION).catch((error) => {
				console.error("maomao-workbench: intelligence mount failed:", error);
			});
			ctx.remote.$mount(CONTENT_MANAGER_CONTRIBUTION).catch((error) => {
				console.error("maomao-workbench: contentManager mount failed:", error);
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

			// Phase 6: 内容管理 workspace (beside the chat view tab; the sidebar
			// exposes no official nav-item slot — conversation.view is the
			// official extension point rendered beside the Chat tab).
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "maomao-content-manager",
				order: 6,
				label: "内容管理",
				inject: (sessionId) => ({ sessionId })
			}, ContentManagerWorkspace));

			// Plugin configuration card: registered into settings.plugin.item keyed
			// by this plugin's settings namespace, so it renders INSIDE
			// 设置 → 插件 → 可配置插件 alongside the other plugin cards.
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: "maomao-workbench"
			}, WorkbenchPluginCard));

		}
		exports.apply = apply;
		exports.inject = ["remote", "slots", "settingsScope", "sessions", "workspaces"];
		return module.exports;
	}
});
