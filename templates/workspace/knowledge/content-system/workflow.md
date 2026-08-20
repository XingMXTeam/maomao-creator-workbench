# 内容流水线与动作（workflow）

> 完整规范：`workflows/xhs-pipeline.md`（唯一权威）。本文件是「动作 → 知识加载」的映射，供 Content Intelligence 按需加载知识时使用。

## 流水线

选题 → 深度调研 → 事实核查 → 核心观点 → 小红书文字版 → Canva 图文结构 → 发布检查 → 归档

| 动作 | 产出文件 | 前置要求 |
|---|---|---|
| research | research.md | brief.md |
| facts | facts.md | research.md 非空 |
| thesis | thesis.md | facts.md 非空 |
| draft | draft.md | thesis.md 非空 |
| critic（Phase 4） | critique.md | draft.md 非空（**只审查，不修改 draft**） |
| publish-check | publish.md | draft.md 非空 |
| canva | carousel.md | draft.md 非空 |

## 动作 → 知识加载（knowledgePlan 依据）

| 动作/任务 | 加载 |
|---|---|
| topic（选题） | brand/positioning、brand/audience、content-system/series |
| research（调研） | content-system/series、content-system/workflow、investment/decision-framework（涉投资时） |
| company-analysis（写公司研究） | investment/company-analysis、investment/valuation-framework、content-system/series、writing/structure-rules |
| business-observation（写普通商业观察） | brand/tone、writing/title-rules、brand/audience |
| facts（事实核查） | investment/decision-framework、content-system/workflow |
| thesis（生成观点） | investment/decision-framework、content-system/series、writing/structure-rules |
| draft（写小红书） | brand/tone、brand/audience、writing/title-rules、writing/structure-rules、writing/ending-rules |
| critic（质量检查） | style-rules.json、content-system/quality-standard、writing/title-rules、writing/structure-rules、brand/tone |
| publish-check（发布检查） | content-system/quality-standard、writing/title-rules、investment/decision-framework |

## 纪律

- 不要一次读入全部 knowledge；只读当前动作命中的文件。
- 文件读入后聊天里只保留结论，长内容落盘为项目产物文件。
