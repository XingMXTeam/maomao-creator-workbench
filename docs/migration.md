# Migration plan — from local patches to the plugin (Strangler)

This document records how the original machine (the author's local `~/.dsh` +
workspace) migrates from the Phase 1–4 local patches to the pluginized repo —
**without breaking the working system**. Paths are generic; adapt to your own
machine.

## What a patched local env typically has

| # | Artifact | Where |
|---|---|---|
| P1 | Rebranded shell (index.html / manifest / minified bundle) | Harness install dir + `$DSH_HOME/profiles/web/rebrand-backup/` |
| P1 | Patched UI bundles (workspace / conversation / sidebar / primitives) | Harness install dir + backups |
| P2–4 | `@maomao/content-projects`, `content-workflows`, `content-intelligence` | `$DSH_HOME/profiles/node_modules/@maomao/` |
| P2–4 | Profile patch rows | `$DSH_HOME/profiles/web/cordis.patch.yml` |
| WS | `knowledge/`, `AGENTS.md`, `workflows/`, `.dsh/skills/`, `projects/` | workspace |
| PS | A custom agent preset | `$DSH_HOME/.agent-presets/<id>/` |

## Migration steps (rollback-safe, one gate at a time)

### Phase A — verify parity (DONE via the test suite)
- The repo passes unit/integration/persistence, real cold boot, and a
  brand-new-DSH_HOME install→boot→uninstall round trip.
- Host logic is the proven Phase 2–4 code (imports rewired); UI is the same
  components mounted through official slots.

### Phase B — install the plugin in the live env (new + old coexist)
1. `cd <repo> && npm run install:local` — adds the `maomao-creator-workbench`
   row beside the old rows (old patch rows stay in place).
2. Restart `npx @deepseek-ai/dsh web`.
3. Verify: new Workbench tab + settings card + sidebar button work; old
   Dashboard/Detail still render (they coexist; both read the same `projects/`).

### Phase C — disable the old UI patches
4. The old Phase 1 UI came from edited core bundles; restore the pristine
   bundles from `rebrand-backup/` (see REBRAND.md rollback table) once the new
   UI is accepted. Backups remain in `rebrand-backup/` — nothing is deleted
   permanently.
5. Restart + verify the workbench alone.

### Phase D — remove the old plugin rows
6. Remove `content-projects` / `content-workflows` / `content-intelligence`
   rows from `cordis.patch.yml` (keep `maomao-creator-workbench`).
7. Optionally remove `$DSH_HOME/profiles/node_modules/@maomao/` — only after
   the new package is confirmed working for at least one full pipeline run.
8. Restart + cold boot verification (same checks as the test suite).

### Rollback at any point
- Restore `cordis.patch.yml` from backup (old rows back).
- Keep `$DSH_HOME/profiles/node_modules/@maomao/` until Phase D is accepted.
- `rebrand-backup/` + REBRAND.md preserve every Phase 1 file.

## Explicitly kept (never deleted)
- REBRAND.md, rebrand-backup/, old implementations — until the plugin-only
  environment is accepted.
- Workspace content (`projects/`, `knowledge/`, `AGENTS.md`, skills) is never
  touched by any migration step.

## Not in scope for Phase 5
Canva integration, auto-publish, multi-agent collaboration, parallel projects,
new topic radar, UI animation.
