# Codex Desktop Linux — Handoff

Last updated: 2026-07-31

Read `AGENTS.md` before contributing. Durable protocol and UI decisions belong
in `APP_SERVER_COVERAGE.md` and `UI_ARCHITECTURE.md`; completed release detail
belongs in `CHANGELOG.md` and Git.

## Baseline

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. The release candidate is v0.3.13.

The daily workflow covers conversations and replay, concurrent thread activity,
streaming Markdown/LaTeX, reasoning, plans, tools, approvals, diffs, files,
images, permissions, models, quotas, goals, dictation, Realtime voice, global
configuration, skills, Apps, MCP, memory, remote control, scheduled tasks and a
shared Playwright Chromium session.

Compatibility is anchored to installed `codex-cli 0.145.0`. The protocol
boundary also accepts the additive metadata audited in official Codex
`1def0a892`, but emits no unpublished request.

## Active objective

Reduce maintenance debt in focused, behavior-preserving lots. Prefer extracting
one clear responsibility from a concentration point over moving code into
generic helpers.

Completed in the current working tree:

- centralize optimistic thread-runtime setting writes outside `App.tsx`;
- ignore stale failures after a newer choice or conversation switch;
- use one application-error presentation for native and connection failures;
- make unused TypeScript locals and parameters fail CI;
- keep turn coordination state bounded to relevant active/queued work and route
  every failed reservation through one release/drain path;
- ship an AppArmor profile attached to the actual packaged executable instead
  of documenting a nonexistent binary path;
- keep synthetic browser-preview fixtures and cancellable timers in the demo
  controller rather than the production submission path;
- let scheduled tasks target the logical default conversation, resolve its
  current identifier at wake-up and wait for preference hydration before
  arming the scheduler;
- show the client and Codex versions in General, check the latest stable GitHub
  release on demand and open only a size- and SHA-256-verified matching `.deb`
  through the system installer;
- clearly ask the user to finish the system installation and restart Codex
  Desktop before expecting the updated version;
- keep this handoff concise instead of accumulating completed release history.

## Recent constraints

- Server-hydrated thread state is the source of truth. A partial resume must not
  erase confirmed conversation metadata or effective runtime settings.
- Notifications and active-turn state are isolated by `threadId`; background
  activity may update catalogs but not the visible conversation.
- The general default conversation is read through authoritative App Server
  metadata when absent from the recent catalog. Realtime-only parents remain
  visible even without replayable turns, and user names are never fabricated or
  overwritten.
- Install, upgrade and ordinary startup are idempotent for `config.toml`,
  desktop preferences and server-owned thread metadata.
- Scheduled turns are ordinary App Server turns serialized per target thread.
  Unattended mode temporarily uses Full access/Never ask and must restore the
  previous security state before releasing the queue.
- Realtime uses ephemeral voice forks and injects finalized exchanges into the
  persistent parent in order.
- The shared browser uses the app-owned Playwright/MCP pair and managed
  open-source Chromium. Never assume a system Chromium.

## Known limitations

- Scheduled tasks require the app to remain running in the tray and the machine
  to stay awake. Missed intervals are not replayed in a burst.
- A different App Server client can race between an idle observation and
  `turn/start`; App Server 0.145 has no conditional start-if-idle request.
- Quitting the app interrupts an active scheduled run. Closing the window keeps
  the hidden renderer and App Server alive.
- Threads created before v0.3.4 need a new fork or conversation before the
  agent can receive the scheduler's experimental dynamic tools.
- App Server preserves injected Realtime context but does not project those
  standalone voice items into ordinary visual replay.
- Linux/Ubuntu is the only regularly packaged environment. The `.deb` still
  needs a clean second-machine or VM lifecycle pass.
- The lazy Markdown/KaTeX chunk remains large but is not a release blocker.

## Next bounded work

1. Exercise long-idle and suspend/resume recovery in packaged Electron with a
   scheduled task, approval gating and hidden-window delivery.
2. Add a concise public App Server compatibility guide and
   `SECURITY.md`.
3. Add user-controlled diagnostic export with redaction and preview.
4. Define a documented rollback strategy for package updates.

Defer generic RPC/filesystem consoles, unstable marketplace production support
and Git/worktree management without a stable App Server product contract.

## Latest verified baseline

- Frontend/unit/contract: 616 tests across 114 files, including 49 installed
  App Server contract cases.
- Electron/Node: 91 tests.
- Strict TypeScript, production Vite build and production dependency audit:
  passing; zero production vulnerabilities.
- Main JS: 596.06 kB, 171.92 kB gzip.
- Electron directory packaging: passing with the native update manager included.
- Pre-release live check: installed `codex-cli 0.145.0`; the then-current
  v0.3.12 release exposed a matching amd64 asset without requiring a download.
- Shared-browser scheduler pass: the default-conversation target fits the
  existing two-column editor grid and remains selectable without layout shift.
- Shared-browser update pass: General at 1164×860 and light theme at 840×620;
  version rows and the update action remain aligned without horizontal overflow.
- Current working-tree Debian package: passing; the packaged AppArmor profile
  is byte-identical to its source and present under `resources/apparmor/`.
- Debian v0.3.13:
  `sha256:9b5dc7ed067aa0ca7b3dd057616c9382aac88a62ef11b18f57c3cebcc11f50be`.
  The package contains the native update manager and matching AppArmor profile.
  Earlier upgrade and same-version reinstall checks preserved both persistence
  files byte-for-byte, including inode, timestamps, mode and ownership.

Run for every completed lot:

```bash
npm run check
npm test
npm run test:electron
npm run build
npm audit --omit=dev
```

Also run `npm run test:contract` for protocol changes, `npm run electron:dev`
for native UI/lifecycle changes, and `npm run electron:deb` for packaging.
Meaningful UI changes require the shared Playwright pass at 1240×820 and
840×620.

No active blocker is known.
