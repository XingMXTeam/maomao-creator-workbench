# examples/ 示例库

存放「成品样例」供 Agent 与 Critic 参考格式，不存放规则本身（规则在各分类目录）。

## 现有示例

- （暂无成品示例。Critic 运行后，把质量好的 critique.md 匿名化后复制到 `examples/critique-<主题>.md`，作为后续 Critic 的格式参照。）

## critique.md 格式样例（Critic 输出契约）

```markdown
# Critique — <项目标题>

## 总体评价

<2–4 句中文总体评价，指出最大问题与整体质量>

## 逐项检查

- [FAIL] 事实可靠性 — <说明>
- [PASS] 观点质量 — <说明>
- [WARN] 用户价值 — <说明>
- [FAIL] 风格检查 — <说明>
- [PASS] 投资内容检查 — <说明>（涉及时）

```json
{
  "score": 72,
  "issues": ["[风格] 标题没有体现冲突", "[观点] 最后判断过于宽泛"],
  "suggestions": ["[风格] 把标题改成「十年不买、突然开始买——伯克希尔发现了什么？」", "[观点] 补充估值与盈利能力分析"]
}
```
```

> 注意：JSON 代码块是机器可读部分，UI 读取它显示 score/issues/suggestions；上面的 prose 是人读部分。
