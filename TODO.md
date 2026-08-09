# Codex Desktop Linux — Handoff

Last updated: 2026-08-09

Read `AGENTS.md` before contributing. Durable protocol and interface decisions
belong in `APP_SERVER_COVERAGE.md` and `UI_ARCHITECTURE.md`; completed release
detail belongs in `CHANGELOG.md` and Git.

## Baseline

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. The current public release is **v0.5.7**. The local
development baseline now uses installed `codex-cli 0.147.0`.

The daily workflow covers conversation replay and concurrent activity,
streaming Markdown/LaTeX, reasoning, plans, tools, approvals, diffs, files,
images, permissions, models, quotas, goals, dictation, Realtime voice, global
configuration, Skills, Apps, MCP, memory, Remote Control, scheduled tasks and a
shared Playwright Chromium session. The tray recalls Chromium and opens the
Scheduler directly.

Stable GitHub releases are checked once at startup. A compact top-bar action
installs a matching verified DEB automatically or opens the validated release
for RPM, AppImage and unsupported automatic-install paths.

Scheduler task cards present recurring schedules and pending one-shot execution
as explicit toggle states; immediate execution remains an agent-facing command
rather than a lifecycle-altering ordinary card action.

Recent audits covered per-thread actions, interactive requests, global
configuration read/write ownership, shell-command execution and managed-policy
hydration across disconnect/reconnect. Auto-review denial approvals now use
thread-scoped identity and synchronous duplicate ownership. Chat-presentation
mutations now own their initial desktop-preference hydration, and composer choice
requests serialize their asynchronous selection. Realtime tray subscription
failures now reach the existing native error state instead of remaining silent.
Thread-goal mutations now invalidate older reads before taking ownership of the
visible goal. Codex update results likewise supersede an older initial version
read. Realtime voice-catalog reads are invalidated across disconnect/reconnect
instead of blocking fresh hydration. Failed fuzzy-file-search sessions retain
their actionable startup error without issuing updates or cleanup for a session
that never started. External-agent import history now drops in-flight hydration
and shared errors when its settings surface disconnects. Earlier controller
passes remain in Git history; revisit these sectors only with new evidence.

DEB, RPM and AppImage packages are published for x86-64 Linux. Clean Debian
stable and Fedora containers install their native package and smoke-test both
the installed executable and AppImage under an unprivileged Xvfb/D-Bus session.
The updater performs automatic verified APT upgrades only for Debian-family
installations; RPM, AppImage and unknown families use an explicit manual
handoff to the validated release.

## Active objective

Cross-client history synchronization: the complete App Server thread catalog is
refreshed when the desktop window regains focus, so chats created through Remote
Control or another Codex surface appear without restarting the app. Concurrent
refreshes discard stale results and preserve the initial model catalog owner.
Projectless chats materialized in Codex's synthetic `Documents/Codex` workspace
are presented in a flat Discussions section immediately above Recent projects;
the compatibility classifier remains isolated until App Server exposes its
internal `workspace_kind` on thread responses.

New conversation ownership is now explicit: sidebar New chat asks for a
Discussion or a project folder, while first-send and Realtime entry points create
unique projectless Discussions under `Documents/Codex`. The active thread menu
owns folder changes; the sidebar no longer presents that thread-local mutation
as a global workspace control. Tray New chat opens the same neutral Discussion
draft directly. Newly started threads are normalized through the same cwd
classifier as catalog responses, so a composer-created Discussion enters its
sidebar section immediately rather than waiting for a catalog refresh.

Keep the current functional surface frozen while running bounded stabilization,
failure-path, simplification and maintainability passes. Prefer evidence from
daily use and focused tests over speculative rewrites or new settings.

Long shared card inventories keep their natural height through six entries,
then scroll within the `CardStack` while leaving any controls above the list
visible. Their contained overscroll prevents wheel input from chaining into the
settings page while the pointer remains over the list. This applies consistently
to Apps, Plugins, MCP servers and other inventory-backed settings surfaces.

Client-context lot: thread creation and resume read the configured developer
instructions effective for the target workspace, append a bounded Codex Desktop
Linux identity with client/backend versions and the package-embedded canonical
project repository URL, and pass the composed value as the
App Server session's `developerInstructions`. App Server still discovers and
applies AGENTS.md separately, preserving its project hierarchy, and turns no
longer persist repeated `additionalContext` items in rollout history. Realtime
receives the same identity in its effective instruction bundle.

Experimental Adult Mode is disabled by default and persisted as a desktop-owned
preference, not a Codex `config.toml` key. Configuration exposes one toggle; when
enabled, the package-embedded prompt is composed into developer instructions for
interactive thread creation/resume and Realtime initialization. Every activation
from the disabled state requires an explicit 18+ declaration and the locally
registered password; only its salted PBKDF2 derivative is stored in the desktop
settings JSON. The 18+ declaration is collected only during initial password
registration; later reactivations require the registered password alone.
An always-visible heart indicator beside the context gauge makes the active
state explicit in the conversation composer footer. Activation validation is
actionable: submitting an incomplete form explains the missing password,
confirmation or age declaration instead of leaving a silently disabled action.

Installed-plugin lot: the Plugins settings page now reads the authoritative
`plugin/installed` inventory for the active workspace and toggles supported
plugins through App Server's targeted `config/value/write` path. Marketplace
provenance, versions, partial-load failures and administrator-disabled state are
visible. The development-only catalog/read/install/uninstall methods remain
unused and clearly separated from the functional installed view.

Codex 0.147 alignment: conversations are pinned through App Server's stable
built-in Pinned section. The sidebar maps server section metadata to its existing
pin concept, consumes every page of the interactive thread catalog and confirms
each move by rereading the authoritative thread.

Runtime compatibility: the packaged client declares Codex CLI 0.147.0 as its
minimum supported backend. Stable client and CLI releases are polled together
at startup and hourly; General and the top bar expose separate update actions.
CLI installation remains owned by the selected binary through `codex update`,
with App Server restart left explicit after success.

Action narration: App Server `agentMessage` items marked as `commentary` remain
intermediate chat narration. They may introduce several related actions, so
individual action titles are derived only from structured tool-item fields.

Voice customization: the Voice settings page owns an optional desktop-persisted
prompt for tone, pronunciation and attitude. It is empty by default and appended
only to new Realtime sessions, after the existing effective instructions; text
threads and the delegated backend remain unchanged.
The vocal intermediary receives global developer preferences and global
`AGENTS.md` guidance, but not workspace/project `AGENTS.md` files: Codex already
applies those to the delegated text agent, while its bounded Realtime startup
context provides thread continuity and workspace orientation.

Responsive navigation: the sidebar closes automatically when the viewport is
narrower than three times its current width, including after user resizing, and
returns after widening only when it was previously open. The composer is capped
at three quarters of the available chat width.

## Durable constraints

- App Server-hydrated thread state is authoritative. A notification may alter
  the visible conversation only when its `threadId` matches; local, remote and
  steered user messages all enter through the authoritative App Server event.
- Electron owns the App Server process and preserves its initialized transport
  across renderer recovery. Full application quit attempts bounded graceful
  shutdown before escalating to process signals.
- Realtime uses ephemeral voice forks and injects finalized exchanges into the
  persistent parent in order. Injected voice items are not assumed to replay as
  ordinary chat, so the visual cache remains bounded and local. Injection now
  uses Responses-compatible `msg_rtv_*` identifiers within the API's 64-character
  limit. Legacy and oversized transcript identifiers remain recognizable for
  display but poison inherited delegated turns under Codex 0.147, so affected
  conversations require a fresh thread until App Server exposes a safe
  history-rewrite contract.
- App Server 0.147 persists `thread/inject_items` transcript history but omits
  parents without ordinary turns from `thread/list`. Codex Desktop temporarily
  keeps a bounded list of Realtime parents in desktop settings, rehydrates them
  with `thread/read`, and merges them into Discussions without fabricating a
  model turn. Remove this compatibility path when the server catalogs injected
  histories directly.
- When an empty parent has no rollout to fork, the Realtime fallback starts its
  ephemeral delegated text thread with the parent's effective developer
  instructions. This keeps Adult Mode and other global developer guidance
  aligned between the vocal intermediary and Text Agent.
- While Realtime is active, ordinary composer text belongs to its WebRTC
  conversation and is persisted back into the parent transcript; it must never
  fall through to a parent `turn/start` or `turn/steer` request. Realtime v3
  receives that text through `session.context.append` on the `speakable`
  channel; legacy `conversation.item.create` and `response.create` client events
  are not accepted by the frameless protocol.
- Client preferences live in `~/.codex/codex-desktop-linux.json`; official
  Codex configuration remains in `config.toml`. Installation, update and normal
  startup do not rewrite either domain or server-owned thread metadata.
- Scheduled turns are serialized per target thread. Unattended execution must
  restore the previous security state before releasing its queue reservation.
- The shared browser uses only the app-owned Playwright/MCP pair and managed
  open-source Chromium. Never assume a system Chromium installation.
- Full application quit closes the shared-browser MCP session first, then waits
  boundedly for its managed process before escalating. Its private Chromium
  launch suppresses only the crash-restore bubble so an ungraceful host loss
  does not require mutating or deleting profile data on recovery.
- Async controllers own incompatible mutations synchronously and invalidate
  stale reads. React presentation state is not a concurrency lock.
- Frontend style or layout work requires comparable before/after screenshots at
  the same viewport, theme and state. Functional correctness alone is not
  sufficient visual acceptance.

## Known limitations

- Scheduled tasks require the app to remain running in the tray and the machine
  awake; missed intervals are not replayed in a burst.
- App Server 0.147 exposes no atomic start-if-idle request, so another App
  Server client can still race between idle observation and `turn/start`.
- Quitting interrupts scheduled work; closing the window preserves the hidden
  renderer and App Server.
- Native packages and AppImage pass headless Debian/Fedora smoke tests, but full
  lifecycle coverage still needs Fedora GNOME and KDE/Wayland sessions,
  including tray, audio, suspend/resume and long-idle network recovery.
- The lazy Markdown/KaTeX chunk remains large but isolated and is not a release
  blocker.
- Plugin catalog/read/install/uninstall mutations remain intentionally disabled
  while the official production contract forbids clients from relying on them;
  installed-plugin inventory and enablement use the supported App Server paths.

## Next bounded work

1. Exercise clean install, App Server discovery, tray, audio, shared Chromium
   and manual-update flows in Fedora GNOME and KDE/Wayland VMs.
2. Exercise long-idle and suspend/resume recovery in packaged Electron with a
   scheduled task, approval gating, hidden-window delivery and Realtime active.
3. Continue one-controller-at-a-time audits for stale responses, incomplete
   cancellation and recovery gaps; avoid revisiting controllers already covered
   unless dogfooding produces new evidence.
4. Extract large owners only where a cohesive ownership seam removes mixed
   responsibilities. Line count alone does not justify a split.
5. Tighten outcome-oriented tests whose assertions still permit concurrency,
   cancellation or cleanup regressions.

Defer generic RPC/filesystem consoles, unstable marketplace production support,
environment administration and Git/worktree management without a stable App
Server product contract.

## Latest verification

The current tree passes:

- strict TypeScript checking;
- 786 deterministic frontend/unit tests across 136 files;
- 141 Electron/Node tests, including App Server and shared-browser shutdown,
  recovery, synthetic
  Discussion workspaces and the tray
  quick actions;
- production Vite build;
- production dependency audit with zero vulnerabilities;
- `git diff --check`.

The optional Voice-instructions editor was reviewed in the deterministic light
preview at 1164×860. Its compact modal, labeled icon action, empty-default copy
and keyboard focus behavior use the existing Settings primitives; the curated
Voice baseline was added with no browser console errors.

The Discussion/project creation lot was reviewed in the deterministic light
preview at 1240×820 and 840×620. The New chat choice dialog, project-folder
action in the thread menu and sidebar composition were inspected with no browser
console errors; the light showcase baseline was refreshed.

The Adult Mode preference and activation gate were reviewed in the light
Configuration preview at 1164×860. The gate reuses the standard settings dialog,
alert, field, toggle, icon and action primitives; its curated baseline was added
with no browser console errors. Its active-state heart indicator was compared
against the unmodified footer at 1164×860 and checked again at 840×620; it remains
grouped with the context and quota metrics without crowding the primary controls.

The Codex 0.147 compatibility pass generated and compared stable and experimental
schemas, reviewed the official `rust-v0.147.0` source delta and adapted the one
breaking product overlap: pinning moved from `isPinned` metadata to the stable
built-in Pinned section and `thread/section/move`. The other observed additions
(model specialties, MCP annotations and image transparency)
remain queued by product seam rather than being mixed into the compatibility
fix. Agent questions now consume authoritative blocking semantics, and Plugins
explain App Server's administrator, plan and required-App unavailability reasons.
Realtime v3 now uses the 0.147 BEM handoff contract instead of an obsolete
ignored prefix, preserving commentary/final phases while relying on App Server's
new default entry/exit mode instructions. The delegation acknowledgement filler
remains server-owned pending a focused audible comparison. Ordinary agent events
from the isolated Realtime fork are buffered into the visible parent without its
internal user prompt; completed Text Agent messages are injected with `msg_rtt_`
IDs so live rendering and replay retain their dedicated presentation.
Composer text submitted during an active voice session now uses Realtime
`conversation.item.create` followed by `response.create`; focused WebRTC,
lazy-bridge and transcript-owner regressions cover routing and persistence.
All 53 installed-schema contract tests pass against `codex-cli 0.147.0`.

Release v0.5.6 additionally passed Linux DEB/RPM/AppImage packaging and clean
Debian stable and Fedora native-package/AppImage headless launch smoke tests.
Its release candidate retains the current 732 frontend/unit, 132 Electron and
53 installed-schema contract test baseline against `codex-cli 0.146.0`.

Release v0.5.5 additionally passed Linux DEB/RPM/AppImage packaging and clean
Debian stable and Fedora native-package/AppImage headless launch smoke tests.
Its release candidate retains the current 721 frontend/unit, 132 Electron and
53 installed-schema contract test baseline against `codex-cli 0.146.0`.

Release v0.5.4 additionally passed 52 installed-schema contract tests against
`codex-cli 0.145.0`, Linux DEB/RPM/AppImage packaging, and native/AppImage
install and headless-launch smoke checks in Debian stable and Fedora containers.

The installed-plugin lot passes 52 installed-schema contract tests against
`codex-cli 0.145.0`; its functional installed and deferred-catalog states were
also reviewed in the deterministic light-theme browser preview with no console
errors, and the curated Plugins baseline was refreshed. A fresh v0.5.3 Debian
package was rebuilt, reinstalled over the existing package, verified against
its installed `app.asar`, and launched from `/opt/Codex Desktop`.

The Computer Use host-dependency installer now provisions a verified upstream
`ydotool` 1.x build, persistent `/dev/uinput` access and the user daemon on
APT- and DNF-based systems.

The latest curated UI baselines cover the conversation themes and the Settings
surfaces materially changed through v0.5.5. Native lifecycle changes still need
focused packaged-Electron checks; browser preview validation is never a
substitute for them.

## Standard verification

```bash
npm run check
npm test
npm run test:electron
npm run build
npm audit --omit=dev
```

Also run `npm run test:contract` for protocol changes, `npm run electron:dev`
for native lifecycle changes and `npm run electron:linux` for packaging changes.
