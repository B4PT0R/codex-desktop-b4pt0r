# Codex Desktop Linux — Project handoff

Last updated: 2026-07-25

This file is the short operational memory for the next contributor or Codex
agent. Read `AGENTS.md` first. Durable architecture belongs in
`UI_ARCHITECTURE.md`; protocol inventory belongs in `APP_SERVER_COVERAGE.md`;
completed implementation detail belongs in Git history.

## Current state

Codex Desktop Linux is a functional, independent Electron client for the
official `codex app-server`. It covers the ordinary desktop workflow end to end:

- App Server startup, reconnect, thread creation/resume/search and pagination;
- streaming messages, steering, reasoning, plans, tools, approvals and errors;
- model, reasoning, personality, collaboration and permission settings;
- bounded global `config.toml` editing with validation and conflict detection;
- Markdown/GFM, streaming and completed LaTeX, structured multi-file diffs;
- files, Apps, MCP, skills, hooks, account, quotas and reset credits;
- dictation through the Codex OAuth transcription endpoint and Realtime voice;
- background terminals, guarded shell commands and persistent goals;
- managed Chromium, tray, autostart and versioned Linux preferences.

The product direction is a polished Linux experience that remains familiar to
users of the Codex product family without implying that this is an official
OpenAI release.

## Verified baseline

- Package: `dist/codex-desktop-linux_0.2.2_amd64.deb`
- Size: 105,980,588 bytes
- SHA-256:
  `9947a9164f0ffa85f00315394e6bfe9532fff2616d7ceb511c1f8000c54d7866`
- Installed locally as `codex-desktop-linux 0.2.2` on Ubuntu amd64.
- The current Config editor, tool-group fixes, App Server PATH fix, workspace
  `AGENTS.md` editor and dual-agent Realtime chat hierarchy are included in the
  installed package, including the centralized Realtime shutdown cleanup.
- The atomic-persistence, stale-request sanitation, App Server compatibility,
  command-menu and Realtime-transcript lots described below are included.
- Installed ASAR matches the packaged ASAR.
- `/opt/Codex Desktop/chrome-sandbox` is `root:root` mode `0755` because the
  package post-install verified working user namespaces; it falls back to
  `4755` only on systems where user namespaces are unavailable.
- Installed Codex used for the latest schema checks: `codex-cli 0.145.0`.
- App Server coverage was refreshed on 2026-07-25 against stable and
  experimental schemas plus official checkout `0dfa778dae6a`: the schemas
  expose 89/126 client requests, 10/11 server requests and 70 notifications.
  This client emits 53 product methods (41 stable, 12 experimental), explicitly
  handles 54 notifications and answers 6 server requests. See
  `APP_SERVER_COVERAGE.md` for the classified inventory.
- 433 Vitest/contract tests across 85 files pass:
  394 frontend/unit/component cases and 39 App Server contract cases.
- 31 Electron/Node tests pass.
- Strict TypeScript and the production build pass.
- Production dependency audit reports zero vulnerabilities.
- Main JS: 469.72 kB (137.64 kB gzip).
- Lazy diff viewer: 89.50 kB (32.89 kB gzip).
- Lazy Markdown/KaTeX: 698.43 kB (208.65 kB gzip).

The worktree may contain the current reviewed UI lot. Inspect `git status`
before starting and do not discard unrelated changes.

## Current focus

Prepare the repository for an initial community release where a Linux user can
clone it, ask their Codex agent to continue development, and obtain a safe,
reviewable result without private project context.

The application itself is already sufficiently complete. Prefer reliability,
portability, contributor guidance and maintenance workflows over adding broad
new surfaces.

## Next work

Pick one bounded lot, preserve the order unless a verified bug changes priority,
and update this section when priorities move.

### P0 — release confidence

- [ ] Run long packaged-Electron sessions that exercise many messages, tool
      groups, compaction, interruption, reconnect, suspend/resume and thread
      reopening. Record only reproducible defects.
- [ ] Validate the `.deb` on a clean second Ubuntu machine or VM. Check install,
      first launch, App Server discovery, login, tray, microphone, Realtime,
      managed Chromium, desktop icon, upgrade and uninstall.
- [ ] Add at least one Debian-family environment to the tested-platform matrix.
      Investigate Fedora packaging only after the Debian path is documented and
      reproducible.

### P1 — community onboarding

- [ ] Rewrite `README.md` as a concise public entry point: independent-project
      disclaimer, prerequisites, install/build instructions, first run,
      screenshots, known platform scope and links to contributor documents.
- [ ] Add `CONTRIBUTING.md` with a small first-contribution workflow that mirrors
      `AGENTS.md` without duplicating its full rules.
- [ ] Add focused issue and pull-request templates for bugs, App Server
      compatibility changes and bounded UI improvements.
- [ ] Document the supported Codex/App Server compatibility policy and the
      schema-upgrade workflow in a human-facing guide.
- [ ] Curate a handful of small, independent starter issues that an agent can
      complete with a regression test and clear verification.

### P1 — operability

- [ ] Add a user-controlled diagnostic export with secret redaction, bounded
      logs, version/platform information and an explicit preview before saving.
- [ ] Define an update strategy. Do not enable silent updates; make provenance,
      signature expectations, release notes, download progress and rollback
      behavior explicit.

### P2 — later, only with a stable backend contract

- [ ] Add opt-in feedback upload with classification, log preview and explicit
      attachment consent.
- [ ] Revisit remote control, memory controls and runtime feature flags after
      their APIs and recovery/security UX stabilize.

## Recent decisions that constrain the next change

- Electron is the only production shell. Do not restore the retired Tauri path.
- The installed App Server is the source of truth. Capability fields and
  generated v2 schemas take precedence over model-name or version guesses.
- When `activePermissionProfile` is absent, permission hydration falls back to
  the effective legacy `sandbox` response. A renderer fallback must never
  overwrite server state.
- Personality is always discoverable in Agent settings when support is unknown;
  it is disabled only when the selected model explicitly reports no support.
- Tool calls are presented serially within an agent step, while ingestion stays
  immediate. Completed rows and groups finish their collapse animation before
  later streamed text is revealed.
- If a fully folded action group is reopened by a later silent tool step, only
  that step's cards are shown while it runs. The final folded summary still
  retains every action and expands to the complete history on demand.
- Terminal tool rows, including failures, remain readable for their dwell period
      and then fold durably. If another call is attached after its predecessor has
      already compacted, presentation catches up immediately instead of waiting for
      a collapse callback that already occurred.
- Replayed `item/started` notifications are idempotent by tool identifier: they
  enrich a running action without duplicating it and cannot resurrect a completed
  single-action group.
- The plan is one live widget in conversation flow, not an overlay.
- Diffs use a lazy structured renderer with a readable partial-patch fallback
  and an optional raw disclosure.
- Generated images render in a persistent conversation widget outside the tool
  accordion. They remain expanded until the user folds them, provide a
  viewport-filling overlay and use a bounded native save-image boundary.
- Global Config editing never exposes a generic filesystem primitive. Electron
  resolves only `$CODEX_HOME/config.toml`, limits it to 1 MB, validates TOML,
  rejects stale versions and replaces the file atomically with mode `0600`.
- Completed and streaming LaTeX remain separate rendering paths so incomplete
  formulas cannot destabilize streaming.
- Realtime uses a separate ephemeral voice thread because persistent voice
  threads reproduced erroneous quota interruptions.
- Dictation uses Chromium `MediaRecorder` with WebM/Opus and Electron
  `net.fetch`; it does not depend on Python or distribution-specific audio
  libraries.
- Client-owned settings live atomically in
  `~/.codex/codex-desktop-linux.json`. Official Codex configuration remains in
  `~/.codex/config.toml`.
- Browser automation owns a separate open-source Chromium process; never embed a
  general-purpose browser WebView inside the app.
- When Electron discovers Codex by absolute path (including an NVM install), its
  containing directory is prepended to the App Server child environment so
  agent tools inherit access to both `codex` and its neighboring Node runtime.
- The thread-title menu groups the less frequent Goal and workspace-scoped
  `AGENTS.md` controls instead of keeping permanent buttons in the top bar.
  Native `AGENTS.md` access remains limited to that exact file, with a 1 MB
  bound, atomic writes, external-change detection and symlink rejection.
- Native text/preferences persistence shares one unique-temporary atomic-write
  primitive. Desktop preference patches are serialized per file so concurrent
  locale, appearance, workspace or layout updates cannot overwrite each other.
- Workspace document requests are generation-guarded across close and workspace
  changes; late reads or saves cannot hydrate the editor with stale content.
- Effective thread settings from start, resume and
  `thread/settings/updated` share one normalizer; live server state updates
  model, effort, personality, collaboration, permissions and cwd.
- Managed permission-profile and hook constraints are read only on the relevant
  settings pages. MCP configuration reload is explicit and distinct from an
  inventory refresh.
- Hook runs update one quiet conversation signal from start through completion.
  Archive, unarchive and close notifications reconcile thread state across
  clients without duplicating restored entries.
- The `/` command palette is anchored eight pixels above the composer rather
  than overlapping the active input. Its viewport-bounded scrolling and
  keyboard focus behavior remain unchanged.
- Realtime transcript deltas stream directly into stable conversation messages
  for both speakers. `thread/realtime/itemAdded` speech-start events reserve the
  user's provisional message before the assistant reply, even when user text is
  only delivered at transcript finalization; the message is finalized in place
  and the assistant keeps its pink voice identity. Classic microphone dictation
  remains a separate capture-and-transcription flow.
- Completed Realtime voice replies are primary chat messages with the pink
  voice identity. Concurrent text-agent messages carry an explicit modality,
  stream inside a restrained blue disclosure, then fold automatically after
  completion; tool groups are not mislabeled as text replies. The message IDs
  already present at Realtime startup form a boundary and must not be
  retroactively classified as concurrent text-agent replies.
- Finalized Realtime utterances are injected in order into the persistent parent
  thread through `thread/inject_items`, using client-assigned
  `realtime_voice_*` response-item IDs. Each later voice session runs on an
  ephemeral `thread/fork` of that parent with App Server startup context enabled,
  so native rollout history — including earlier injected voice items — reaches
  Realtime without client-side rollout parsing or duplicated transcript storage.
  After Realtime stops or fails, the client unsubscribes from the ephemeral fork;
  App Server then unloads it through its native idle-thread lifecycle.
  All exit paths share one conversation-state reset and one atomic provisional
  message finalizer; changing thread invalidates the fork before asynchronous
  shutdown so late audio notifications cannot enter the next conversation.
  Current App Server resume projection still ignores standalone injected raw
  response items, so restoring their voice containers visually after reopening
  needs a supported projection/read path; context continuity does not imply
  visual replay.
- The App Server inventory is classified by product value rather than endpoint
  count. Experimental generic host, remote-control, memory and feature-flag
  primitives stay unexposed until they have a stable, recoverable user flow.

## Known limitations

- Linux is the primary and only validated packaged platform.
- The current `.deb` has been exercised on the development Ubuntu installation,
  not yet through a published multi-machine test matrix.
- Personality is accepted by start/update requests, but the current
  `thread/start` and `thread/resume` responses do not expose an effective
  personality field. Do not pretend the server returned state it did not return.
- Raw Config editing is intentionally native and limited to
  `$CODEX_HOME/config.toml` (or `~/.codex/config.toml`). App Server's structured
  config writes cannot preserve comments or arbitrary hand-authored TOML.
- The package post-install selects user-namespace sandboxing with mode `0755`
  when its probe succeeds, and SUID sandboxing with mode `4755` otherwise.
  Both branches still require clean-machine packaging validation.
- `App.tsx` still coordinates substantial application state. Extract cohesive
  ownership when adding non-trivial flows; do not perform a speculative rewrite.
- The large Markdown/KaTeX chunk is intentionally lazy and is not a release
  blocker.

## Verification commands

Use Node 24 in the current development environment:

```bash
export PATH=/home/baptiste/.nvm/versions/node/v24.15.0/bin:$PATH
npm run check
npm test -- --run
npm run build
npm run test:electron
```

For protocol changes:

```bash
npm run test:contract
codex app-server generate-json-schema --out /tmp/codex-schema --experimental
```

For native UI, audio, permissions, tray, process-lifecycle or packaging changes:

```bash
npm run electron:dev
npm run electron:deb
```

For meaningful UI changes, use the configured Playwright MCP browser preview at
1240×820 and 840×620, inspect accessibility and console output, wait at least
0.5 seconds after the final transition, then replace the affected curated
screenshots under `screenshots/`.

## Handoff checklist

Before ending a contribution:

- [ ] The active objective and outcome are reflected in this file.
- [ ] Stale priorities or claims have been removed rather than appended around.
- [ ] Protocol behavior was checked against the installed schema when relevant.
- [ ] A regression test covers each practical bug fix.
- [ ] Relevant automated checks and native/browser checks are recorded above.
- [ ] New user-facing text exists in both French and English locale packs.
- [ ] Curated screenshots and their inventory match meaningful UI changes.
- [ ] No secret, token, private workspace content or machine-specific workaround
      was added.

## Intentionally not planned

- Generic filesystem, process, command or MCP RPC consoles: safer product flows
  already expose the useful outcomes.
- Deprecated `thread/rollback`, internal token/attestation hosting and
  Windows-only sandbox setup.
- Production use of the under-development plugin marketplace surface until the
  official contract permits third-party clients.
- Git/worktree management until App Server exposes a stable product workflow.

No active blocker is known.
