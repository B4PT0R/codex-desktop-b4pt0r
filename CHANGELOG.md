# Changelog

This file highlights user-visible changes in Codex Desktop Linux. The project
follows semantic versioning while the public interface is taking shape.

## [0.3.16] - 2026-07-31

### Added

- Advanced Configuration now provides a focused editor for the global
  `developer_instructions` value without requiring manual TOML editing.

### Changed

- Labeled icon buttons now keep their icon centered in the rounded leading
  edge, including when the label is omitted and the control becomes circular.

### Fixed

- Realtime voice sessions now receive the effective global developer
  instructions followed by the App Server-attested AGENTS.md hierarchy, so
  voice and text conversations start with the same durable guidance.

## [0.3.15] - 2026-07-31

### Fixed

- Debian updates now run as an explicit authenticated APT upgrade after the
  downloaded package name, version, architecture, size and SHA-256 have been
  verified. This avoids Ubuntu App Center treating a newer local package as an
  already-installed application and leaving its install action unavailable.
- The update request now returns only after APT succeeds or reports a bounded,
  actionable error; temporary packages are removed in either case.

## [0.3.14] - 2026-07-31

### Added

- The composer now offers a focused CLI-style command surface with keyboard
  completion, inline choices and a dedicated result item for every validated
  command.
- Spawned subagents appear as ordinary parent tool actions whose expandable
  details stream the bounded child transcript, nested messages and tool calls.
- The main window can shrink to a compact chat-column layout when the sidebar
  is collapsed.

### Changed

- The command catalog now concentrates on frequent conversation operations
  while advanced configuration remains in Settings.
- The README presents installation, architecture and supported workflows more
  directly for new users and contributors.
- Long-running subagents follow the same background-job presentation as
  command processes, without holding the parent action group open.

### Fixed

- Subagent activity is reconstructed from the native App Server activity event
  when a distinct live spawn item is absent, while both representations merge
  without duplicate actions when present.
- Completed status-less tools, including web searches, no longer retain a
  running spinner after their terminal notification.
- Command execution preserves composer focus and ignores stale asynchronous
  results after switching conversations.

## [0.3.13] - 2026-07-31

### Added

- General Settings now shows the Codex Desktop and installed Codex CLI/App
  Server versions, and can check the latest stable GitHub release on demand.
- A compatible newer Debian package can be downloaded from the trusted project
  release, verified against its published size and SHA-256 digest, and opened
  in the system installer. The app clearly asks the user to restart after
  completing the installation.
- Scheduled tasks can target the logical default conversation, resolving its
  current App Server identifier at wake-up rather than persisting a stale one.

### Changed

- Thread runtime setting mutations, browser-preview playback and turn
  coordination now have smaller focused owners, reducing application-level
  state concentration without changing their user-facing workflows.
- The packaged AppArmor profile now names the actual desktop executable and is
  protected by the package manifest tests.

### Fixed

- A stale failure from an earlier thread-setting change can no longer roll back
  a newer user choice or the state of another conversation.
- Turn coordination now bounds completed state and consistently releases queued
  work after every failed reservation path.

## [0.3.12] - 2026-07-30

### Fixed

- Reinstalling or restarting no longer fabricates “Configured conversation”
  as the default conversation's name. When the conversation is outside the
  recent catalog, its authoritative App Server summary is resolved through a
  read-only metadata request without activating or renaming it.
- The default conversation remains visible and navigable while that metadata
  is loading or unavailable, including Realtime-only parents with no replayable
  turns. Initial catalog hydration can no longer discard an earlier metadata
  response.
- Conversation renames are now confirmed with read-only server metadata before
  the UI reports success. Resuming the default Realtime parent refreshes that
  authoritative name, while a partial unnamed resume can no longer erase a
  previously confirmed title.
- Startup and repeated saves skip unchanged desktop preferences and
  `config.toml` content, preserving user state and file identity across
  reinstall and relaunch.

## [0.3.11] - 2026-07-30

### Added

- Config Settings now exposes Codex's global
  `suppress_unstable_features_warning` option, with a clear reminder that it
  hides startup warnings without stabilizing experimental features.
- Agent Settings now exposes model-advertised service tiers and documented
  subagent defaults: enablement, model, reasoning effort, concurrency and
  interruption messages. The model popover can override the service tier for
  the current conversation without presenting unsupported choices.
- Permissions now controls whether eligible approvals are reviewed directly by
  the user or by Codex's automatic risk reviewer, while honoring managed
  `allowedApprovalsReviewers` constraints.

### Changed

- Settings now names the global TOML editor and guided controls “Advanced
  Configuration”, while agent migration has its own “Import from Other Agents”
  destination, and shortens “Permission defaults” to “Permissions”.
  Unimplemented experimental and diagnostics placeholders have been removed.
- The composer footer now labels its combined permission and approval picker
  “Permissions” and uses the same compact chevron trigger as the model picker.
- Settings sections are ordered by likely consultation frequency: core agent
  controls first, specialized workflows and integrations next, and advanced or
  one-time migration surfaces last. English section names now consistently use
  Title Case and `&` for compact compound labels.
- Theme, interface sizing and conversation presentation now share one
  “Appearance & Display” section instead of splitting closely related display
  controls across Appearance and Chat.
- The global `AGENTS.md` editor now lives with model, reasoning and personality
  defaults in Agent instead of being buried in Advanced Configuration.
- Permissions now presents each access profile and approval policy as an
  explanatory selectable card, matching the composer picker instead of hiding
  behavior behind two dropdowns and a redundant explanation card.

### Fixed

- Long conversation names and workspace paths no longer stretch the default
  conversation selector beyond its intended Settings layout.
- Switching conversations during an active stream no longer lets late
  messages, reasoning activity or steering state leak into the newly selected
  thread.
- Returning to another active conversation now rehydrates the work produced in
  the background, restores its active turn and continues partial messages and
  tools without falsely completing them.
- Conversation hydration now keeps the complete transcript mounted behind a
  centered loading surface, then dismisses the spinner and overlay without
  animating or relaying out the chat itself.
- Automatically created default conversations use the friendly “Let's discuss
  anything” title, while later user renames remain authoritative across resume
  and sidebar reconciliation.
- Growing the composer no longer exposes an obsolete scroll position or lets
  Chromium briefly replay cached Markdown lines. Tail-following stays anchored
  while an intentional scroll upward remains untouched.

## [0.3.10] - 2026-07-30

### Added

- A persistent default conversation can now be selected from General Settings
  or directly from the current conversation menu.
- The tray can start and stop a headless Realtime voice session. It reuses the
  default conversation for context, creates one in the home folder when needed,
  and reports native lifecycle failures without opening the main window.

### Changed

- Opening the app during a tray-launched Realtime session now selects its
  persistent parent, restores the transcript accumulated while hidden and
  continues streaming voice messages directly in the chat.
- The default conversation is promoted to a compact dedicated sidebar section
  above recent projects instead of being duplicated inside its workspace.
- Scheduled wake-up cards now start collapsed and reveal their full Markdown
  instructions only when requested, keeping long scheduler prompts compact.

## [0.3.9] - 2026-07-29

### Changed

- App Server and the app-owned Playwright MCP client now receive the actual
  desktop package version instead of stale independently hard-coded versions.
- Production packages no longer include Electron-layer test sources, and their
  renderer, favicon and bundled-skill inventory is protected by a manifest
  contract.
- Public contribution templates now collect actionable environment, protocol
  and validation details without duplicating the contributor guide.

### Fixed

- Disconnecting while the scheduled-task listener is still attaching no longer
  re-arms native delivery after the listener has already been removed.
- The global Config and AGENTS.md editors now keep keyboard focus inside their
  modal and return it to the settings card when closed.
- Unchanged background-terminal polls no longer trigger conversation-wide
  rerenders while an agent turn is streaming.
- The native App Server boundary now rejects malformed, batched or multiline
  renderer commands before any bytes reach the NDJSON transport.
- A delayed goal update from a previously selected thread can no longer block,
  overwrite or unlock goal controls in the current thread.
- Unattended scheduled tasks now confirm a no-op security restoration by
  reading the effective thread settings instead of reporting a false timeout.

## [0.3.8] - 2026-07-29

### Fixed

- A native App Server health check now detects an unresponsive stdio transport
  after prolonged idle time or system resume instead of leaving the interface
  in a false connected state.
- Confirmed stale transports restart automatically, restore the renderer
  subscriptions and catalogs, and resume the active conversation.
- Scheduled work pauses while App Server is unavailable and catches up only
  after the renderer has reattached its delivery listener.
- The hidden tray window keeps processing App Server, remote-control and
  scheduler events instead of being throttled as an ordinary background page.

## [0.3.7] - 2026-07-29

### Changed

- Markdown tables now use bordered, scrollable surfaces with visible cell
  separators and preserve GFM column alignment.
- Headings, nested and task lists, blockquotes, separators, strikethrough,
  links and inline images now share a complete light/dark chat treatment.
- Inline Markdown images load lazily without sending the conversation page as
  their referrer.

## [0.3.6] - 2026-07-29

### Changed

- Assistant messages now render GFM Markdown and stable LaTeX progressively
  while streaming instead of switching from mostly raw text only at
  completion.
- Rapid deltas are coalesced into interruptible render updates to keep the
  conversation fluid, and the redundant streaming-only KaTeX path has been
  removed.
- Progressive Markdown now refreshes at roughly 30 frames per second and uses
  Chromium's input-aware task scheduler, preserving keyboard responsiveness
  while the agent streams.
- Tool activity now forms a continuous visual wave: a stable group summary is
  present from the first call, action headers stay fixed while their details
  collapse, and excess older rows leave before new calls appear.
- Silent agent steps keep using the same activity group, while intervening
  non-action items and assistant text create deliberate group boundaries.
- Empty agent-message and reasoning placeholders emitted between tool-only
  steps no longer create invisible boundaries or duplicate one-action groups,
  including after thread replay. A reasoning boundary is created only when a
  visible summary actually arrives.
- Settings > Chat can retain from one to six recent action rows per group.
- Long-running commands reported by App Server as background terminals now
  collapse without waiting for process exit, so later browser and tool calls
  remain synchronized with their actual execution.

## [0.3.5] - 2026-07-29

### Added

- The repository is now explicitly distributed under the MIT License.

### Changed

- Settings navigation, global sections, agent defaults, permissions and
  scheduled-task editing now have focused component owners instead of sharing
  one large view module.
- Scheduled-task styles are colocated with the feature while preserving the
  established light and dark appearance at desktop and narrow window sizes.
- Installation examples now point to the current package version.

## [0.3.4] - 2026-07-29

### Added

- App-resident scheduled tasks for one-time, interval, daily, weekday and
  weekly wake-ups targeting an existing, new persistent or new ephemeral
  conversation.
- A bounded App Server dynamic-tool namespace lets Codex list, create, update,
  pause, resume and run scheduled tasks from chat; deletion remains explicitly
  confirmed in the desktop interface.
- Optional unattended execution can apply Full access with Never ask for one
  scheduled run, with a clear warning and authoritative restoration of the
  thread's previous security settings afterward.

### Changed

- Scheduled turns carry a persistent scheduler envelope and render as distinct
  wake-up cards in live chat and replay.
- App-owned user turns, reviews, compactions and scheduled work are serialized
  per target thread, while work in different conversations remains parallel.
- Background notifications update their owning thread without leaking activity
  into the conversation currently being viewed.

### Fixed

- A wake-up targeting an active conversation waits instead of being interpreted
  by App Server as steering for the current turn.
- Security restoration now waits for the authoritative
  `thread/settings/updated` notification before another queued turn can start.
- Running scheduled tasks cannot be deleted mid-execution, and the agent-facing
  interval schema now matches the native five-minute to seven-day limits.

## [0.3.3] - 2026-07-28

### Added

- Guided global Codex settings now cover default model, personality,
  permissions, approvals, authentication stores, project-document limits,
  compaction thresholds, and other supported `config.toml` values.
- The session bar now groups permissions and approval policy in one Security
  popover, while model, reasoning effort, and Plan mode share the model
  popover.

### Changed

- Settings sections now contain persistent global preferences only; current
  session controls remain next to the composer.
- A saved global personality remains editable and is applied to future
  compatible sessions, but is omitted from requests when the selected model
  explicitly does not support personalities.
- Reusable round icon controls and light-theme settings surfaces now share a
  consistent accessible visual treatment.
- The public README now uses a deterministic English showcase in both light and
  dark themes.
- Historical interface captures were removed from the current tree in favor of
  two maintained showcase images; previous checkpoints remain in Git history.

### Fixed

- Dictated text is consumed exactly once and no longer reappears in the
  composer after the message has been sent.
- Opening a web link now renews an expired app-owned Playwright MCP session
  instead of failing with `Session not found` when no agent browser session is
  active, and keeps its event channel alive so Chromium remains open after
  navigation.
- Shared-browser shutdown now signals the managed MCP child before Electron can
  exit, and a subsequent instance removes only a verified app-owned stale
  server instead of falling back because port `8931` remains occupied.

## [0.3.2] - 2026-07-27

### Added

- Recent conversations are grouped into accessible collapsible workspaces, with
  the active workspace opened automatically and global search exposing every
  matching group.

### Changed

- Context compaction now relies on the turn-level progress indicator while it
  runs, then leaves only a quiet non-expandable completion marker in the chat.
- The empty conversation composition is centered against the usable chat
  viewport at both desktop and compact window sizes.
- The light theme uses a warm anthracite reader ink for primary text, inputs,
  active controls, and both Codex marks instead of near-black foregrounds.

### Fixed

- Workspace expansion remains deterministic across thread selection, manual
  navigation, and search without losing archive, delete, running, or error
  actions.
- The welcome logo and copy no longer drift upward when the composer reserve
  changes.

## [0.3.1] - 2026-07-27

### Changed

- Conversation items now share a consistent agent column while the compact
  Plan remains visually distinct.
- Inter-turn and completed-action spacing is tighter without sacrificing the
  separation between user, agent, and technical activity.
- Long Markdown paragraphs can use justified typography with automatic
  hyphenation; short replies retain natural alignment.
- Active Plan progress is denser and sits immediately above the composer,
  leaving more of the current stream visible.

### Fixed

- Long persisted threads remain anchored to their latest content while lazy
  Markdown, images, and other deferred layouts settle.
- Intentional upward scrolling reliably suspends automatic bottom following
  without confusing browser layout shifts for user input.
- Plan spinners are correctly sized and vertically aligned, and no longer
  trigger a flickering scrollbar on hover.

## [0.3.0] - 2026-07-27

### Added

- App-scoped `use-shared-browser` skill that routes browser tasks to the
  managed Playwright session without changing user or workspace skills.
- Explicit skill selection from the composer's add menu, with structured App
  Server input and discreet replayable markers in the conversation.
- Dedicated Web Browser settings for activation, versions, connection state,
  repair, cancellation, and disable flows.

### Changed

- Browser and Computer Use surfaces unsupported by this client are disabled
  only for its App Server process, keeping the CLI and other Codex clients
  untouched.
- Shared-browser activation now configures matched app-owned Playwright
  components and keeps the system browser as a clear fallback.
- App Server notification parsing and effective thread behavior ownership were
  extracted from the page coordinator into focused, tested modules.
- Contributor documentation and curated browser/skill screenshots now describe
  the consolidated community-beta workflow.

### Fixed

- Late remote-control device responses can no longer repopulate a disabled or
  superseded environment.
- Permission and approval display fallbacks can no longer become accidental
  explicit overrides when starting a thread.

## [0.2.6] - 2026-07-26

### Added

- Opt-in shared Chromium browser powered by app-pinned Playwright and
  Playwright MCP versions.
- One guided activation downloads the matching private browser, creates a
  persistent profile, configures Codex MCP and verifies the local connection.
- Application links and Codex browser tools operate in the same visible
  Playwright context.
- Repair, cancellation, startup recovery and system-browser fallback states.

### Changed

- Codex Desktop no longer assumes or installs a system Chromium package.
- Playwright browser data is isolated under
  `~/.local/share/codex-desktop/`.

## [0.2.5] - 2026-07-26

### Added

- Dedicated experimental Remote Control settings backed entirely by App
  Server, with persistent relay state, temporary ChatGPT pairing codes,
  authorized-device inventory, and guarded revocation.
- Guarded global `AGENTS.md` editing alongside `config.toml` in Config.

### Changed

- Config documents now open in focused modal editors instead of occupying the
  settings page permanently.
- Remote Control, Config, and compact settings layouts now remain contained at
  the supported desktop and minimum window sizes.

### Fixed

- Launch at login now uses a validated XDG autostart entry and safely replaces
  the retired desktop entry.
- App Server startup preserves access to the discovered Codex executable and
  its neighboring runtime.

## [0.2.4] - 2026-07-26

### Added

- Global settings for web search, response verbosity, plan reasoning effort,
  reasoning-summary style, preferred file opener, and Codex memory.
- Controls to reload the current thread or restart App Server when a
  configuration change cannot be applied live.
- Structured memory citations in conversations.
- Purpose-built Markdown link routing:
  - web links open in managed Chromium with a system-browser fallback;
  - UTF-8 files open in the configured editor, including line and column;
  - non-UTF-8 and binary files use the operating system's default application;
  - directories open in the system file explorer;
  - relative paths resolve from the workspace and explicit absolute paths are
    supported.

### Changed

- Settings are grouped more clearly between General, Agent and models,
  Options, and Memory.
- App Server capability coverage and contributor handoff documentation now
  reflect the current implementation.

### Fixed

- Session reload and App Server restart now reject pending requests cleanly
  instead of leaving stale interface state.
- Memory and global configuration controls expose loading, unavailable, error,
  and confirmation states.

## [0.2.3] - 2026-07-26

### Added

- Global Codex configuration editor and workspace `AGENTS.md` editor.
- Thread goals, thread reload actions, approval controls, and expanded App
  Server capability coverage.
- Realtime voice handoff that preserves finalized voice exchanges in the parent
  thread's model context.

### Changed

- Refined conversation activity grouping, action collapse behavior, settings,
  thread menus, diff review, and Linux desktop integration.

## [0.2.2] - 2026-07-25

### Added

- Dedicated generated-image cards with persistent previews, download controls,
  and a low-padding full-screen overlay.

### Changed

- Unified application, tray, desktop, and dashboard iconography.

## [0.2.1] - 2026-07-25

### Changed

- Polished the composer, conversation timeline, action groups, plans, sidebar,
  settings, and light-theme interaction states.
- Improved streaming Markdown and LaTeX rendering, including incomplete
  formulas.

### Fixed

- Corrected action-group transitions and persistent collapsed state.
- Improved Realtime and dictation reliability on Linux.

## [0.2.0] - 2026-07-24

### Changed

- Migrated the production desktop shell from Tauri to Electron.

### Added

- Native Electron packaging for Debian/Ubuntu.
- Stable Chromium microphone capture for dictation and Realtime voice.

[0.3.16]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.15...v0.3.16
[0.3.15]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.14...v0.3.15
[0.3.14]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.13...v0.3.14
[0.3.13]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.12...v0.3.13
[0.3.12]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.11...v0.3.12
[0.3.11]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.10...v0.3.11
[0.3.10]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.9...v0.3.10
[0.3.9]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.8...v0.3.9
[0.3.8]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.7...v0.3.8
[0.3.7]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.6...v0.3.0
[0.2.6]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/47b7260...v0.2.1
[0.2.0]: https://github.com/B4PT0R/codex-desktop-b4pt0r/commit/47b7260
