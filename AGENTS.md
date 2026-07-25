# Codex Desktop Linux — Contributor Guide

## Mission

Build a polished, reliable desktop client for Codex on Linux, using the official
`codex app-server` as its backend.

The application exists to give Linux users a first-class desktop experience
while no official Linux desktop client is available. It should feel coherent
with the official Codex product family: simple, restrained, elegant, and
purpose-built for agentic coding workflows. It is nevertheless an independent
Linux client; do not imply that it is an official OpenAI release.

The repository is already a functional first draft. Prefer improving and
extending it incrementally over rewriting working foundations. The long-term
goal is broad, ergonomic coverage of App Server capabilities, not a one-to-one
dump of every protocol field into the UI.

## Community and agent-assisted development

This project is intentionally friendly to contributors working with Codex. A
typical contributor already has a runnable `codex` binary, so the agent can
inspect the checkout, query the installed App Server schema, implement a bounded
change, run the relevant tests, and leave a verified handoff. Repository
documentation must make that workflow repeatable rather than depend on private
project history.

Treat these files as the shared memory of the project:

- `AGENTS.md` is the durable contributor contract: product principles,
  architecture, safety rules, and definition of done. Change it only when a
  lasting convention or invariant changes.
- `TODO.md` is the short operational handoff: current baseline, active objective,
  prioritized next work, known blockers, and latest verification. Rewrite stale
  content instead of accumulating a development diary.
- `APP_SERVER_COVERAGE.md` records protocol coverage and intentional exclusions.
- `UI_ARCHITECTURE.md` records durable interface structure and interaction
  decisions.
- `README.md` is the human entry point for installation and ordinary
  contribution. Keep it concise and accurate.
- Git history and releases preserve completed-lot detail; do not duplicate that
  history indefinitely in `TODO.md`.

### Starting a contribution

Before making a substantial change, the agent should:

1. Read this file and `TODO.md` completely.
2. Inspect `git status` and preserve unrelated user changes.
3. Locate the relevant owner module and its nearest tests before editing.
4. For App Server work, record the installed `codex --version`, inspect the
   generated v2 schema, and consult the official Codex source when available.
5. State the bounded objective and update `TODO.md` if it changes current
   priorities or discovers a material compatibility issue.
6. Implement the smallest coherent lot, including failure and unavailable
   states rather than only the successful path.
7. Run proportionate automated and visual checks, then leave `TODO.md` in a
   state another contributor or agent can resume without reconstructing the
   conversation.

Do not begin by broadly rewriting the application, regenerating large files, or
updating every dependency. First establish what the current backend and existing
tests actually require.

## Product principles

- Make common coding tasks obvious and fast. Reveal advanced controls only when
  they are useful.
- Present Codex activity clearly: user input, model output, reasoning summaries,
  plans, tool calls, approvals, progress, errors, and completion should each
  have an understandable visual treatment.
- Keep users in control. Permission level, workspace, model behavior, approvals,
  interruption, and destructive actions must be explicit and trustworthy.
- Prefer calm, native-feeling interaction over visual novelty. Avoid clutter,
  excessive decoration, surprising motion, and UI that competes with the work.
- Design for real project sessions: long conversations, streaming output, many
  tools, large histories, slow operations, reconnects, and partial failures.
- Treat accessibility, keyboard navigation, responsive window sizes, readable
  contrast, and clear focus states as product requirements.
- Preserve a useful browser preview where practical, but never let its mocked
  behavior hide errors in the real Electron/App Server integration.
- Do not embed a general-purpose browser as another WebView inside the Electron
  application. Browser automation should own a separate open-source Chromium
  instance (not Google Chrome or Microsoft Edge) and
  expose its state, actions, results, and recovery controls through focused client
  UI. Reuse that managed Chromium as the default full-size viewer for supported
  media (images, PDF, HTML, and similar artifacts), while keeping lightweight
  previews in the conversation. The system opener is an explicit fallback.
- Discover an existing open-source Chromium installation before launching browser
  workflows. If none exists, present the dependency and request explicit user
  confirmation before invoking any distribution package manager or privileged
  installation. Never install, elevate, or modify package sources silently; expose
  progress, failure, cancellation, and a new discovery pass after installation.
- Keep curated screenshots of this client under `screenshots/` and refresh the
  affected baselines after meaningful visual changes so they continue to reflect
  the current UI. Wait at least 0.5 seconds after changing views before capture;
  replace stale checkpoints instead of scattering temporary images at the root.

## Technical stack

- **Desktop shell:** Electron with context isolation and renderer sandboxing.
- **Native layer:** Node.js ESM in `electron/`, exposed through a narrow preload.
- **Frontend:** React 19, TypeScript in strict mode, and Vite.
- **Styling:** plain CSS, organized by feature or visual responsibility.
- **Icons:** Lucide React.
- **Rich text:** `react-markdown` with GitHub-Flavored Markdown.
- **Backend:** the installed `codex app-server`, launched as a child process and
  connected over newline-delimited JSON-RPC via stdin/stdout.
- **Tests:** Vitest, Testing Library, App Server JSON Schema contract tests, and
  Node tests for the Electron layer.

Do not introduce another framework, state-management library, design system, or
native dependency unless it solves a demonstrated need and the maintenance cost
is justified.

## Architecture and ownership

Keep boundaries explicit:

- `electron/` owns operating-system integration, process lifecycle, the secure
  IPC boundary, tray/window behavior, and transport to App Server.
- `src/lib/codex.ts` owns the frontend JSON-RPC connection and request lifecycle.
- `src/lib/protocol.ts` owns typed construction and normalization of App Server
  payloads.
- Other modules in `src/lib/` translate protocol events into product-level UI
  concepts. Keep protocol quirks out of presentation components.
- `src/components/` contains focused, reusable UI pieces.
- `src/App.tsx` coordinates application-level state and flows. Do not keep
  growing it into a monolith: extract cohesive hooks, state modules, or feature
  components as behavior becomes more complex.
- `tests/unit/`, `tests/components/`, and `tests/contract/` cover transformation
  logic, visible behavior, and compatibility with the installed App Server.

Prefer small modules with one clear responsibility and narrow public APIs. Use
domain names from App Server consistently, but introduce UI-facing models when
raw wire types would couple components to protocol details.

## App Server compatibility

App Server is the source of truth for Codex capabilities and wire formats.

- Target the current App Server v2 API. Experimental APIs must be isolated,
  clearly identified in code, and designed to fail gracefully.
- Do not guess request or notification shapes. Check the schema generated by the
  installed `codex` binary and, when available, the corresponding official
  `codex` source.
- Centralize protocol payload construction, parsing, and compatibility handling.
  Do not scatter raw method names and ad hoc `any` access throughout components.
- Prefer typed validation and explicit normalization at the protocol boundary.
  Avoid widening types merely to silence TypeScript.
- Treat unknown notification methods and additive fields as forward-compatible:
  ignore or record them safely rather than crashing the session.
- Handle lifecycle edges deliberately: startup failure, malformed output,
  process exit, pending request rejection, reconnect/restart, cancellation, and
  component unmount.
- Preserve App Server transport state across a WebView reload. The native process
  owner tracks whether the `initialized` notification has been written; the
  frontend must use that state instead of repeating the one-shot handshake. Use
  per-frontend-session string request IDs so late responses from an abandoned
  WebView cannot collide with new requests.
- Capability-driven UI is preferable to assumptions based on model names or
  hard-coded version checks.
- Every new request shape or changed payload must have a contract test when the
  generated App Server schema can cover it.

Keep compatibility work localized so a backend upgrade can be implemented and
reviewed without rewriting the interface.

### App Server upgrade playbook

When a newer Codex release changes App Server, use this sequence:

1. Update or inspect the official Codex checkout without discarding local work.
2. Generate the experimental v2 JSON schema from the exact installed binary.
3. Compare requests, responses, notifications, capability fields, and
   deprecations against `APP_SERVER_COVERAGE.md`.
4. Classify changes as additive-compatible, normalization changes, breaking
   changes, or experimental surfaces that should remain isolated.
5. Adapt types and normalization at the protocol boundary before changing UI
   components.
6. Add or update contract tests for every request shape the client emits.
7. Expose new capability-driven UI only after loading, unavailable, error,
   cancellation, and persistence behavior is understood.
8. Run the full verification matrix and update the coverage document and the
   concise compatibility note in `TODO.md`.

Prefer compatibility shims that can be removed locally later. Never scatter
version comparisons or guessed payload variants through presentation code.

## Code quality

- Keep every source file correctly scoped and cohesive. Avoid monolithic
  components, hooks, protocol modules, native modules, stylesheets, and test
  files; split by stable responsibility before a file becomes difficult to
  understand, test, or review.
- File extraction must improve ownership rather than merely move lines around.
  Keep related types, behavior, and tests close together, expose narrow APIs,
  and avoid generic dumping grounds such as oversized `utils`, `helpers`, or
  `common` modules.
- Treat rapid file growth as a design signal. When extending an already central
  file such as `src/App.tsx` or `electron/main.mjs`, prefer a focused feature
  module or component unless the change is genuinely trivial.
- Write clear, idiomatic TypeScript, React, JavaScript, and CSS. Optimize first for
  correctness and readability, then for concision.
- Keep TypeScript strict. Prefer `unknown` plus validation or narrowing over
  `any`; legacy `any` usage should not be copied into new code.
- Use descriptive types for state and protocol data. Make invalid states hard to
  represent where practical.
- Keep render functions declarative. Move non-trivial event transformation and
  asynchronous orchestration into testable modules or hooks.
- Avoid duplicated state, hidden global mutation, fragile timing assumptions,
  and fire-and-forget promises without intentional error handling.
- Do not block the UI thread with protocol parsing, large transformations, or
  synchronous native work. Keep streaming updates efficient and avoid
  unnecessary whole-tree renders.
- In Electron, return useful errors across IPC, reject malformed renderer input,
  and keep child-process ownership explicit.
- Never log secrets, tokens, full environment dumps, or sensitive workspace
  content. Do not expose arbitrary native commands through Electron IPC.
- Comment decisions and invariants, not syntax. Remove dead code instead of
  preserving speculative abstractions.
- Follow the surrounding style while improving readability. New or substantially
  edited files should be formatted normally; do not perpetuate minified
  one-line source formatting.

## UI and interaction standards

- Source all user-facing copy from typed locale packs rather than hard-coding
  labels in components or business logic. Keep French and English packs at key
  parity, persist the selected locale, and design new copy so additional locales
  can be added without changing product behavior.
- Build the interface from autonomous, cohesive components when a region has a
  distinct responsibility, state contract, interaction flow, or testing need.
  Page-level components should compose these pieces rather than contain their
  full markup and behavior inline.
- Keep component APIs explicit and product-oriented. Prefer props that describe
  intent and domain state over exposing internal setters or passing broad state
  objects. Keep local interaction state inside the component when no other
  feature needs to own it.
- Co-locate a component's focused tests and feature-specific styles or logic at
  the nearest sensible scope. Extract shared primitives only after genuine reuse
  appears; do not replace a monolith with dozens of one-line wrapper components.
- Preserve a consistent visual language across empty, loading, streaming,
  success, warning, approval, error, and disconnected states.
- Every asynchronous action needs appropriate feedback and a recoverable error
  path. Do not rely on `console.warn` as the only user-visible handling of a
  failed product action.
- Disable or guard actions that cannot safely run in the current state. Make
  duplicate submission and stale-response behavior deterministic.
- Tool and reasoning details should be progressively disclosed, while the main
  conversation remains easy to scan.
- Dangerous permissions and approvals require plain-language explanations. Do
  not use styling that pressures the user toward the permissive choice.
- Use semantic HTML and accessible names. Modals must manage focus, support the
  keyboard, and expose correct dialog semantics.
- Maintain usable layouts at the configured minimum window size and on common
  Linux scaling factors. Account for long paths, long model names, and localized
  text.
- Match established Codex interaction patterns when they are known, but adapt
  them thoughtfully to Linux desktop conventions rather than copying surfaces
  blindly.
- Keep current user-facing language consistent within a flow. Structure new
  copy so future localization does not require protocol or business-logic
  changes.

## Linux and security requirements

- Persist client-owned preferences through the native settings boundary in the
  single versioned file `~/.codex/codex-desktop-linux.json`. Keep official Codex
  backend configuration in `config.toml`; do not mix the two ownership domains.
  Native updates must be atomic, preserve unknown fields for forward compatibility,
  and avoid exposing arbitrary filesystem writes to the frontend. `localStorage`
  may only serve the browser preview and backward-compatible migration.
- Linux is the primary platform. Validate behavior in packaged Electron, not
  only the Vite browser preview.
- Prefer portable Linux behavior, and document distribution-specific packaging
  or sandbox requirements.
- Do not weaken system sandboxing globally. Keep mitigations narrow and
  documented, as with the AppArmor profile under `packaging/`.
- Treat workspace paths and image attachments as untrusted input. Do not build
  shell command strings from them.
- Preserve the explicit `CODEX_EXECUTABLE` override and robust executable
  discovery. Errors should identify what users can fix without leaking
  unrelated environment data.
- Changes to autostart, tray behavior, close semantics, permissions, file access,
  or process lifetime require Electron-layer tests where feasible and manual Electron
  verification.

## Testing and verification

The agent owns routine interface validation autonomously. During UI work, use
the configured Playwright MCP server to open the running browser preview,
exercise the affected flows, inspect accessibility snapshots and browser logs,
and review screenshots at representative window sizes. Repeat this visual loop
throughout implementation rather than waiting until the end. Cover the relevant
empty, loading, streaming, success, error, modal, and narrow-window states when
they are affected. Browser validation complements component and contract tests;
it does not replace focused packaged-Electron checks for native behavior.

Ergonomic and visual direction remains collaborative. Consult the user at
regular, meaningful checkpoints and share screenshots or clearly described
alternatives when choices affect navigation, information hierarchy, interaction
patterns, density, terminology, or the overall visual language. The agent may
resolve small consistency details autonomously, but must not silently commit to
a major subjective UX direction when several reasonable options exist. Continue
technical implementation and objective validation independently between these
checkpoints.

Add tests with the change, at the lowest useful layer:

- Pure mappings, reducers, protocol normalization, and edge cases:
  `tests/unit/`.
- User-visible component behavior and accessibility: `tests/components/` with
  Testing Library, querying by role or accessible name where possible.
- Request compatibility: `tests/contract/`, generated from the installed
  `codex app-server` schema.
- Native process, path, and lifecycle behavior: Node tests in `electron/`.

For bug fixes, add a regression test that fails for the original behavior when
practical. Test outcomes rather than implementation details. Cover unhappy paths
for connection, protocol, approval, cancellation, and persistence changes.

Run the checks relevant to every change:

```bash
npm run check
npm test
npm run build
npm run test:electron
```

Also run `npm run test:contract` for App Server request or protocol changes. It
requires an installed, runnable `codex` binary and intentionally tests against
that binary's current experimental schema.

For native UI, tray, audio, permissions, or packaging changes,
perform a focused manual check with:

```bash
npm run electron:dev
```

If a check cannot run in the current environment, state exactly which check was
skipped and why.

## Change discipline

- Treat `TODO.md` at the repository root as the living project log. Create it if
  it does not exist, read it before starting substantial work, and update it at
  meaningful checkpoints rather than only at the end of a session.
- Keep `TODO.md` actionable and current: record the active objective, verified
  findings, prioritized next work, completed items, validation performed, and
  any decisions or blockers that a future agent needs to continue safely.
- Keep `TODO.md` short enough to read completely at the beginning of every
  contribution. Summarize only recent completed work that constrains the next
  change; move durable decisions to the appropriate architecture document and
  rely on Git history for the rest.
- Update `TODO.md` whenever priorities change, a material discovery invalidates
  an assumption, a work item is completed, or a new follow-up is identified.
  Remove or rewrite stale entries instead of letting the file become an
  append-only diary.
- Keep the curated screenshots current after every meaningful interface change:
  wait at least 0.5 seconds after navigation or state changes, replace stale
  captures in `screenshots/`, and update that directory's inventory immediately
  so it describes the UI that actually exists.
- Do not use `TODO.md` as a substitute for user-facing consultation on material
  ergonomic choices or for permanent technical documentation. Keep secrets,
  credentials, and sensitive workspace data out of it.
- Keep changes focused and reviewable. Separate protocol adaptation, internal
  refactoring, and visual redesign when they can land independently.
- Preserve user work and stored conversations/settings across upgrades. Any
  persistence migration must be backward-compatible or explicitly versioned.
- Avoid unrelated formatting churn, especially while the repository is being
  normalized from its first-draft state.
- Update `README.md`, test guidance, packaging metadata, or operational docs when
  setup and user-visible behavior change.
- Do not advertise a feature as supported until its success, loading, empty,
  error, cancellation, and unavailable states are handled appropriately.

## Definition of done

A change is complete when:

1. The user-facing behavior is coherent and discoverable.
2. Protocol and native failure modes are handled without corrupting session
   state or leaving the UI stuck.
3. The implementation respects the architectural boundaries above and remains
   understandable to a future maintainer.
4. Relevant automated tests cover the behavior and compatibility surface.
5. Type checking, tests, and builds pass, or any environmental limitation is
   explicitly documented.
6. Packaged Linux/Electron behavior has been considered, not inferred solely from browser
   preview.
7. Affected interface states have been exercised and visually reviewed through
   Playwright MCP, when the browser preview can represent them.
8. Material ergonomic choices have been reviewed with the user at an appropriate
   checkpoint.
9. The change leaves a clean path for future App Server evolution.
