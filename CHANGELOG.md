# Changelog

All notable changes to Maomao Creator Workbench are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-08-20

### Added
- **Pluginized architecture**: Phase 1–4 local patches refactored into one
  installable package `maomao-creator-workbench` (host + client + profile +
  templates), mounted as a single Cordis plugin row — **no DeepSeek Harness
  file is modified**.
- **ContentProjects** (`lib/host/projects.js`): project.json + 7 artifact
  files + status/stage + session binding.
- **ContentWorkflows** (`lib/host/workflows.js`): research / facts / thesis /
  draft / publish-check actions + stage guards + workflow state.
- **ContentIntelligence** (`lib/host/intelligence.js`): knowledge schema
  (`knowledge/index.json`) with on-demand `knowledgePlan`, style engine
  (`style-rules.json`, workspace-overridable), Critic agent
  (draft → critique.md with score/issues/suggestions), `status()` probe.
- **Creator UI via official slots** (`lib/client.js`):
  - `conversation.view` — Workbench tab (Dashboard / ProjectDetail)
  - `settings.section` — settings card (环境状态 / Workspace / Series / Platforms / Content Rules)
  - `sidebar.footer.action` — 内容项目 button
  - `shell.overlay` — full-frame workbench panel
- **Creator Engine + Creator Profile separation**: default `profiles/maomao`
  profile (positioning, series, rules, style-rules.json); workspace copies
  override package defaults.
- **Install / uninstall**: `npm run install:local` / `npm run uninstall:local`
  (idempotent, non-destructive to user content, stock-profile bootstrap for
  fresh machines).
- **Workspace scaffold**: `templates/workspace` (AGENTS.md, knowledge, skills,
  workflow spec) copied only when files are missing.
- **Tests**: unit (28), integration (13), persistence (5), real cold boot,
  clean-environment install (13) — all passing.
- **Docs**: README (EN + 简体中文), LICENSE (MIT), CONTRIBUTING, CHANGELOG,
  docs/architecture, docs/workflow, docs/plugin-development, docs/customization.

### Notes
- Developer Preview: no Canva/Notion integration yet (Coming Soon in the
  settings card); no auto-publish; demo data in `examples/demo-workspace` is
  fictional.
