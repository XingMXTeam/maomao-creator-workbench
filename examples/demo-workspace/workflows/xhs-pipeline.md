# 小红书内容流水线（xhs-pipeline）

状态：v1 · 适用预设：毛毛星小红书工作台
本文件是流水线的完整规范。AGENTS.md 是它的执行摘要。

## 阶段总览

| # | 阶段 | 产出文件 | 关键动作 | 门禁 |
|---|---|---|---|---|
| 0 | 选题 | `brief.md` | 评分、核心矛盾、research plan | 评分 ≥ 70 才继续 |
| 1 | 深度调研 | `research.md` | web_search / web_fetch、信源分级 | 覆盖矛盾双方、≥3 独立信源 |
| 2 | 事实核查 | `facts.md` | 每条事实标注来源/级别/口径 | 关键事实有 S/A 级来源 |
| 3 | 核心观点 | `thesis.md` | 一句话主张 + 证据 + 反方 | 观点可被反驳（非废话） |
| 4 | 小红书文字版 | `draft.md` | 加载 `xhs-writing` | publish-check 通过 |
| 5 | Canva 图文结构 | `carousel.md` | 加载 `canva-carousel` | 页面级结构完整 |
| 6 | 发布检查 | `publish.md` | 加载 `publish-check` | 全 PASS，或 FAIL 已说明 |
| 7 | 归档 | `status.json` | 收尾清理 | stage = archived |

## 阶段 0 · 选题

**只收到一个选题时，禁止直接写稿。** 按顺序执行：

1. **评分**：用 `knowledge/content-strategy.md` 的评分表打分并说明理由。低于阈值 → 明确说「不建议写」并给原因与替代角度。
2. **核心矛盾**：用三步法输出一句话张力（谁 vs 谁 / 什么变了 / 为什么现在）。
3. **research plan**：列出要验证的 3–5 个问题、需要的信源类型与数据。
4. 把以上写入 `projects/YYYY-MM-DD-slug/brief.md`，然后征询用户是否继续调研。

## 阶段 1 · 深度调研

- 先按 research plan 执行，用 `web_search` 发现、`web_fetch` 读取全文。
- 至少 3 个独立信源；记录**反方证据**（不能只找支持自己的材料）。
- 涉及投资/公司/财报 → 先加载 `investment-judgment`，遵守其信源分级。
- 产出 `research.md`：调研笔记、信源清单（含 URL）、关键数据、反方观点。

## 阶段 2 · 事实核查

`facts.md` 用表结构维护：

| 事实 | 来源 | 级别(S/A/B/C) | 口径 | 状态 |
|---|---|---|---|---|
| 例：伯克希尔 Q3 买入 XX 股 | SEC 13F 原文 | S | 截至 2025-09-30 | 已核 |

- 关键事实必须可回溯到 S/A 级来源。
- 存疑事实必须标注「待核」，不得写进 draft。

## 阶段 3 · 核心观点

`thesis.md` 结构：

- 一句话主张（可被反驳的判断题，不是复述事实）
- 支撑证据（≥2 条，引用 facts.md 条目）
- 反方观点与回应
- 读者能带走什么（1 个判断框架 / 清单 / 数字）

## 阶段 4 · 小红书文字版

- 加载 `xhs-writing`，输入 thesis/draft/facts，输出标题 ×3、正文 400–800 字、话题标签 5–8 个。
- 遵循 `knowledge/brand-voice.md` 语感。

## 阶段 5 · Canva 图文结构

- 加载 `canva-carousel`，输出页面级结构（封面 → 内容页 → 结尾页），写入 `carousel.md`。
- 产出的是页面结构与每页文案/版式要点，不生成图片。

## 阶段 4.5 · 内容质量检查（Critic，Phase 4 新增）

- draft 完成后可调用 critic 动作（`@maomao/content-intelligence` 提供，不改变既有阶段）。
- 流程：draft → critic → revision。Critic **只审查、不重写**：不修改 draft.md，只产出 `projects/<slug>/critique.md`。
- 审查五维：事实可靠性 / 观点质量 / 用户价值 / 风格检查 / 投资内容检查；知识加载见 `knowledge/content-system/workflow.md`。
- critique.md 结尾含机器可读 JSON（score/issues/suggestions），UI 据此展示评分与修改建议。
- 评分门槛：≥85 可直接发布；70–84 需小改；<70 需重写关键部分。

## 阶段 6 · 发布检查

- 加载 `publish-check`，逐项检查：事实、标题、可读性、判断质量、潜在空话、合规（投资类必须有风险提示）。
- 结果写入 `publish.md`；未通过的项必须给出修改建议。

## 阶段 7 · 归档

- `status.json` 更新为 archived，记录发布时间与链接（如有）。
- 清理临时笔记；保留 8 个契约文件。

## 子代理分工（可选，按需使用 subagent）

- **Researcher**：阶段 1–2 的调研与事实核查（后台运行，返回 research.md / facts.md 素材）。
- **Editor**：阶段 4 的文字润色。
- **Fact Checker**：阶段 2 / 6 的交叉核查。

## 模拟路由示例

输入：「伯克希尔最近为什么开始买股票？」

1. 评分：信息增量高、时效高、与账号定位契合 → 通过。
2. 核心矛盾：「十年几乎不买、突然开始买——是价值投资失效，还是它发现了新的便宜货？」
3. research plan：买了什么（13F/公告）？为什么现在（现金堆积/市场环境）？市场如何解读（分歧点）？
4. 调研：SEC 13F、伯克希尔季报、主流财经媒体与反方评论。
5. 结论（thesis）：一句话主张 + 证据 + 反方。
6. 用户说「做成小红书」→ 加载 xhs-writing 产出文字版。
