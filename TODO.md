# Codex Desktop Linux — Handoff

Last updated: 2026-07-28

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

Maintain **v0.3.3** as the current public release and enforce a strict settings
scope boundary. Settings sections own only persistent global preferences.
Model, effort and Plan mode share the model popover; permissions and approvals
share the Security popover in the main session bar. Config keeps guided uncommon TOML fields and
the bounded raw editor instead of becoming the owner of every global setting.

The completed release contains:

- present each workspace as a compact collapsible group with its thread count;
- automatically open the workspace containing the active thread;
- keep a single workspace expanded during ordinary navigation;
- expose every matching group while global thread search is active;
- preserve archive, delete, running/error states and keyboard accessibility;
- validate the hierarchy at 1240×820 and 840×620 in the shared browser.

The same candidate also simplifies context-compaction activity: the turn-level
spinner remains the sole active progress indicator, while the conversation
retains only a quiet, non-expandable completion marker.

The empty conversation now establishes a real flex-height owner for its welcome
composition. Its visible logo-and-copy group remains exactly centered in the
usable chat viewport at both reference sizes instead of relying on a
content-sized percentage height. The large light-theme mark uses a softer dark
anthracite shared consistently with the navigation mark. That warm anthracite
is now the light theme's common reader ink for primary prose, headings, inputs
and active controls; secondary and semantic colors remain distinct.

The browser preview passes at both reference sizes, the full verification
matrix is green, and the signed-off Debian package is installed locally and
published on GitHub. The repository is public at
`https://github.com/B4PT0R/codex-desktop-b4pt0r`; no active blocker is known.

The public README uses a deterministic English-only `demo=readme` fixture.
`screenshots/` intentionally retains only the current light and dark showcase;
older visual checkpoints remain recoverable from Git history.

The settings-scope and guided Config lot has focused component and controller
regression coverage and was visually reviewed at 1240×820 and 840×620.
Agent and Permission defaults write the corresponding global TOML values;
the global personality default remains editable independently of the current
model capability and takes effect on subsequent compatible sessions;
Config retains
only uncommon guided fields, the raw editor and global instructions. Web
combines global search behavior with the shared browser lifecycle, while
Chat owns reasoning summaries and future global feedback-detail preferences.
The ambiguous Options section has been removed. The narrow layout preserves
readable labels, usable controls and horizontal containment.
Light-theme cards, select menus, text inputs and the raw editor use the light
palette explicitly; technical descriptions are consistently set at 10px/15px
while the dark theme retains its existing surfaces. The browser console reported
no warnings or errors during this review.

Dictation insertions are acknowledged by the composer as soon as they are
applied. A consumed transcript cannot be replayed if the composer remounts
while the resulting message creates or updates a thread.

The native shared-browser client keeps the app-owned MCP event channel open
through a persistent Node HTTP stream for the application lifetime. It also
recognizes an expired session, performs one
fresh handshake and retries the requested navigation once. Ordinary links
therefore remain independent from an active agent MCP session without closing
Chromium after navigation or hiding unrelated Playwright failures.
The event stream is attached immediately after initialization, before the
initialized notification, because Playwright MCP gates backend creation on that
transport. The client answers Playwright's JSON-RPC heartbeat requests from the
stream; otherwise the server closes the backend and browser after its
five-second ping timeout. Native
shutdown signals the server child synchronously before awaiting graceful
cleanup; startup may remove a stale PID only after verifying the current user,
Playwright CLI, fixed port and app-owned browser profile.

## Verified candidate baseline

- Installed Codex: `codex-cli 0.145.0`.
- App Server schema audit: stable and experimental v2 schemas, official source
  checkout `0dfa778dae6a`.
- Client protocol inventory: 63 product request methods, 55 interpreted
  notification methods and 6 handled server requests.
- Frontend/unit/contract: 499 tests across 95 files, including 45 installed
  App Server contract cases.
- Electron/Node: 55 tests.
- Strict TypeScript: passing.
- Production Vite build: passing.
- Production dependency audit: zero vulnerabilities.
- Main JS: 527.30 kB, 153.07 kB gzip.
- Lazy diff viewer: 89.50 kB, 32.89 kB gzip.
- Lazy Markdown/KaTeX: 698.90 kB, 208.87 kB gzip.

Current release artifact:

- package: `dist/codex-desktop-linux_0.3.3_amd64.deb`;
- size: 108,455,612 bytes;
- package SHA-256:
  `287bd56f953349758730b0396818ee97c9d27aef1f9dcdd3814606e383c07156`;
- packaged ASAR SHA-256:
  `95e2fca734fce64b21c54f8aa1b8b1d386a92e66ec36e171dac3c516f7b613a0`.

`dpkg-query` reports `codex-desktop-linux 0.3.3 amd64 install ok installed`;
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

## Post-v0.3.3 priorities

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
