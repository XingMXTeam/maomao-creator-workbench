# Maomao Creator Workbench — Repository Guide

This repository is the source of truth for the Maomao Creator Workbench plugin.
It is a **generic creator engine**; the `profiles/maomao/` directory is only the
default Creator Profile (content rules are data, not engine code).

## Layout

```
lib/
  index.js            plugin assembler (host apply)
  client.js           browser bundle (UI via official Slots + Remote namespaces)
  style-rules.json    default style engine rules (package fallback)
  host/
    projects.js       ContentProjects — project.json + artifacts + state + binding
    workflows.js      ContentWorkflows — actions + stage guards
    intelligence.js   ContentIntelligence — knowledge/style/critic/status
    settings.js       durable settings namespace
profiles/maomao/      default Creator Profile (knowledge + style-rules.json)
templates/workspace/  scaffold for user workspaces (AGENTS.md, knowledge, skills)
skills/               shipped skills (xhs-writing, canva-carousel, publish-check, investment-judgment)
scripts/              install-local / uninstall-local / verify / secret-scan
tests/                unit / integration / persistence / cold-boot / clean-install
examples/demo-workspace/  fictional demo project (why AI Coding Agent…)
docs/                 architecture / workflow / plugin-development / customization
```

## Working here

- Host modules are plain ESM. `export const name / inject / apply` only, no
  default export, every `ctx.<service>` explicitly injected.
- The client bundle is the single loader-format file `lib/client.js`; edit it
  directly (it is the shipped artifact). UI components are self-contained
  React (no JSX — compiled `react_jsx_runtime` calls).
- Never modify DeepSeek Harness installation files. Use official extension
  points (see `docs/plugin-development.md`). If an extension point is missing,
  isolate the workaround in the plugin's own code, never in Harness bundles.

## Commands

| Command | Purpose |
|---|---|
| `npm run install:local` | install into `$DSH_HOME` profile (idempotent) |
| `npm run uninstall:local` | remove plugin (user content untouched) |
| `npm run verify` | syntax + secret scan + fast test suites |
| `npm test` | full suite incl. cold boot + clean install |
| `npm run secret-scan` | secrets / private data scan |

## Content discipline

- `projects/` and `knowledge/` at the repo root are gitignored — user content
  never enters the repo.
- `examples/demo-workspace` is fictional; keep it that way.
- `/Users/yourname` and `~` are the only allowed path examples in docs.
