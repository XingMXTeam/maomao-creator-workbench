# Maomao Creator Workbench — Architecture

## Positioning

The workbench turns DeepSeek Harness from a chat tool into a **project-based AI
creator workspace**. It is a single installable plugin package that contributes
host services, a browser UI, and an agent prompt layer — without modifying any
DeepSeek Harness installation file.

## Layered design

```
DeepSeek Harness (runtime: Cordis + web shell + agent loop)
        │  official extension points only
        ▼
maomao-creator-workbench (one npm package, one Cordis plugin row)
   ├── lib/host/        host services (state / action / intelligence / settings)
   ├── lib/client.js    browser UI via Slots + Remote namespaces
   ├── profiles/<id>/   Creator Profiles (content rules, replaceable)
   └── templates/       workspace scaffold (AGENTS.md / knowledge / skills)
        │
        ▼
projects/<slug>/        single source of truth per content project
   ├── project.json     machine state (status / stage / workflow / binding)
   ├── brief.md · research.md · facts.md · thesis.md · draft.md
   ├── carousel.md · publish.md
   └── critique.md      Critic output (score / issues / suggestions)
```

## Responsibility boundaries

| Module | Owns | Never touches |
|---|---|---|
| `lib/host/projects.js` — ContentProjects | project.json, artifact files, status/stage, session binding | content logic |
| `lib/host/workflows.js` — ContentWorkflows | actions research/facts/thesis/draft/publish-check, stage guards, workflow state | content itself |
| `lib/host/intelligence.js` — ContentIntelligence | knowledge schema & on-demand loading, style rules, quality standard, Critic, context routing | project state files |
| `lib/host/settings.js` | durable user settings (workspace root / series / platforms / profile) | — |

The three modules are separate files; the plugin `apply()` is a thin assembler.

## Extension points used (verified against the live runtime)

**Host**
- `typert.register(...)` — Remote endpoints (`contentProjects` / `contentWorkflows` / `contentIntelligence` namespaces)
- `systemPrompt.section(...)` — project-context + knowledge-index prompt sections
- `settings.register(...)` — durable settings namespace `maomao-workbench`
- `agents` — driving the project-bound session's agent for workflow actions and Critic

**Client**
- `slots.register(...)` on:
  - `conversation.view` — the Workbench tab (Dashboard / ProjectDetail)
  - `settings.section` — the settings card (毛毛星内容工作台)
  - `sidebar.footer.action` — the 内容项目 button
  - `shell.overlay` — the full-frame workbench panel
- `remote.$mount(...)` — the three Remote namespaces
- `settingsScope.bind(...)` — settings read/write

**No DeepSeek Core bundle is modified.** If a future Harness version changes an
extension point, only the corresponding compat code changes — see
`docs/plugin-development.md`.

## Creator Engine + Creator Profile

The engine is generic; the content rules come from a Profile:

- `profiles/maomao/` ships by default (positioning, series, writing rules,
  quality standard, investment rules, visual rules, style-rules.json).
- The active profile's knowledge is scaffolded into the workspace
  `knowledge/` + `style-rules.json` on install (never overwrites existing).
- Users fork the workbench and add `profiles/<my-profile>/` without touching
  engine code.

## Persistence

Everything durable lives in the user's workspace on disk:
`projects/<slug>/` + `knowledge/` + `style-rules.json`. The plugin is stateless
across boots except transient Critic run state.
