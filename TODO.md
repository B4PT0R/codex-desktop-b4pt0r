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

Maintain **v0.3.1** as the current community beta and choose the next bounded
post-release lot from the priorities below.

The completed conversation-polish lot:

- follows late content-height changes while the reader remains near the bottom,
  including lazy Markdown, media and browser layout stabilization;
- stops following immediately when the reader intentionally scrolls upward;
- uses an immediate initial/thread-replacement jump and preserves smooth
  scrolling only for genuinely appended prompts;
- shortens the conversation’s bottom reserve while an active Plan is present,
  so the widget ends just above the composer and leaves the stream visible;
- reduces Plan density without hiding its current steps;
- aligns agent text, Realtime, action, signal, error and media surfaces to one
  95% conversation column while leaving the Plan intentionally compact;
- tightens inter-turn spacing and justifies only substantial Markdown
  paragraphs, avoiding stretched short replies.

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

The v0.3.1 source, package metadata and installed files passed final
verification. Installation was performed over the running v0.3.0 instance so
the current App Server session remained intact; the installed v0.3.1 code takes
effect on the user's next deliberate application relaunch.

## Verified candidate baseline

- Installed Codex: `codex-cli 0.145.0`.
- App Server schema audit: stable and experimental v2 schemas, official source
  checkout `0dfa778dae6a`.
- Client protocol inventory: 63 product request methods, 55 interpreted
  notification methods and 6 handled server requests.
- Frontend/unit/contract: 494 tests across 95 files, including 45 installed
  App Server contract cases.
- Electron/Node: 51 tests.
- Strict TypeScript: passing.
- Production Vite build: passing.
- Production dependency audit: zero vulnerabilities.
- Main JS: 511.63 kB, 148.78 kB gzip.
- Lazy diff viewer: 89.50 kB, 32.89 kB gzip.
- Lazy Markdown/KaTeX: 698.90 kB, 208.87 kB gzip.

Current release artifact:

- package: `dist/codex-desktop-linux_0.3.1_amd64.deb`;
- size: 108,448,336 bytes;
- package SHA-256:
  `a1116085968fe834cfa16f1879a0cff3e444b2e53f66382ff36ad7b7a8ecd291`;
- packaged ASAR SHA-256:
  `719bf93c179b27fb0ee5611c9b8334eb8b2290946a1ccb5f604f31e57f8c3f3f`.

`dpkg-query` reports `codex-desktop-linux 0.3.1 amd64 install ok installed`;
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

## Post-v0.3.1 priorities

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
