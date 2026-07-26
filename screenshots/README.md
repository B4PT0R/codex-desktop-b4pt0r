# Application screenshots

Curated visual checkpoints for Codex Desktop Linux. Temporary Playwright output
is not part of this collection; keep only captures that document a useful UI
state or regression baseline.

## 2026-07-19

- `baseline-desktop.png` — initial 1240×820 desktop baseline retained for
  before/after comparisons.
- `desktop-1240x820.png` — current main conversation shell with its enlarged,
  centered welcome at desktop size.
- `desktop-840x620.png` — the same welcome balanced above the composer at minimum
  size.
- `desktop-en-1240x820.png` — English locale applied live to the daily-use shell,
  sidebar, welcome, composer, and footer.
- `settings-language-native-1240x820.png` — native General settings with the French
  language preference and the real launch-at-login state enabled.
- `settings-language-en-native-1240x820.png` — the same settings page immediately
  switched to its complete English pack.
- `composer-add-menu-1240x820.png` — unified composer `+` menu at the desktop
  baseline viewport.
- `composer-add-menu-840x620.png` — the same menu at the configured minimum
  viewport, with no horizontal overflow.
- `work-panel-1240x820.png` — persistent file-diff panel beside the conversation.
- `work-panel-840x620.png` — responsive overlay form of the work panel at the
  minimum viewport.
- `tool-activity-native-1240x820.png` — real native file-change activity with the
  completed state visible directly in the conversation.
- `tool-activity-native-840x620.png` — real native MCP activity at the minimum
  window size, confirming compact rows and readable individual status.
- `tool-activity-en-native-1240x820.png` — persisted native file-change activity
  rebuilt with English summaries, statuses, details and condensation controls.
- `integrations-skills-native-1240x820.png` — live workspace skill inventory in
  the native desktop client, now preceded by the connected Apps inventory.
- `composer-apps-native-1240x820.png` — bounded native list of connected Apps in
  the composer, with long backend descriptions clamped for scanability.
- `composer-app-mention-native-1240x820.png` — selected GitHub App represented by
  both its removable context chip and its matching `$github` invocation token.
- `composer-file-mention-native-1240x820.png` — a real fuzzy-search result selected
  entirely by keyboard and represented by its removable file chip plus matching
  `@package.json` prompt token.
- `thread-search-native-1240x820.png` — live App Server search across persisted
  conversation content, including a matching historical excerpt that was not visible
  in the thread title.
- `thread-goal-native-1240x820.png` — the real active autonomous goal loaded from
  App Server, including status, objective, accumulated token/time usage and guarded
  pause/delete controls; the validation did not modify it.
- `shell-command-confirm-native-1240x820.png` — neutral-first confirmation for a
  host-local `pwd` command, including the explicit no-sandbox/full-Linux-account warning;
  native QA cancelled it without execution.
- `integrations-mcp-native-1240x820.png` — live MCP server, tool, version, and
  authentication inventory in the native desktop client.
- `permissions-native-1240x820.png` — live named permission profiles returned by
  App Server.
- `account-native-1240x820.png` — live account and usage surface with the account
  email masked for safe sharing and the five earned reset tickets returned by the
  current backend.
- `account-en-native-1240x820.png` — the same live account, usage and reset-credit
  surface after switching the interface to English.
- `account-native-840x620.png` — responsive account and usage surface at minimum
  window size, including the ticket summary and action.
- `account-reset-confirm-native-1240x820.png` — guarded confirmation shown before
  spending a real reset ticket; the capture was cancelled without consumption.
- `account-logout-confirm-native-1240x820.png` — guarded managed-account logout;
  the native validation cancelled it and left the real account unchanged.
- `thread-delete-confirmation-1280x720.png` — guarded permanent deletion with the
  affected title, descendant-branch warning, and neutral action focused by default.
- `thread-delete-confirmation-840x620.png` — the same destructive confirmation at
  the minimum viewport, with its full content and actions visible.
- `rich-artifacts-1280x720.png` — generated-image artifact displayed directly in
  the tool activity while preserving the compact conversation hierarchy.
- `rich-web-results-1280x720.png` — structured web result card with title, host,
  excerpt, and external-open action.
- `rich-web-results-840x620.png` — rich artifacts at minimum size after automatic
  scroll keeps the expanded web result above the composer.
- `chromium-settings-native.png` — native General settings detects that open-source
  Chromium is absent even though Google Chrome is installed, and offers installation.
- `chromium-install-confirmation-native.png` — explicit package and privilege
  confirmation shown before any Chromium installation command is started; the
  validation cancelled without changing the system.
- `keyboard-composer-menu-native-1240x820.png` — native keyboard-only composer
  navigation after Tab, Enter and Arrow Down, with the focused Apps item visibly
  distinguished before Escape restores the opener.
- `welcome-dark-native-1240x820.png` — corrected dark welcome composition: the
  enlarged logo and copy remain one vertically centered unit above the composer.
- `welcome-light-native-1240x820.png` — the same real native shell after applying
  the persistent light theme.
- `settings-appearance-dark-native-1240x820.png` — functional Appearance page with
  system/dark/light theme and bounded interface sizing controls.
- `hooks-native-1240x820.png` — live read-only Hooks inventory backed by App Server;
  this project currently demonstrates the genuine empty state rather than mock data.
- `settings-appearance-light-large-native.png` — live light theme and large interface
  size together, confirming the complete settings shell remains usable at 1240×820.

## 2026-07-24

- `advanced-import-preview-1240x820.png` — stable external-agent import surface in
  the browser preview at desktop size, including explicit Claude Code/Cursor source
  selection plus its empty and history states.
- `advanced-import-preview-840x620.png` — the same surface at the configured minimum
  window size, with the settings navigation and actions remaining readable.
- `advanced-import-native-1240x820.png` — live desktop/App Server detection of
  migratable Claude Code hooks and instructions; no item was imported during QA.
- `voice-realtime-v3-preview-1240x820.png` — Realtime v3 voice preferences in the
  browser preview, with the built-in V3/V1-compatible voice catalog.
- `voice-realtime-v3-preview-840x620.png` — responsive voice settings at the
  configured minimum viewport.
- `voice-realtime-v3-native-1240x820.png` — live desktop settings populated by
  `thread/realtime/listVoices`; QA persisted Maple, verified the native settings file,
  then restored Juniper without starting a microphone session.
- `composer-audio-controls-preview-1240x820.png` — distinct waveform Realtime and
  microphone dictation controls in the desktop composer.
- `composer-audio-controls-preview-840x620.png` — the same two controls at the
  configured minimum viewport, with the composer remaining balanced.
- `composer-audio-controls-native-1240x820.png` — the installed desktop client
  showing the separate waveform and microphone actions in a live conversation;
  QA did not activate either audio session.

## 2026-07-25

- `approval-policy-picker-preview-1240x820.png` — the light approval-policy
  popover beside the permission profile, making “full access” and “never ask”
  explicit independent choices.
- `approval-policy-picker-preview-840x620.png` — the same approval control at
  the configured minimum viewport without horizontal overflow.
- `composer-context-footer-preview-1240x820.png` — the context/compaction ring
  moved from the composer action cluster into the footer metrics group beside
  the quota gauges, leaving the audio and turn controls less crowded.
- `composer-context-footer-preview-840x620.png` — the same footer arrangement at
  the configured minimum viewport, with model, permission, context and quota
  controls remaining on one readable line.
- `work-panel-layout-preview-1240x820.png` — the lazy structured multi-file diff
  viewer in the desktop work panel, with unified line numbers, addition/deletion
  stats and an optional raw-patch disclosure.
- `work-panel-layout-preview-840x620.png` — the same structured diff at the
  configured minimum viewport; the responsive panel stays inside the
  conversation band and scrolls without covering the composer.
- `agent-personality-settings-preview-1240x820.png` — the Agent settings expose
  thread behavior separately from global response verbosity and Plan-mode
  reasoning effort.
- `agent-personality-settings-preview-840x620.png` — the same Agent settings at
  the configured minimum viewport with native vertical scrolling.
- `workspace-agents-editor-preview-1240x820.png` — the workspace-scoped
  `AGENTS.md` editor opened from the thread-title action menu, with its full
  writing area and guarded save controls.
- `workspace-agents-editor-preview-840x620.png` — the same modal editor at the
  configured minimum viewport, where the complete editor remains usable.
- `thread-title-menu-preview-1240x820.png` — the thread-title menu groups Goal,
  `AGENTS.md`, compaction, fork and deletion while leaving the top bar quiet;
  the rename field appears only after the explicit edit action.
- `thread-title-menu-preview-840x620.png` — the same action menu remains fully
  visible inside the configured minimum viewport.
- `application-error-message-preview-1240x820.png` — a client-side operation
  failure uses a compact alert card instead of appearing as ordinary assistant
  Markdown in the conversation.
- `application-error-message-preview-840x620.png` — the same error modality
  stays readable and contained at the configured minimum viewport.
- `generated-image-widget-preview-1240x820.png` — a generated image remains in
  a dedicated persistent media widget below the compact technical action.
- `generated-image-widget-preview-840x620.png` — the same widget remains
  contained without horizontal overflow at the configured minimum viewport.
- `generated-image-lightbox-preview-840x620.png` — the generated-image overlay
  fills the complete application viewport with minimal padding and keeps save
  and close actions available above the image.
- `generated-image-widget-source.jpg` — the compact generated cat-astronaut
  fixture used by the browser-only visual preview.
- `mcp-reload-preview-1240x820.png` — MCP settings distinguish a lightweight
  inventory refresh from an explicit App Server configuration reload.
- `mcp-reload-preview-840x620.png` — the same dual-action header remains
  readable without horizontal overflow at the configured minimum viewport.
- `slash-command-menu-preview-1240x820.png` — the `/` command palette sits
  entirely above the composer, preserving a visible gap and unobstructed input.
- `slash-command-menu-preview-840x620.png` — the viewport-bounded palette at
  minimum size, with keyboard focus and internal scrolling preserved.
- `realtime-dual-agent-chat-preview-1240x820.png` — completed Realtime speech
  and its streaming state share the primary pink-identified chat response while
  the concurrent text agent is retained in a compact blue disclosure; the
  composer stays free of duplicate transcript UI.
- `realtime-dual-agent-chat-preview-840x620.png` — the same dual-agent hierarchy
  at the configured minimum viewport without horizontal overflow.

Screenshots are taken only after waiting at least 0.5 seconds after the last
view transition so asynchronously rendered content is visible.

## 2026-07-26

- `web-search-settings-preview-1240x820.png` — global web-search and reasoning
  summary preferences isolated in the secondary Options section.
- `web-search-settings-preview-840x620.png` — the Options section at the
  configured minimum viewport without clipping or layout overflow.
- `memory-settings-preview-1240x820.png` — experimental local-memory controls,
  privacy boundary, quota guard and protected reset action.
- `memory-settings-preview-840x620.png` — the same Memory section at minimum
  viewport size with native vertical scrolling.
- `remote-control-settings-preview-1240x820.png` — the dedicated experimental
  Remote Control section, including its pairing security boundary and explicit
  browser-preview unavailable state.
- `remote-control-settings-preview-840x620.png` — the same App Server-owned
  Remote Control surface at the configured minimum viewport without clipping
  or document overflow.
- `config-settings-cards-preview-1240x820.png` — the airy Config landing page
  presents `config.toml` and global `AGENTS.md` as compact document cards.
- `config-settings-cards-preview-840x620.png` — the same two entry points remain
  readable and contained at the configured minimum viewport.
- `config-editor-modal-preview-1240x820.png` — the shared modal editor for
  bounded Codex documents, with file identity, restart guidance and explicit
  reload/save controls.
- `config-editor-modal-preview-840x620.png` — the modal editor adapts to the
  minimum viewport and active interface scale without clipping or overlap.
