# Codex Desktop Linux — Handoff

Last updated: 2026-07-29

Read `AGENTS.md` before contributing. Durable protocol and UI decisions belong
in `APP_SERVER_COVERAGE.md` and `UI_ARCHITECTURE.md`; release history belongs in
`CHANGELOG.md` and Git.

## Current baseline

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. The daily workflow covers conversations and
replay, streaming, reasoning, plans, tools, approvals, diffs, files, images,
Markdown/LaTeX, permissions, models, quotas, goals, dictation, Realtime voice,
global configuration, skills, Apps, MCP, hooks, memory, remote control and the
shared Playwright Chromium session.

The repository is public at
`https://github.com/B4PT0R/codex-desktop-b4pt0r`. The current public release is
v0.3.4.

## Current candidate

The client now owns scheduled tasks without inventing an App Server automation
API:

- Electron persists at most 100 validated schedules atomically in
  `~/.codex/codex-desktop-linux.json`;
- interval, daily, weekday, weekly and one-time local schedules can target the
  selected existing thread, a new persistent thread or a new ephemeral thread;
- due runs start or resume an ordinary thread and submit an ordinary Codex
  turn, preserving normal permissions and approval behavior;
- tasks can be edited, paused, run immediately and deleted with confirmation
  from a dedicated global Settings section; a one-time wake disables itself
  atomically when claimed;
- the scheduler claims work before dispatch and records running, success,
  failure, interruption, last thread and next occurrence;
- scheduling, App Server execution and transport ownership remain separate so
  the experimental Unix daemon can replace process ownership later without
  changing the product surface.
- new ordinary threads expose the native scheduler to the agent through App
  Server's experimental `dynamicTools` contract: list, create, update,
  enable/disable and run-now are bounded operations, while deletion waits for
  explicit desktop confirmation. App Server restores the tools on resume.
- turn-producing work is serialized per target thread. A wake-up aimed at a
  busy thread waits for the active user, review or compaction turn to finish;
  different threads continue in parallel, and security restoration completes
  before the next queued wake-up starts.
- scheduled prompts carry a persistent Codex Desktop Scheduler envelope and
  replay as a distinct wake-up card instead of looking like user steering.
- each task may explicitly opt into unattended execution. This uses Full access
  with Never ask for the scheduled turn, visibly warns in Settings, and
  restores the thread's previous permission and approval settings before its
  queue is released.

Background notifications are now routed by `threadId`. A scheduled run updates
its thread and sidebar without injecting activity into the conversation
currently being read. Global notifications and interactive approval requests
retain their existing behavior.

Compatibility remains anchored to installed `codex-cli 0.145.0`. The boundary
also accepts additive thread section metadata, item timestamps and terminal
turn errors already visible in official Codex `main` at `1def0a892`, but emits
no unpublished section or automation request.

The new Settings UI reuses the established cards, round controls, compact
typography, focus treatment and light/dark palettes. It has no horizontal
overflow at 1240×820 or 840×620.

## Verified candidate baseline

- Installed Codex: `codex-cli 0.145.0`.
- Official source audit: `1def0a892`, stable and experimental v2 schemas.
- Frontend/unit/contract: 535 tests across 103 files, including 47 installed
  App Server contract cases.
- Electron/Node: 61 tests.
- Strict TypeScript: passing.
- Production Vite build: passing.
- Production dependency audit: zero vulnerabilities.
- Main JS: 553.87 kB, 160.91 kB gzip.
- Lazy diff viewer: 89.50 kB, 32.89 kB gzip.
- Lazy Markdown/KaTeX: 698.90 kB, 208.87 kB gzip.
- Shared-browser visual pass: light and dark palettes, 1240×820 and 840×620;
  no browser warning or error.
- Reinstalled Debian package: `codex-desktop-linux 0.3.4 amd64`; installed ASAR
  matches the package build (`263069eb…638a75f`).

## Active invariants

- Electron is the only production shell. Do not restore Tauri.
- The installed App Server schema is the wire source of truth. Future-source
  observations may inform additive parsing, never unsupported requests.
- Persist client preferences atomically in the versioned desktop settings
  file. Keep official Codex configuration in `config.toml`.
- Server-hydrated thread state wins over UI defaults.
- Realtime uses ephemeral voice threads and injects finalized utterances into
  the persistent parent in order.
- Shared browser automation owns an app-managed open-source Chromium and
  packaged Playwright/MCP pair; never assume a system Chromium.
- Filesystem, configuration and scheduler IPC remain narrow, validated and
  secret-free.
- Preserve French/English key parity and accessible light/dark hover, focus,
  disabled, destructive and error states.

## Known limitations

- Scheduled tasks require the app to remain running in the tray and the machine
  to be awake. The current scheduler does not wake a suspended or powered-off
  machine and does not replay a burst of missed intervals.
- Per-thread serialization covers all turn starts owned by this desktop
  process. A different App Server client can still race in the narrow interval
  between an idle observation and `turn/start`, because 0.145 exposes no
  conditional start-if-idle request.
- Quitting or restarting the app interrupts an active scheduled run; it is
  marked failed on reconnect. Closing only the window preserves the hidden
  renderer and App Server.
- There is no public App Server automation CRUD/run API in 0.145 or the audited
  official checkout. The Unix daemon/socket remains experimental and is not yet
  the production transport.
- App Server 0.145 only accepts client-owned dynamic tools at `thread/start`.
  Threads created before v0.3.4 remain usable but need a new fork or
  conversation before the agent can control scheduled tasks from chat.
- Linux/Ubuntu is the only packaged environment validated regularly; the `.deb`
  still needs a clean second-machine or VM lifecycle pass.
- App Server preserves injected Realtime context but does not project
  standalone injected voice items into ordinary visual replay.
- The lazy Markdown/KaTeX chunk remains large but is not a release blocker.

## Next bounded work

1. Exercise scheduled execution end to end in packaged Electron, including an
   approval-gated task, hidden-window delivery and App Server restart.
2. Decide whether background task completion merits an OS notification and a
   small activity inbox before adding either surface.
3. Add `CONTRIBUTING.md`, focused issue/PR templates and a concise public App
   Server compatibility guide.
4. Add user-controlled diagnostic export with redaction and preview.
5. Define an explicit, non-silent update and rollback strategy.

Defer generic RPC/filesystem consoles, unstable plugin-marketplace production
support and Git/worktree management without a stable App Server product
contract.

## Verification

```bash
npm run check
npm test
npm run test:electron
npm run build
npm audit --omit=dev
```

For protocol changes, also run `npm run test:contract` against the installed
binary. For packaging or native lifecycle work, use `npm run electron:dev` and
`npm run electron:deb`. Meaningful UI work must be checked through the shared
Playwright session at 1240×820 and 840×620.

No active blocker is known.
