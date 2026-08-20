# Creator Workbench · Workspace 运行手册

本 workspace 是「Maomao Creator Workbench」的内容生产目录。进入本目录的每个会话都按本手册工作：**这是一台内容创作工作台，不是通用编程 Agent。**

## 工作流总览

选题 → 深度调研 → 事实核查 → 核心观点 → 小红书文字版 → Canva 图文结构 → 发布检查 → 归档

完整流程规范见 `workflows/xhs-pipeline.md`；本文件是它的执行摘要，两者冲突时以 `workflows/xhs-pipeline.md` 为准。

## 输入路由

| 用户输入 | 动作 |
|---|---|
| 只发一个选题（如「为什么 AI Coding Agent 越来越流行？」） | 评分 → 核心矛盾 → research plan → 调研 → 结论；**不直接写稿** |
| 「做成小红书」 | 用 `skill` 工具加载 `xhs-writing`，产出文字版 |
| 「做图文」 | 加载 `canva-carousel`，输出页面级图文结构 |
| 「检查一下」 | 加载 `publish-check`，执行发布前检查 |
| 「质量检查」 | 运行 Workbench 的 Critic 动作，产出 critique.md（只审查不重写） |
| 内容涉及投资 / 公司 / 财报 / 股票 / 基金 | 自动加载 `investment-judgment`，叠加到 thesis 与 publish 阶段 |

## 项目目录契约

每个正式选题在 `projects/YYYY-MM-DD-slug/` 下建项目目录（slug 用英文小写连字符），至少维护 8 个文件：

| 文件 | 内容 |
|---|---|
| `brief.md` | 选题来源、目标读者、切入角度、一句话目标 |
| `research.md` | 调研笔记、信源清单、关键数据（含反方证据） |
| `facts.md` | 事实核查表：每条事实 + 来源 + 信源级别 + 口径 + 状态 |
| `thesis.md` | 核心观点：一句话主张 + 支撑证据 + 反方观点与回应 |
| `draft.md` | 小红书文字版草稿 |
| `carousel.md` | Canva 图文页面级结构 |
| `publish.md` | 发布信息：标题、话题标签、封面文案、发布时段 |
| `critique.md` | 内容质量检查结果（Critic 产出：score / issues / suggestions） |

**重大改动先更新文件，再在聊天里汇报。** 聊天只保留摘要，完整状态以文件为准。

## 降噪规则

- 不主动扫描整个 workspace；只读取需要的具体文件（glob/read 定位）。
- `knowledge/` 是参考库，按需读取，不重复注入全部内容。
- `.dsh/skills/` 是技能库，按触发词加载，不批量加载。
- 长文档落盘为项目文件，聊天上下文里不重复存放。

## 知识索引（按需读取）

`knowledge/index.json` 是加载索引（动作/任务 → 文件清单），由 Workbench 的 `knowledgePlan` 按需解析。规则文件来自当前 Creator Profile（默认 `maomao`），可在本 workspace 直接修改 `knowledge/` 与 `style-rules.json` 覆盖。

## 红线

- 不做大型 Dashboard UI（工作台 UI 由插件提供）。
- 不依赖未配置的 Canva / Notion 密钥。
- 不自行发帖；发布必须人工执行。
- 任何外部写操作（发帖、外部 API、写入 workspace 之外）都先征得确认。
