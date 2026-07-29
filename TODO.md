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
v0.3.8.

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

Long-idle transport recovery is now explicit rather than inferred from the
child process state:

- Electron probes the initialized App Server over its real stdio JSON-RPC
  channel every two minutes and shortly after system resume or unlock;
- two consecutive bounded probe failures are required before replacing the
  child, avoiding a restart on a transiently busy response;
- the renderer reconnects with bounded backoff, restores its subscriptions and
  catalogs, then resumes the active thread;
- the tray-hidden Electron renderer opts out of background throttling because
  it owns App Server event reduction, remote control and scheduled turns;
- the scheduler stops claiming due work as soon as the transport is lost and
  catches up only after its renderer listener is attached again.

Compatibility remains anchored to installed `codex-cli 0.145.0`. The boundary
also accepts additive thread section metadata, item timestamps and terminal
turn errors already visible in official Codex `main` at `1def0a892`, but emits
no unpublished section or automation request.

The new Settings UI reuses the established cards, round controls, compact
typography, focus treatment and light/dark palettes. It has no horizontal
overflow at 1240×820 or 840×620.

A maintenance pass has reduced the main Settings concentration without
inventing generic abstractions:

- `SettingsView` now owns only focus, navigation and section routing;
- General/Web/Chat, Agent/Permissions and Advanced settings have focused
  section modules with narrow controller props;
- scheduled-task listing and editing are separate components, and changing the
  edited task cannot retain stale form state;
- scheduler styling is colocated in `automation-settings.css` instead of being
  split across the general Settings and appearance sheets.

Streaming assistant messages now use the complete GFM/KaTeX renderer
progressively. Token deltas are coalesced to at most one interruptible Markdown
parse every 32 ms. Chromium schedules those parses below pending keyboard and
pointer input; incomplete emphasis, links, fenced code and math remain safe
while their delimiters are still arriving, and finalization flushes the
complete source immediately. The renderer reuses stable Markdown component
types, and the obsolete parallel LaTeX-only streaming parser has been removed.
Tables, headings, nested and task lists, blockquotes, separators,
strikethrough, links and inline images now have an explicit responsive
light/dark presentation instead of inheriting inconsistent browser defaults.

Tool activity now follows a three-state presentation contract: an action is
open, collapsed on the same fixed one-line header, or hidden in its group
history. Calls are revealed only after the previous detail panel has finished
closing; when the configurable one-to-six-row limit is reached, the oldest row
leaves before the next arrives. The group summary exists from the first call,
silent agent steps remain aggregated, and text or an intervening non-action
item closes the prior group before the next visual item appears. Empty
agent-message and zero-summary reasoning placeholders are discarded live and
during replay, so they cannot split tools-only steps into consecutive
one-action groups. A delayed reasoning summary becomes a boundary only when
its first visible delta arrives.
The App Server background-terminal inventory is refreshed during active turns.
A matching long-running command keeps its truthful running state and output,
but yields its expanded card after a short dwell so later Playwright or tool
calls cannot accumulate invisibly behind it. Mixed groups report completed and
still-running counts together; detached jobs use a static job icon rather than
a spinner that suggests the interface is blocked.
The action row and its detail rendering now live in a focused component; the
group component owns only sequencing, history visibility and group lifecycle.

## Verified candidate baseline

- Installed Codex: `codex-cli 0.145.0`.
- Official source audit: `1def0a892`, stable and experimental v2 schemas.
- Frontend/unit/contract: 542 tests across 103 files, including 47 installed
  App Server contract cases.
- Electron/Node: 68 tests, including the native hidden-window liveness
  invariant.
- Strict TypeScript: passing.
- Production Vite build: passing.
- Production dependency audit: zero vulnerabilities.
- Main JS: 565.48 kB, 164.07 kB gzip.
- Lazy diff viewer: 89.50 kB, 32.89 kB gzip.
- Lazy Markdown/KaTeX: 436.81 kB, 131.40 kB gzip.
- Shared-browser visual pass: light and dark palettes, 1240×820 and 840×620;
  no browser warning, error or horizontal overflow after the Settings
  modularity pass.
- Shared-browser action pass: user-approved continuous multi-step wave with
  seven aggregated calls, saturation, an interleaved compaction boundary and a
  second group containing a detached development server followed by Playwright
  calls; the mixed summary and static job state were user-approved.
- Shared-browser streaming pass: progressive Markdown and sequential composer
  input ran together without browser errors or warnings; real App Server
  tools-only grouping is covered at the reducer and replay boundaries because
  the visual demo intentionally bypasses those events.
- Shared-browser Markdown pass: complete light/dark fixture at 1240×820 and
  840×620; wide tables scroll locally without widening the message or app.
- Reinstalled Debian package: `codex-desktop-linux 0.3.7 amd64`; installed ASAR
  matches the package build (`f4e5f436…8bfef51`).
- Built Debian release candidate: `codex-desktop-linux 0.3.8 amd64`
  (`sha256:91eaea3a…cdc83cc`); packaged ASAR contains the native health monitor.

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

1. Exercise long-idle and suspend/resume recovery in packaged Electron together
   with scheduled execution, including an approval-gated task, hidden-window
   delivery and App Server restart.
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
