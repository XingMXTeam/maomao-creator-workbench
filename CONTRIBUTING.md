# Contributing

Thanks for considering contributing to Maomao Creator Workbench. This project
is a **generic creator engine** — the 毛毛星 content rules are just the default
profile. Contributions that keep the engine generic are welcome.

## Local development

```bash
git clone <repo>
cd maomao-creator-workbench
npm install          # dev tooling
npm run verify       # syntax + secret scan + unit + integration + persistence
npm test             # + real cold boot + clean-environment install
```

> Note: host modules resolve their runtime dependencies from the Harness
> profile's flat module table. On this machine the repo symlinks
> `node_modules → ~/.dsh/profiles/node_modules` for local dev (gitignored).

## Starting Harness with the plugin

```bash
npm run install:local           # copy package + add plugin row
npx @deepseek-ai/dsh web        # restart; the plugin mounts on boot
```

## Debugging a plugin

- Host side: logs go to the `dsh web` process output; `ctx.logger` calls are
  prefixed with the plugin name.
- Client side: open DevTools; errors are tagged `maomao-workbench:`.
- Remote round-trips: check the boot manifest entry
  (`window.__DSH_BOOT__` → `maomao-creator-workbench`) and that the client
  bundle URL returns 200.

## Adding a workflow action

1. Add the action to `lib/host/workflows.js` (`WORKFLOW_ACTIONS`,
   `ARTIFACT_OF`, `ACTION_GUARD`, `TASKS`, `ACTION_LABELS`).
2. Add the artifact to the UI action list in `lib/client.js` and the
   project's file tabs.
3. Map the action to knowledge in `templates/workspace/knowledge/index.json`
   (`loadGroups`) — the agent then loads only the relevant rules.
4. Add a unit test asserting the guard + artifact verification.

## Adding a Creator Profile

Create `profiles/<my-profile>/` with `profile.json` + `knowledge/` +
`style-rules.json` (see `docs/customization.md`). Keep the engine untouched —
a profile is data, not code.

## Adding an integration

The settings card lists platforms (小红书 / 公众号 / 视频号 / X) as
Coming Soon. An integration means:

1. A host service that talks to the platform (credentials via the Harness
   credential service, never hardcoded).
2. A Remote + client surface that drives it (publish → draft → schedule).
3. A settings field that flips the platform from "Coming Soon" to "已配置".
4. Tests with the integration mocked.

## Running tests

| Command | Covers |
|---|---|
| `npm run test:unit` | guards, style engine, critic, knowledge plan |
| `npm run test:integration` | create → research → facts → thesis → draft → critic |
| `npm run test:persistence` | restart round-trip of projects/artifacts |
| `npm run test:cold-boot` | real `dsh web` boot on a fresh DSH_HOME |
| `npm run test:clean-install` | install → boot → uninstall on a brand-new DSH_HOME |
| `npm run secret-scan` | secrets & private data scan |

## Commit conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Run `npm run verify` before pushing.
- Never commit: real content, credentials, `.env`, local paths, screenshots
  with private data. Demo data must stay fictional.
