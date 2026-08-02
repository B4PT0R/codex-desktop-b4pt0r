# Codex Desktop Linux — Handoff

Last updated: 2026-08-02

Read `AGENTS.md` before contributing. Durable protocol and interface decisions
belong in `APP_SERVER_COVERAGE.md` and `UI_ARCHITECTURE.md`; completed release
detail belongs in `CHANGELOG.md` and Git.

## Baseline

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. The current public release is **v0.5.2**, verified
against installed `codex-cli 0.145.0`.

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

## Durable constraints

- App Server-hydrated thread state is authoritative. A notification may alter
  the visible conversation only when its `threadId` matches; local, remote and
  steered user messages all enter through the authoritative App Server event.
- Electron owns the App Server process and preserves its initialized transport
  across renderer recovery. Full application quit attempts bounded graceful
  shutdown before escalating to process signals.
- Realtime uses ephemeral voice forks and injects finalized exchanges into the
  persistent parent in order. App Server 0.145 does not replay every injected
  voice item as ordinary chat, so the visual cache remains bounded and local.
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
- App Server 0.145 exposes no atomic start-if-idle request, so another App
  Server client can still race between idle observation and `turn/start`.
- Quitting interrupts scheduled work; closing the window preserves the hidden
  renderer and App Server.
- Native packages and AppImage pass headless Debian/Fedora smoke tests, but full
  lifecycle coverage still needs Fedora GNOME and KDE/Wayland sessions,
  including tray, audio, suspend/resume and long-idle network recovery.
- The lazy Markdown/KaTeX chunk remains large but isolated and is not a release
  blocker.
- Plugin marketplace mutations remain intentionally disabled while the official
  production contract forbids clients from relying on them.

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
- 688 deterministic frontend/unit tests across 129 files;
- 130 Electron/Node tests, including App Server shutdown, recovery and the tray
  quick actions;
- production Vite build;
- production dependency audit with zero vulnerabilities;
- `git diff --check`.

Release v0.5.2 additionally passed 51 installed-schema contract tests against
`codex-cli 0.145.0` and Linux DEB/RPM/AppImage packaging. The multi-distribution
baseline has reproducible native/AppImage container smoke checks for Debian
stable and Fedora; these were established during the v0.5.0 portability pass.

The latest curated UI baselines cover the conversation themes and the Settings
surfaces materially changed through v0.5.2. Native lifecycle changes still need
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
