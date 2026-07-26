# Changelog

This file highlights user-visible changes in Codex Desktop Linux. The project
follows semantic versioning while the public interface is taking shape.

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

[0.2.6]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/B4PT0R/codex-desktop-b4pt0r/compare/47b7260...v0.2.1
[0.2.0]: https://github.com/B4PT0R/codex-desktop-b4pt0r/commit/47b7260
