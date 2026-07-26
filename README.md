# Codex Desktop Linux

**A serious, Linux-first desktop client for Codex.**

Codex Desktop Linux brings the day-to-day Codex workflow to Linux in a focused
Electron application: persistent conversations, streaming agent activity,
permissions, reviews, integrations, voice, account usage, and the desktop
ergonomics expected from a long-running development tool.

![Codex Desktop Linux in its dark theme](screenshots/welcome-dark-native-1240x820.png)

> [!IMPORTANT]
> This is an independent community project. It is not an official OpenAI
> product, is not affiliated with OpenAI, and must not be presented as one.

## Built for Linux, from scratch

This project is not a rebuild, repackaging, or port of the official desktop
application. The Electron shell, React interface, native Linux integration,
state management, interaction design, and App Server protocol integration were
implemented from scratch for this project.

It does use the official `codex app-server` supplied by the installed Codex
CLI. App Server remains the source of truth for models, threads, permissions,
approvals, account state, and agent activity. The goal is to provide a
maintainable Linux client around that official backend rather than reimplement
the Codex agent itself.

The project started as a functional first draft and has since received a
deliberate reliability pass: protocol shapes are checked against the installed
App Server schema, important failure paths are covered, native boundaries are
kept narrow, and the interface is tested at both desktop and compact window
sizes.

See the [changelog](CHANGELOG.md) for user-visible changes in each release.

## What is covered

### Complete conversation workflow

- Create, resume, search, rename, fork, compact, archive, and delete threads.
- Page through long histories and follow streaming answers without losing your
  place.
- Send text, images, file mentions, connected-app mentions, and follow-up
  steering while a turn is active.
- Interrupt work safely and recover from connection or App Server failures.

### Clear agent activity

- Render Markdown, GitHub-Flavored Markdown, and LaTeX.
- Present reasoning summaries, live plans, warnings, reviews, and collaboration
  activity without overwhelming the main conversation.
- Group commands, file changes, web results, MCP calls, and other tools into
  readable progressive disclosures.
- Review structured multi-file diffs and generated media in dedicated surfaces.

### Explicit control

- Select the model, reasoning effort, personality, and collaboration mode.
- Keep permission profiles and approval policy separate and visible.
- Handle command, file-change, permission, user-question, and MCP approval
  requests.
- Inspect and edit the active workspace's `AGENTS.md` through a guarded,
  workspace-scoped editor.
- Run explicit local shell commands only after a clear host-access
  confirmation.

### Integrations and account

- Discover connected Apps and use them as structured composer mentions.
- Inspect and manage skills, MCP servers, OAuth connections, and effective
  hooks.
- Read the signed-in account, quotas, usage windows, workspace messages, and
  available reset credits.
- Enable App Server's experimental remote-control relay, create temporary
  ChatGPT pairing codes, and review or revoke authorized devices.
- Edit the official Codex `config.toml` through a bounded editor that preserves
  hand-written content and detects external changes.

### Voice and dictation

- Capture microphone dictation and insert the transcription into the composer.
- Run full-duplex Realtime voice conversations through App Server and WebRTC.
- Stream user and assistant transcripts directly into the conversation.
- Preserve finalized voice exchanges in the parent thread's model context.

Realtime is currently an experimental App Server capability and may depend on
the connected account. The current App Server can retain injected voice items
for model context without projecting all of them back as normal visual history,
so voice replay after reopening a thread remains limited by the backend.

### Linux desktop experience

- Dark, light, and system themes with several interface-size presets and finer
  keyboard scaling.
- Responsive layouts down to the configured compact window size.
- Keyboard-friendly composer menus, focus handling, and accessible dialogs.
- System tray, single-instance behavior, and optional launch at login.
- Optional shared Playwright Chromium session for browser automation and
  full-size viewing. One activation downloads the matching private browser and
  configures Playwright MCP so the app and Codex agent use the same visible
  tabs; the system browser remains the no-setup fallback.

![Realtime voice and concurrent text activity](screenshots/realtime-dual-agent-chat-preview-1240x820.png)

## Current platform scope

Linux is the primary platform. Development and packaged validation currently
focus on Ubuntu, with a Debian package produced for amd64 systems. Broader
distribution testing and additional package formats are future work.

The client follows the installed App Server rather than assuming capabilities
from model names or hard-coded Codex versions. Experimental backend features
are isolated and are expected to evolve.

## Requirements

- A recent Linux desktop environment.
- Node.js 22.12 or newer when building from source.
- An installed and authenticated `codex` CLI available in `PATH`.

The explicit `CODEX_EXECUTABLE` environment variable can point to another Codex
binary when automatic discovery is not appropriate.

## Build and install

Clone the repository, install the locked dependencies, and build the Debian
package:

```bash
npm ci
npm run electron:deb
sudo apt install ./dist/codex-desktop-linux_0.2.6_amd64.deb
```

Launch it from the desktop menu or with:

```bash
codex-desktop
```

For local development:

```bash
npm install
npm run electron:dev
```

The browser-only preview is useful for interface work, but it uses simulated
data and does not replace validation against the packaged Electron application:

```bash
npm run dev
```

## Local data and security

Codex authentication and backend configuration remain owned by the official
Codex installation. This client does not copy authentication tokens into its
own settings.

Client preferences are stored atomically in:

```text
~/.codex/codex-desktop-linux.json
```

Official Codex configuration remains in:

```text
~/.codex/config.toml
```

The renderer is sandboxed and context-isolated. Native operations are exposed
through focused IPC boundaries rather than generic filesystem or command
access. Destructive actions, host shell commands, sensitive permissions, and
system package installation require explicit confirmation.

On Ubuntu 24.04 and newer, AppArmor can interfere with the user namespaces used
by Codex sandboxing. Use the targeted setup in
[Ubuntu Bubblewrap and AppArmor](docs/ubuntu-bubblewrap-apparmor.md); do not
disable AppArmor globally.

## Verification

The routine verification matrix is:

```bash
npm run check
npm test
npm run test:electron
npm run build
```

Protocol changes are additionally checked against the schema generated by the
installed Codex binary:

```bash
npm run test:contract
```

## Contributing

Contributions should improve the existing foundations incrementally rather than
rewrite working subsystems. Start with:

- [AGENTS.md](AGENTS.md) for the contributor contract and definition of done;
- [TODO.md](TODO.md) for the current baseline and prioritized work;
- [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md) for product and interaction
  decisions;
- [APP_SERVER_COVERAGE.md](APP_SERVER_COVERAGE.md) for protocol coverage and
  intentional exclusions;
- [screenshots/README.md](screenshots/README.md) for the curated visual
  checkpoints.

The most useful contributions are focused, testable, and explicit about loading,
failure, unavailable, and recovery states—not only the successful path.
