# Codex Desktop Linux — Handoff

Last updated: 2026-08-03

Read `AGENTS.md` before contributing. Durable protocol and interface decisions
belong in `APP_SERVER_COVERAGE.md` and `UI_ARCHITECTURE.md`; completed release
detail belongs in `CHANGELOG.md` and Git.

## Baseline

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. The current public release is **v0.5.4**. The local
development baseline now uses installed `codex-cli 0.146.0`.

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
configuration read/write ownership and shell-command execution. Earlier
controller passes remain in Git history; revisit these sectors only with new
evidence.

DEB, RPM and AppImage packages are published for x86-64 Linux. Clean Debian
stable and Fedora containers install their native package and smoke-test both
the installed executable and AppImage under an unprivileged Xvfb/D-Bus session.
The updater performs automatic verified APT upgrades only for Debian-family
installations; RPM, AppImage and unknown families use an explicit manual
handoff to the validated release.

## Active objective

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

Installed-plugin lot: the Plugins settings page now reads the authoritative
`plugin/installed` inventory for the active workspace and toggles supported
plugins through App Server's targeted `config/value/write` path. Marketplace
provenance, versions, partial-load failures and administrator-disabled state are
visible. The development-only catalog/read/install/uninstall methods remain
unused and clearly separated from the functional installed view.

Codex 0.146 alignment: conversations can be pinned through App Server's stable
metadata update contract. The sidebar now consumes every page of the interactive
thread catalog, keeps pinned conversations in a compact dedicated section and
uses the server response as the source of truth for every toggle.

Runtime compatibility: the packaged client declares Codex CLI 0.146.0 as its
minimum supported backend. Stable client and CLI releases are polled together
at startup and hourly; General and the top bar expose separate update actions.
CLI installation remains owned by the selected binary through `codex update`,
with App Server restart left explicit after success.

Action narration: short App Server `agentMessage` items explicitly marked as
`commentary` are attached to the immediately following tool card and shown as
its primary header. Final, unclassified and long messages retain their ordinary
conversation presentation; replay and streaming use the same association rule.

## Durable constraints

- App Server-hydrated thread state is authoritative. A notification may alter
  the visible conversation only when its `threadId` matches; local, remote and
  steered user messages all enter through the authoritative App Server event.
- Electron owns the App Server process and preserves its initialized transport
  across renderer recovery. Full application quit attempts bounded graceful
  shutdown before escalating to process signals.
- Realtime uses ephemeral voice forks and injects finalized exchanges into the
  persistent parent in order. Injected voice items are not assumed to replay as
  ordinary chat, so the visual cache remains bounded and local.
- Client preferences live in `~/.codex/codex-desktop-linux.json`; official
  Codex configuration remains in `config.toml`. Installation, update and normal
  startup do not rewrite either domain or server-owned thread metadata.
- Scheduled turns are serialized per target thread. Unattended execution must
  restore the previous security state before releasing its queue reservation.
- The shared browser uses only the app-owned Playwright/MCP pair and managed
  open-source Chromium. Never assume a system Chromium installation.
- Async controllers own incompatible mutations synchronously and invalidate
  stale reads. React presentation state is not a concurrency lock.
- Frontend style or layout work requires comparable before/after screenshots at
  the same viewport, theme and state. Functional correctness alone is not
  sufficient visual acceptance.

## Known limitations

- Scheduled tasks require the app to remain running in the tray and the machine
  awake; missed intervals are not replayed in a burst.
- App Server 0.146 exposes no atomic start-if-idle request, so another App
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
- 722 deterministic frontend/unit tests across 129 files;
- 132 Electron/Node tests, including App Server shutdown, recovery and the tray
  quick actions;
- production Vite build;
- production dependency audit with zero vulnerabilities;
- `git diff --check`.

The Codex 0.146 compatibility and pinning pass generated and compared stable and
experimental schemas, reviewed the official `rust-v0.146.0` source delta, and
passed all 53 installed-schema contract tests. Changes are additive for the
client's current surface; the removed experimental `AppMetadata.firstPartyType`
field was never consumed. The added pinning contract is now covered end to end.

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
surfaces materially changed through v0.5.4. Native lifecycle changes still need
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
