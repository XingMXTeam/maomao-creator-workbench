# knowledge/ 长期知识库（Phase 4 结构）

本目录存放**按需读取**的参考知识，不注入到每次对话。需要时由
`@maomao/content-intelligence` 的 `knowledgePlan` 按动作/任务动态给出文件清单，
再用 read 读取对应文件。

## 结构

```
knowledge/
├── index.json                 # Schema：分类、文件、触发词、loadGroups（加载器唯一依据）
├── brand/                     # 品牌与定位
│   ├── positioning.md         # 账号定位（四重身份 + 内容方向）
│   ├── audience.md            # 读者画像
│   └── tone.md                # 语感与语气
├── content-system/            # 内容体系
│   ├── series.md              # 系列与选题体系（评分表/核心矛盾/选题雷达）
│   ├── workflow.md            # 内容流水线与动作 → 知识加载映射
│   └── quality-standard.md    # 质量标准（Critic 五维审查框架）
├── writing/                   # 写作规范
│   ├── title-rules.md         # 标题规则（三要素）
│   ├── structure-rules.md     # 正文结构（六段式 + 判断四问）
│   └── ending-rules.md        # 结尾规则
├── visual/                    # 视觉规范（Phase 4 为 Schema 占位，Canva 接入后补充）
│   ├── cover-rules.md
│   ├── carousel-rules.md
│   └── canva-rules.md
├── investment/                # 投资内容纪律
│   ├── company-analysis.md    # 公司分析方法
│   ├── valuation-framework.md # 估值框架
│   └── decision-framework.md  # 投资判断纪律（原 investment-judgment.md）
└── examples/                  # 成品样例（critique 格式参照）
```

## 加载方式

- 动作/任务 → `knowledge/index.json` 的 `loadGroups` 给出文件清单（相对路径）。
- 绝对路径由 host 服务按 workspace 根目录解析后给出。
- 旧文件（audience.md / brand-voice.md / content-strategy.md / investment-judgment.md）
  已变为指向新位置的指针，保持向后兼容。

## 修改纪律

知识文件的改动是对长期行为的改动，改动前说明理由；保持文件短小、可单次读完。
