# Codex Desktop Linux — Handoff

Last updated: 2026-07-31

Read `AGENTS.md` before contributing. Durable protocol and interface decisions
belong in `APP_SERVER_COVERAGE.md` and `UI_ARCHITECTURE.md`; release history
belongs in `CHANGELOG.md` and Git.

## Baseline

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. The current public release is v0.3.17.

The daily workflow covers conversation replay and concurrent activity,
streaming Markdown/LaTeX, reasoning, plans, tools, approvals, diffs, files,
images, permissions, models, quotas, goals, dictation, Realtime voice, global
configuration, skills, Apps, MCP, memory, remote control, scheduled tasks and a
shared Playwright Chromium session.

Compatibility is currently verified against installed `codex-cli 0.145.0`.

## Latest release

Release v0.3.17 is a focused lifecycle and concurrency stabilization lot. It:

- isolates Realtime startup and transcript state by parent conversation, keeps
  bounded voice transcript caches across temporary navigation, and serializes
  reset/stop/remote-close so a stale start cannot stop the next session;
- prevents delayed thread creation, shell commands, turns and voice startup
  from stealing or mutating a newer visible conversation;
- ignores unscoped App Server errors in the conversation queue and keeps busy,
  activity and terminal transitions strictly thread-scoped;
- makes App Server startup single-flight and cancellation-safe;
- serializes shared-browser enable/disable through persistence, isolates stale
  Chromium promises, bounds MCP header/body/SSE waits, and cleans partially
  initialized MCP sessions and temporary browser artifacts;
- restricts renderer navigation to the exact app entry point, makes native
  event delivery non-throwing, and limits automatic renderer recovery to two
  attempts per minute before presenting a stable restart message;
- accepts only allowlisted, exactly typed desktop preference patches while
  preserving unknown fields already stored for forward compatibility;
- adds deterministic GitHub CI, separates installed-Codex contract tests from
  the default suite, corrects updater documentation, localizes the remaining
  config placeholder and reuses the modal focus contract for AGENTS.md and
  generated-image dialogs.

## Durable constraints

- Server-hydrated thread state is authoritative. Background notifications may
  update catalogs but never the visible conversation unless their `threadId`
  matches.
- Realtime uses ephemeral voice forks and injects finalized exchanges into the
  persistent parent in order. App Server still does not replay those injected
  voice items as ordinary chat items, so the client cache is intentionally
  bounded and session-local.
- Installation, update and ordinary startup are idempotent for `config.toml`,
  desktop preferences and server-owned thread metadata.
- Scheduled turns are serialized per target thread. Unattended mode must
  restore the prior security state before releasing its queue reservation.
- The shared browser uses only the app-owned Playwright/MCP pair and managed
  open-source Chromium. Never assume a system Chromium.

## Known limitations

- Scheduled tasks require the app to remain running in the tray and the machine
  to stay awake; missed intervals are not replayed in a burst.
- A separate App Server client can still race between idle observation and
  `turn/start`; App Server 0.145 exposes no conditional start-if-idle request.
- Quitting interrupts scheduled work; closing the window preserves the hidden
  renderer and App Server.
- Linux/Ubuntu is the only regularly packaged environment. The `.deb` still
  needs a clean second-machine or VM lifecycle pass.
- The lazy Markdown/KaTeX chunk remains large, but is isolated and not a release
  blocker.

## Next bounded work

1. Exercise long-idle and suspend/resume recovery in packaged Electron with a
   scheduled task, approval gating, hidden-window delivery and Realtime active.
2. Add a concise public App Server compatibility guide and `SECURITY.md`.
3. Add user-controlled diagnostic export with redaction and preview.
4. Define and test a documented package-update rollback strategy.
5. Revisit `App.tsx`, `useDemoPlayback.ts` and `electron/chromium.mjs` only when
   the next feature supplies a concrete ownership seam; line count alone does
   not justify another extraction.

Defer generic RPC/filesystem consoles, unstable marketplace production support
and Git/worktree management without a stable App Server product contract.

## Latest verification

- Strict TypeScript: passing.
- Deterministic frontend/unit suite: 609 tests across 121 files, passing.
- Installed App Server contract: 51 tests, passing against
  `codex-cli 0.145.0` (660 tests across 122 files including contract).
- Electron/Node: 114 tests, passing.
- Production Vite build: passing; main JS 626.27 kB, 180.50 kB gzip.
- Production dependency audit: zero vulnerabilities.
- `git diff --check`: passing.
- Shared-browser visual preview: skipped because the configured MCP session
  reported its page/context closed; no alternate browser stack was substituted.
- Debian package: built successfully as `codex-desktop-linux 0.3.17` (amd64),
  SHA-256
  `000b0c655a172d4675989a6a869975a3dbce6cfacde10bce659a9bec7812aefd`;
  package metadata, dependencies, bundled skill and AppArmor resources were
  inspected directly.
- Packaged Electron interaction check: not rerun for v0.3.17; the release lot
  changes native lifecycle behavior and still needs the long-idle manual pass
  listed below.

Standard verification:

```bash
npm run check
npm test
npm run test:electron
npm run build
npm audit --omit=dev
```

Also run `npm run test:contract` for protocol changes, `npm run electron:dev`
for native lifecycle changes, and `npm run electron:deb` before shipping a
package.
