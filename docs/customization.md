# Customization

The workbench is a **generic engine**; content rules live in a **Creator
Profile** (default: `profiles/maomao`). Fork the repo and change the profile —
never the engine — to make it yours.

## 1. Your own Creator Profile

Create `profiles/<my-profile>/` with:

```
profiles/<my-profile>/
├── profile.json          # id, name, positioning, series, rules map
├── knowledge/            # your content rules (see profiles/maomao/knowledge)
│   └── index.json        # action → file load groups
└── style-rules.json      # your style engine rules
```

Point the profile at its rule files in `profile.json`:

```json
{
  "id": "finance-creator",
  "name": "Finance Creator",
  "series": ["价值投资", "宏观", "财报解读"],
  "rules": {
    "tone": "knowledge/brand/tone.md",
    "quality": "knowledge/content-system/quality-standard.md",
    "style": "style-rules.json"
  }
}
```

## 2. Workspace-level override (no fork needed)

The scaffolded workspace is fully yours to edit:

- `knowledge/**` — writing / quality / investment rules (re-read per task)
- `style-rules.json` — the workspace copy wins over the package default
- `AGENTS.md` — the agent runbook for that workspace

Nothing is overwritten on upgrade or re-install.

## 3. Series & platforms

Settings → 毛毛星内容工作台:
- **Workspace** — pick your content directory (default: the active session's cwd).
- **Content Series** — add/remove the series chips shown in the Dashboard.
- **Platforms** — 小红书 / 公众号 / 视频号 / X are placeholders (Coming Soon);
  integrations land in later versions and are never faked as available.

## 4. Knowledge on demand

`knowledge/index.json` maps actions to files:

```json
"loadGroups": {
  "draft": ["brand/tone.md", "writing/title-rules.md", "writing/structure-rules.md"]
}
```

Add your own groups (e.g. `"my-action": ["my-rules.md"]`) and the agent will
load exactly those files when that action runs.

## 5. Skills

Ship your own skills under `skills/<name>/SKILL.md`; install scaffolds them into
the workspace `.dsh/skills/` (existing files untouched). The agent loads them by
trigger word (e.g. 「做成小红书」→ `xhs-writing`).
