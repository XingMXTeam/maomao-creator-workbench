# Plugin Development

How the workbench plugs into DeepSeek Harness, and how to extend it.

## How a plugin mounts

Harness composes a profile from ordered patch layers. This repository ships one
npm package (`maomao-creator-workbench`) whose `package.json` declares a client
half (`dsh.client.platform: web`) and whose host half exports a Cordis plugin:

```js
export const name = "maomao-creator-workbench";
export const inject = ["typert", "agents", "systemPrompt", "settings"];
export function apply(ctx, config) { ... }
```

- `scripts/install-local.mjs` copies the package into
  `$DSH_HOME/profiles/node_modules/` and inserts one row into the profile patch
  (`cordis.patch.yml`) — nothing inside the Harness installation is touched.
- The **host half** is plain ESM. Every `ctx.<service>` must be listed in
  `inject`. No `export default apply`.
- The **client half** is a single browser bundle in the shell module-loader
  format (`window.__ModuleLoader__.load({ id, factory })`), hand-authored in
  this repo at `lib/client.js`. It may `require` only seed words exposed by the
  shell (`react`, `react/jsx-runtime`, …) and consume services via `ctx.get`.

## Adding a UI surface (official slots)

Register inside `apply(ctx)` with `ctx.slots.inject(name, () => ctx.slots.register({...}, Component))`.
List slots take `{ id, order, label }`; the component receives owner props.

Verified live slots used here:

| Slot | Purpose |
|---|---|
| `conversation.view` | a session view tab (the Workbench) |
| `settings.section` | a settings page |
| `sidebar.footer.action` | a button beside Settings |
| `shell.overlay` | a frame-wide floating layer (opt back into pointer events) |

## Adding a Remote (host → browser)

Host: extend a service in `lib/host/*.js`, add a descriptor to its
`build*Contribution()`, and register it via `ctx.typert.register(...)`.
Client: add the matching descriptor to the namespace contribution in
`lib/client.js` and call it through the namespace helper. Keep the descriptor
`id` (`maomao-creator-workbench#<namespace>/<method>`) identical on both sides.

## Adding a settings field

Host `lib/host/settings.js` — extend `WorkbenchSettingsSchema` (schemastery).
Client — read/write through `ctx.settingsScope.bind({ namespace: "maomao-workbench" })`.

## Compatibility policy

The workbench depends only on documented, runtime-verified extension points. If
a Harness upgrade changes one, fix it in the plugin's own modules (ideally in a
small compat section) — **never** fall back to patching Harness bundles.

## Testing

```bash
npm run verify          # syntax + secret scan + unit + integration + persistence
npm test                # + real cold boot + clean-environment install
```

See `tests/` — unit (guards, style engine, critic), integration (full pipeline
with a fake agent), persistence (restart round-trip), cold boot (real
`dsh web`), clean install (brand-new DSH_HOME).
