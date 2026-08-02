# Contributing

Thanks for helping make Codex Desktop Linux a dependable community client.
Small, well-evidenced improvements are easier to review and safer to ship than
broad rewrites.

## Before you start

1. Search existing issues and recent pull requests.
2. Read [AGENTS.md](AGENTS.md) and [TODO.md](TODO.md) completely.
3. Check `git status` and preserve unrelated work.
4. Identify the module that owns the behavior and its nearest tests.

`AGENTS.md` is the durable engineering contract. `TODO.md` is the current
handoff, not a backlog of every possible idea. Protocol coverage and interface
decisions live in [APP_SERVER_COVERAGE.md](APP_SERVER_COVERAGE.md) and
[UI_ARCHITECTURE.md](UI_ARCHITECTURE.md).

## Development setup

You need Node.js 22.12 or newer and an authenticated `codex` CLI:

```bash
git clone https://github.com/B4PT0R/codex-desktop-b4pt0r.git
cd codex-desktop-b4pt0r
npm ci
codex --version
npm run electron:dev
```

Use `npm run dev` for interface-only iteration with simulated data. Native
behavior, App Server integration, permissions, audio, tray handling and
packaging must still be checked in Electron.

## Choose a bounded change

- Fix one observable problem or add one coherent capability at a time.
- Include loading, unavailable, failure, cancellation and recovery behavior
  when those states apply.
- Keep protocol quirks at the typed boundary instead of spreading raw payloads
  through components.
- Avoid dependency upgrades, visual redesign and refactoring in the same pull
  request unless they are inseparable from the change.

For App Server work, record the exact `codex --version`, generate or inspect its
v2 schema, and compare the official Codex source when available. Never infer a
wire shape from a screenshot or model name.

For interface work, validate representative light and dark states at 1240×820
and 840×620. Refresh curated screenshots only when the public interface
meaningfully changes.

## Verify the result

Run the checks that match the change:

```bash
npm run check
npm test
npm run test:electron
npm run build
```

Also run:

- `npm run test:contract` for App Server requests or protocol changes;
- `npm run electron:dev` for native lifecycle, tray, audio, permissions or
  packaging behavior;
- `npm run electron:linux` when Linux packaging changes.

The default test command and continuous-integration workflow are deterministic
and do not require a local Codex installation. The contract suite remains a
separate compatibility check because it generates schemas from the exact
`codex` binary installed on the contributor's machine; report that version with
its result.

If a check cannot run, state exactly what was skipped and why. A regression fix
should include a test that would have failed before the fix whenever practical.

## Open a pull request

Keep the pull request focused and explain:

- the user-facing problem and root cause;
- the chosen behavior and important tradeoffs;
- the validation performed, including environment details;
- any compatibility risk or intentionally deferred follow-up.

Include before/after images for meaningful visual changes. Do not include
credentials, auth tokens, private conversation content, full environment dumps
or unredacted diagnostics.

Agent-assisted contributions are welcome. The contributor remains responsible
for understanding the patch, keeping its scope intentional and reporting real
verification rather than generated claims.
