# Codex Desktop Linux — Handoff

Last updated: 2026-07-27

Read `AGENTS.md` before contributing. This file records only the current
baseline, active objective and next useful work. Durable UI decisions belong in
`UI_ARCHITECTURE.md`; protocol coverage belongs in
`APP_SERVER_COVERAGE.md`; completed release detail belongs in
`CHANGELOG.md` and Git history.

## Product state

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. It is designed as the Linux Codex application its
contributors want to use every day:

- expose the useful depth of App Server through a polished desktop workflow;
- provide substantially better ergonomics than the CLI for long interactive
  sessions;
- keep ordinary work, session control and global Codex configuration inside one
  coherent application;
- remain familiar to Codex users without copying the official desktop app or
  implying that this is an OpenAI release.

The daily workflow is covered end to end: conversations and replay, streaming,
reasoning, plans, tools, approvals, diffs, files, images, Markdown/LaTeX,
permissions, models, quotas, goals, dictation, Realtime voice, settings,
`config.toml`, `AGENTS.md`, Apps, skills, MCP, hooks, memory, account and a
shared Playwright Chromium session.

Further App Server coverage must solve a concrete user workflow. Endpoint count
is not a product goal.

## Active objective

Maintain **v0.3.0** as the current community beta and choose the next bounded
post-release lot from the priorities below.

Feature scope is frozen unless final validation finds a reproducible blocker.
The release closes the shared-browser and explicit-skill lot:

- pinned app-owned Playwright Core and Playwright MCP;
- opt-in matching Chromium download in application data;
- one visible persistent browser context shared by the user and agent;
- dedicated Web Browser settings with activation, progress, repair and
  disable paths;
- system-browser fallback when the managed browser is inactive or unavailable;
- unsupported official Browser/Computer Use surfaces disabled only for this
  client’s App Server process;
- packaged `use-shared-browser` host skill registered through
  `skills/extraRoots/set`;
- implicit browser routing validated in a fresh application session;
- explicit skill selection from the composer’s `+` menu using App Server’s
  canonical structured `skill` input;
- discreet skill markers restored from persisted user-message input;
- light/dark submenu, hover and focus states reviewed at desktop and minimum
  window sizes.

The v0.3.0 source, package metadata and installed files passed final
verification. Because App Server lives inside the desktop process, installation
was performed over the running v0.2.6 instance; the installed v0.3.0 code takes
effect on the user's next deliberate application relaunch.

## Release checklist

Complete in order:

- [x] Review the complete worktree and keep unrelated user changes intact.
- [x] Bump application and package metadata to `0.3.0`.
- [x] Add the v0.3.0 user-facing summary to `CHANGELOG.md`.
- [x] Run the full automated verification matrix.
- [x] Build the final `.deb` and verify its metadata and bundled skill files.
- [x] Reinstall the final package.
- [ ] Smoke-test packaged Electron:
  - reopen an existing thread;
  - select `use-shared-browser` from `+`;
  - invoke the shared browser implicitly from plain language;
  - confirm the user and agent observe the same tab;
  - disable and re-enable the browser;
  - confirm system-browser fallback;
  - verify skill markers after thread replay.
- [x] Commit the reviewed lot, tag v0.3.0, and push to GitHub.
- [x] Replace this objective with the next bounded post-release task.

## Verified candidate baseline

- Installed Codex: `codex-cli 0.145.0`.
- App Server schema audit: stable and experimental v2 schemas, official source
  checkout `0dfa778dae6a`.
- Client protocol inventory: 63 product request methods, 55 interpreted
  notification methods and 6 handled server requests.
- Frontend/unit/contract: 492 tests across 95 files, including 45 installed
  App Server contract cases.
- Electron/Node: 51 tests.
- Strict TypeScript: passing.
- Production Vite build: passing.
- Production dependency audit: zero vulnerabilities.
- Main JS: 510.66 kB, 148.49 kB gzip.
- Lazy diff viewer: 89.50 kB, 32.89 kB gzip.
- Lazy Markdown/KaTeX: 698.59 kB, 208.74 kB gzip.

Current release artifact:

- package: `dist/codex-desktop-linux_0.3.0_amd64.deb`;
- size: 108,447,916 bytes;
- package SHA-256:
  `bb12398cf0663c91c423135a28ac4b594669700d17ccf9597bcf2fe5c14bc562`;
- packaged ASAR SHA-256:
  `c3b12eb65befaba34aa491750d486e4dad442e00668cd4c546187f700b6db259`.

`dpkg-query` reports `codex-desktop-linux 0.3.0 amd64 install ok installed`;
the installed ASAR matches the packaged hash and the shared-browser skill
resources are present outside the ASAR.

## Active invariants

- Electron is the only production shell. Do not restore Tauri.
- The installed App Server and its generated schema are the protocol source of
  truth. Normalize compatibility at the boundary; do not guess from model names
  or scatter version checks through components.
- Persist client preferences atomically in
  `~/.codex/codex-desktop-linux.json`. Keep official Codex configuration in
  `config.toml`.
- Effective server state initializes session widgets. UI fallbacks must never
  overwrite hydrated permissions, approvals, model, effort, personality,
  collaboration mode or workspace.
- Browser automation owns a separate open-source Chromium instance. Do not
  embed a general-purpose browser WebView or assume a system Chromium exists.
- The app-owned Playwright and MCP versions must remain matched. Activation may
  download their Chromium; it must never invoke a distribution package manager.
- `use-shared-browser` is scoped to this client’s App Server process. Do not
  copy it into user or workspace skill directories.
- Only explicit structured `skill` inputs receive a visual skill marker.
  App Server exposes no reliable lifecycle event for implicit invocation, so do
  not infer one from reasoning, command text or filesystem reads.
- Realtime uses ephemeral voice threads and injects finalized utterances into
  the persistent parent in order. Keep late-event filtering and centralized
  teardown inside `useRealtimeConversation`.
- Dictation remains a separate Chromium WebM/Opus capture and Codex OAuth
  transcription flow; it must not depend on Python or distribution-specific
  audio packages.
- Filesystem and configuration actions use narrow native IPC boundaries with
  validation, size limits, stale-write protection and atomic replacement.
- Tool, reasoning and plan activity stays progressively disclosed. Do not let
  technical UI dominate the conversation.
- Preserve French/English locale parity and usable light/dark hover, focus,
  disabled and error states.

## Known limitations

- Linux/Ubuntu is the only packaged environment validated regularly.
- The `.deb` still needs a clean second-machine or VM install/upgrade/uninstall
  pass.
- `App.tsx` coordinates substantial application state. Extract only cohesive
  owners during bounded changes; do not perform a speculative rewrite.
- App Server notification payload parsing now belongs to the pure,
  exhaustively typed `appNotificationRouting` boundary. Keep page orchestration
  focused on applying its product-level thread, telemetry and lifecycle effects.
- `useThreadRuntimeState` owns model behavior and the provenance of permission
  and approval values. Display fallbacks remain implicit; only server-hydrated
  or user-selected access settings become explicit thread-start overrides.
- Remote-control client inventories are generation-guarded independently from
  status reads. A late device-list response cannot repopulate a disabled,
  disconnected or superseded environment.
- App Server currently preserves injected Realtime context but does not project
  standalone injected voice items back into ordinary visual replay.
- Effective personality is accepted by start/update requests but is not always
  returned by current start/resume responses.
- The development dependency tree inherits advisories through
  `electron-builder`; production dependencies have no reported vulnerability.
- The lazy Markdown/KaTeX chunk is large but is not a release blocker.

## Post-v0.3.0 priorities

Choose one bounded lot at a time:

1. Continue stale-response review when extending mutation-heavy settings
   controllers; current thread history, catalogues, integrations, account,
   memory and remote-control hydration paths are generation-guarded.
2. Add `CONTRIBUTING.md`, focused issue/PR templates and a concise public App
   Server compatibility guide.
3. Add user-controlled diagnostic export with redaction and preview.
4. Define an explicit, non-silent update and rollback strategy.
5. Validate Debian-family packaging on additional machines before considering
   Fedora packaging.

Defer generic RPC/filesystem consoles, unstable plugin-marketplace production
support and Git/worktree management without a stable App Server product
contract.

## Verification

Use Node 24:

```bash
npm run check
npm test
npm run test:electron
npm run build
npm audit --omit=dev
```

For protocol changes:

```bash
npm run test:contract
codex app-server generate-json-schema --out /tmp/codex-schema --experimental
```

For packaging or native behavior:

```bash
npm run electron:dev
npm run electron:deb
```

For meaningful UI work, validate the browser preview through the shared
Playwright MCP session at 1240×820 and 840×620. Inspect accessibility and
browser logs, wait at least 0.5 seconds after transitions, and replace affected
curated screenshots under `screenshots/`.

No active blocker is known.
