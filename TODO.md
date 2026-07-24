# Codex Desktop Linux — Remaining work

Last updated: 2026-07-19

## Product state

The client now covers the normal Codex desktop loop end to end: App Server lifecycle,
thread creation/resume/search/organization, paginated chat, streaming and steering,
models and collaboration, permissions and approvals, agent questions, tool/reasoning/
plan activity, diffs and rich artifacts, files and connected Apps, MCP and skills,
hooks, account/login/usage/quotas/reset credits, Realtime audio, background processes,
guarded local shell commands, persistent goals, Chromium handoff and Linux desktop
preferences.

Architecture and product decisions live in `AGENTS.md` and `UI_ARCHITECTURE.md`.
`APP_SERVER_COVERAGE.md` is the authoritative endpoint audit. The official Codex
checkout remains the protocol source of truth.

Current validation baseline: 314 tests across 60 frontend/contract files, strict
TypeScript and production build, plus the unchanged 8-test native Rust baseline.
Initial bundles are 384.92 kB JavaScript (112.82 kB gzip) and 53.19 kB CSS
(10.79 kB gzip); Markdown stays in a separate lazy 157.44 kB chunk. The native app
is connected and usable under WebKitGTK.

## Active finish pass

- [x] Fix native chat bottom-follow under WebKitGTK: decide before paint and scroll
      the transcript container directly instead of relying on `scrollIntoView`.
- [x] Expand the composer palette from 3 to 18 genuinely wired desktop commands,
      with thread/turn gating and a bounded scrollable menu.
- [x] Hide empty reasoning cards, preserve merged summaries at completion and honor
      `item/reasoning/summaryPartAdded` boundaries for readable expanded content.
- [x] Remove the redundant running header above active tool calls; individual rows and
      the transcript activity indicator already expose progress, while completion and
      failure summaries remain visible.
- [x] Keep the active tool detailed, condense each completed call to one expandable
      line, then collapse the completed sequence into an airy summary by action kind.
- [x] Replace the passive footer context slider with an actionable green/orange/red
      circular gauge beside the microphone; clicking it starts thread compaction.
- [x] Batch the current usage-feedback fixes, produce the Debian package on explicit
      request and force-reinstall it over the running `0.1.0` installation.
- [x] Audit all 124 client requests, 9 server requests and 71 notifications in the
      current App Server protocol. Separate product features from host primitives,
      deprecated methods, platform-only methods and forbidden/experimental surfaces.
- [x] Replace the Hooks preview with the stable bounded `hooks/list` inventory.
- [x] Add stable persisted thread goals: create/edit, optional token budget, progress,
      pause/resume, status notifications and guarded removal.
- [x] Answer experimental external-clock `currentTime/read` requests automatically;
      the client opts into the experimental API and must not leave such a turn hanging.
- [x] Present `model/verification` and `model/safetyBuffering/updated` as bounded,
      localized conversation notices.
- [x] Run the complete frontend/contract suite and production build, validate the new
      goal surface in native WebKitGTK, refresh curated screenshots, then record the
      final baseline here.
- [x] Make long chats cheaper and steadier: preserve unchanged message references,
      memoize transcript rows and activity groups, avoid Markdown parsing during
      streaming, virtualize off-screen message layout, coalesce bottom-follow scrolls,
      respect manual scroll-up, condense completed tool history, and merge consecutive
      reasoning items into one Thinking card.
- [x] Complete a repository-wide quality pass: make Stop explicit beside the composer,
      move App Server value normalization out of `App.tsx`, reject duplicate pagination,
      quota reset, terminal stop, goal mutation and interactive-response requests before
      React rerenders, and prevent stale quota reads from replacing newer notifications.

## Nice-to-have backlog

Ordered by expected real-world value. None blocks a clean broadly capable release.

1. Add a small persisted Realtime voice selector backed by
   `thread/realtime/listVoices`; retain the current known-good voice as fallback.
2. Add an explicit MCP configuration reload action (`config/mcpServer/reload`) next to
   inventory refresh for external `config.toml` edits.
3. Surface relevant enterprise constraints from `configRequirements/read` only when
   present, especially permission and managed-hook restrictions.
4. Add opt-in feedback upload with classification, log preview and explicit attachment
   consent.
5. Add external-agent detect/import/history in Advanced with per-item preview and
   progress. This is stable but low frequency.
6. Revisit remote control, memory controls and runtime feature flags only after their
   experimental APIs and recovery/security UX stabilize.

Not planned now:

- Git/worktree management: no stable App Server v2 workflow exists.
- Plugin marketplace/install/share: the official README still says production clients
  must not call the under-development plugin surface.
- Generic filesystem, process, command or MCP RPC consoles: these are host/agent
  primitives already represented through safer product workflows.
- Deprecated `thread/rollback`, internal token/attestation hosting, and Windows-only
  sandbox setup.

## Quality gates

- Keep protocol construction and normalization in `src/lib/`, with installed-schema
  contracts for every request shape the client sends.
- Keep `src/App.tsx` below the monolith threshold; use focused components/hooks and
  narrow domain props. Split any source file before ownership becomes ambiguous.
- New copy belongs in both typed FR/EN packs. Async failures remain visible and
  recoverable; destructive or unsandboxed actions remain neutral-first and explicit.
- Run `npm run check`, `npm test -- --run`, `npm run build`, and relevant Rust tests.
- Validate meaningful UI changes in real Tauri/WebKitGTK. Wait at least 0.5 seconds
  before updating curated captures under `screenshots/`.

## Environment notes

- Native dev launch may require:
  `env -u LD_LIBRARY_PATH -u GTK_PATH -u GIO_MODULE_DIR -u GI_TYPELIB_PATH npm run tauri dev`.
- Browser automation uses a separately managed open-source Chromium process, never an
  embedded general-purpose WebView. The system browser is the explicit fallback.
- `~/dev/codex-desktop-linux-official` and `references/official-ui/2026-07-19/` are UX
  references only; do not copy bundled implementation code.
- The integrated Browser inventory may be empty; native X11 validation remains valid.
- No active blocker.
