# Changelog

This file highlights user-visible changes in Codex Desktop Linux. The project
follows semantic versioning while the public interface is taking shape.

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
