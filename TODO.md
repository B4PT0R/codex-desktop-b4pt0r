# Codex Desktop Linux — Remaining work

Last updated: 2026-07-24

## Product state

The client now covers the normal Codex desktop loop end to end: App Server lifecycle,
thread creation/resume/search/organization, paginated chat, streaming and steering,
models and collaboration, permissions and approvals, agent questions, tool/reasoning/
plan activity, diffs and rich artifacts, files and connected Apps, MCP and skills,
hooks, account/login/usage/quotas/reset credits, Realtime audio, background processes,
guarded local shell commands, persistent goals, Chromium handoff and Linux desktop
preferences.
The current product lot is packaged as
`dist/codex-desktop-linux_0.1.0_amd64.deb` (101,568,868 bytes; SHA-256
`a9898abb275eb4e29bb485a911675be9c01feb93b0c6922e240f1d9c983a0953`).

Architecture and product decisions live in `AGENTS.md` and `UI_ARCHITECTURE.md`.
`APP_SERVER_COVERAGE.md` is the authoritative endpoint audit. The official Codex
checkout remains the protocol source of truth.

Current validation baseline: 326 frontend/unit tests across 73 files, plus 34
App Server contract cases and 18 Electron/Node tests. Strict TypeScript and the
production build pass. The main app is 426.96 kB JavaScript (126.08 kB gzip);
Markdown and offline KaTeX stay in a separate lazy 435.00 kB chunk (130.23 kB
gzip). The Debian amd64 package was rebuilt and installed locally as
`codex-desktop-linux 0.1.0` on 2026-07-24.

## Active finish pass

- [x] Polish the Electron shell after the first installed validation: remove the
      Chromium-style File/Edit/View/Window menu entirely while retaining the tray
      menu, and replace the conversation's persistent native scrollbar with a thin,
      transparent-track pill that appears only while the transcript is hovered or
      keyboard-focused. The scrollbar remains native and accessible to wheel,
      touchpad, drag and keyboard input without visually competing with the composer.
      The Playwright MCP investigation also found that its enabled `npx` command
      inherited Ubuntu's Node 18, below Playwright's Node 20 minimum. Its global
      configuration now pins Node 24 and the matching PATH; the server starts
      successfully and will be exposed to Codex after the next session restart.
- [x] Refine the live composer review: make the textarea interior transparent,
      render its icon actions as lightly bordered circles, correct the context
      gauge's native-button padding so both circles share an exact center, and
      replace the footer model shortcut with an upward-opening model/reasoning
      picker. The picker applies changes without leaving the conversation, closes
      on outside click or Escape, restores trigger focus, and remains within the
      viewport at both 1240x820 and the 840x620 minimum size.
      The permission shortcut now follows the same pattern using the capability
      catalog returned by App Server. It explains each allowed profile neutrally,
      disables unavailable profiles, persists a selection immediately on an active
      thread with rollback on failure, and shares the composer's exact bottom-left
      anchor at both reference sizes.
      The footer quota gauges are now thicker rounded pills and form one accessible
      quick control. Its bottom-right popover exposes remaining usage and localized
      reset timestamps for every window, plus the persisted reset-credit count,
      expiry, outcome/error feedback and a guarded two-step consumption action.
      The conversation's floating, trackless scrollbar is now the application-wide
      scrollbar language for settings, menus, work panels, tool output and terminals:
      thin rounded thumbs appear only on hover or keyboard focus, native end buttons
      and tracks remain hidden, and horizontal overflow receives the same treatment.
      Sidebar thread rows now expose separate archive and permanent-delete actions on
      hover/focus. Delete reuses the accessible guarded confirmation dialog and the
      existing App Server `thread/delete` flow for any selected row, while keeping
      archive as the recoverable default.
      The sidebar is resizable from 220 to 420 px through a subtle drag separator,
      keyboard arrows/Home/End, or double-click reset to 260 px. Its width is validated
      and atomically persisted in the native desktop settings file (with browser-preview
      fallback), restored on launch, and ignored while the sidebar is collapsed.
      Completed chat messages now render model-authored LaTeX through lazy-loaded,
      offline KaTeX with accessible MathML. Inline and display forms accept `$…$`,
      `$$…$$`, `\(…\)` and `\[…\]`, including single-line display delimiters;
      code examples remain literal, long equations scroll with the shared scrollbar
      style, malformed input stays visible, and streaming text remains on the cheap
      unparsed path until completion.
      Plans are now a single live progress widget anchored after the latest transcript
      content, so they update in place at the end of the conversation and scroll away
      naturally with it without covering chat content. Initial completed history stays
      hidden, and a newly completed plan contracts to a compact success state before
      fading and returning its space to the conversation flow.
      Completed reasoning now reads as a quiet expandable annotation instead of a
      full card: no surface, shadow, border, or redundant success check; compact muted
      typography and an indented detail preserve access without competing with answers.
      The localhost-only conversation preview now has a replayable live scenario instead
      of relying solely on a static fixture. Its header control safely plays, stops, and
      replays tokenized assistant text, reasoning updates, plan checkpoints, tool start/
      completion, final Markdown/LaTeX rendering, and plan dismissal without contacting
      App Server; interruption clears pending timers and all transient running states.
      Technical phases are deliberately paced over more than 15 seconds, with visible
      pauses around reasoning, plan checkpoints, tool starts and results, so animation
      and hierarchy can be reviewed rather than flashing past.
      Tool activity now follows chronological agent steps instead of the lifetime of
      a whole backend message. Parallel calls started during one step share a group;
      each completed row keeps its expanded result visible briefly, contracts with a
      transition, then the group contracts after its last action. The very first
      subsequent agent text delta immediately closes that group and creates a new
      transcript segment below, even when App Server reuses the same agent-message
      item id. The replay scenario exercises three spoken steps and two independent
      series of tool calls so this cadence is reviewable end to end. Tool notifications
      are still ingested immediately, but their rows are presented serially: each next
      action stays queued until the preceding row has finalized and fully contracted.
      Reasoning annotations are rendered before their assistant text segment, matching
      the actual event chronology instead of appearing after the streamed announcement.
      The blinking stream cursor has been removed entirely; tokenized text provides
      sufficient activity feedback without adding a persistent visual marker.
      Incoming events continue to be ingested without protocol backpressure, but a
      text segment following tools now has a bounded presentation delay derived from
      the number of queued actions. This guarantees that every completed row and its
      enclosing group finish contracting before the next streamed review appears.
- [x] Complete the production-shell migration from Tauri/WebKitGTK to
      Electron/Chromium. The user approved a full migration after the stable
      Realtime validation. The first incremental lot now provides a sandboxed,
      context-isolated Electron 43 production window with blocked navigation and
      popups, audio-only permission policy, single-instance behavior, tray/close
      semantics, App Server transport, the existing atomic
      `~/.codex/codex-desktop-linux.json` preference store, launch-at-login,
      filesystem dialogs and bounded system openers behind a narrow preload API.
      The production Realtime request now explicitly selects
      `gpt-live-1-codex`, and Electron uses Chromium `getUserMedia` instead of the
      Tauri PCM bridge. Strict TypeScript, the production frontend build, all 350
      Vitest/contract tests and all 15 Node Electron tests pass; the production
      dependency audit reports zero vulnerabilities. Electron Builder produced
      `dist/codex-desktop-linux_0.1.0_amd64.deb`, and the sandboxed unpacked app
      launches after configuring only its local `chrome-sandbox` helper as
      root:root mode 4755. The initial packaged launch exposed absolute Vite asset
      URLs under `file://`; setting the production base to `./` fixed the blank
      window. The user then validated that the complete packaged interface loads,
      connects to App Server and successfully completes a real Codex interaction.
      Native dictation/transcription and managed-Chromium commands are ported.
      Tauri dependencies, scripts and `src-tauri/` have been removed; Electron is
      the sole production shell and the contributor/operational documentation now
      reflects it. IPC trusts only the current main renderer. The package manifest
      is bounded to frontend assets, preventing recursive inclusion of previous
      `dist/linux-unpacked` output (the corrected Debian package is 97 MiB rather
      than 383 MiB). The old `codex-desktop` Tauri package was removed after the
      replacement `codex-desktop-linux` package was installed.
      Dictation is now captured directly by Chromium `MediaRecorder` as mono
      WebM/Opus at 32 kbit/s and sent through Electron's Chromium network stack
      to the existing ChatGPT OAuth transcription endpoint; using Node `fetch`
      was rejected by the perimeter with an HTML 403, while `net.fetch` succeeds.
      Managed Chromium discovery, isolated profile, bounded targets/artifacts,
      explicit privileged installation and cancellation are also ported.
      Realtime quota testing isolated a backend invariant: identical v3 sessions
      remain stable on `ephemeral: true` threads but receive the erroneous
      `You have reached your usage limit` closure on persistent threads. This was
      reproduced in both directions with the isolated probe. Production now owns
      a separate ephemeral voice-thread id without replacing the persistent text
      conversation. The user validated an uninterrupted full-app session and
      confirmed the intended v3 delegation behavior: the textual Codex agent
      answers in the chat while the voice agent orally synthesizes the delegated
      information. Strict TypeScript, 351 frontend/contract tests and 17 Electron
      Node tests pass.
- [ ] Validate an Electron shell spike before committing to a native WebRTC fallback:
      Electron 43.2.0 (Chromium 150) is installed as a development dependency using
      the existing user-local Node 24.15 runtime. Its 313 MB runtime is present,
      dynamically linked Linux libraries resolve, the Chromium SUID sandbox helper
      is configured as `root:root` mode `4755`, and `electron --version` succeeds
      without `--no-sandbox`. An isolated `app://probe` window now runs with Chromium
      sandboxing, context isolation, no renderer Node integration, a restrictive CSP,
      blocked navigation/popups and an audio-only main-frame permission policy. Its
      direct getUserMedia level meter was validated by the user as fully stable with
      the real microphone; 3 policy tests, strict TypeScript and the production
      frontend build pass. This confirms the device, Linux audio service and Chromium
      path are healthy and localizes the crash to the WebKitGTK/GStreamer path used by
      Tauri. The App Server-authenticated WebRTC v3 flow then completed successfully:
      bidirectional voice and transcription both work through the existing ChatGPT
      login without API-key exchange or separately billed Platform usage. Fix the
      probe transcript so streaming deltas are replaced by each role's finalized text
      instead of being concatenated twice. A longer user test then exposed occasional
      silent freezes. Fix an SDP notification/start-response race that could discard
      an early answer before the thread id was recorded, avoid overwriting an already
      connected status, and expose WebRTC connecting/disconnected/failed/closed states,
      data-channel closure, an eight-second disconnect threshold and a 15-second SDP
      timeout. Eleven Electron policy/protocol/session/transcript tests pass. The
      instrumented retest identified the apparent random freeze conclusively: App
      Server emits `thread/realtime/error` with `You have reached your usage limit`,
      then closes with reason `error`; Chromium's peer-reported SCTP abort is only the
      consequence of that backend closure. A fresh read-only
      `account/rateLimits/read` confirms the normal `codex` weekly bucket is only 15%
      used with no reached limit, and the multi-bucket response contains no Voice or
      Realtime bucket. Official product documentation treats ChatGPT Voice limits
      separately and only describes unlimited Voice on the $200 Pro tier; the account
      reports the lower `prolite` plan. The Realtime v3 experimental backend therefore
      enforces a separate Voice allowance. Current official Voice documentation now
      quantifies the $100 Pro tier over rolling 24-hour windows: up to 12 hours of
      GPT-Live-1 Instant, another 12 hours at Medium/High intelligence, and 24 hours
      of GPT-Live-1 mini; a single conversation may last two hours. The observed
      limit after only a short probe is therefore not explained by the documented
      tier allowance unless prior Voice use consumed it. The official Codex plan FAQ
      also says Voice caps are separate from and do not apply to Codex usage, matching
      the unaffected 15%-used weekly Codex bucket but leaving this experimental
      Codex-Voice endpoint's premature rejection inconsistent with public guidance.
      The unofficial official-app Linux port checkout at
      `~/dev/codex-desktop-linux` was fast-forwarded to upstream `1394737` and the
      current official macOS bundle (`ChatGPT-26.721.31836-arm64`) was inspected
      read-only. The official client first acquires a mono microphone stream with
      noise suppression, routes it through an `AudioWorklet` into a fresh
      `MediaStream`, creates the WebRTC offer/data channel, and only then sends
      `thread/realtime/start`. Its payload includes `includeStartupContext: false`,
      `flushTranscriptTailOnSessionEnd: true`, response-handoff controls,
      `initialItems`, `outputModality`, `realtimeSessionId`, the WebRTC SDP, the
      selected voice, and remotely configured session overrides. Those overrides
      explicitly supply both `model` and `version`; the current bundle resolves them
      from remote config key `3566525122` (schema fallback
      `gpt-live-1-boulder-alpha`/`v1`). A diagnostic branch in the Linux port also
      detects `gpt-live-1-codex` in an official bundle. Our Electron probe currently
      forces v3 but omits the model, which is now the leading explanation for landing
      in the wrong entitlement/quota path. Confirm the effective current remote-config
      value or test the Codex-specific model before treating the quota rejection as a
      plan-wide Voice limit.
      The official activation gate also waits for RPC acceptance,
      `thread/realtime/started`, WebRTC `connected`, and the data-channel
      `session.started`/`session.updated` event; adopt this state model rather than
      equating a successful start request with a usable session.
      The Electron probe now sends `gpt-live-1-codex` explicitly on v3 with the
      official startup-context, transcript-tail, initial-items, session-id and
      Codex-response handoff fields. It also implements that four-signal activation
      gate, parses session initialization from the WebRTC data channel, and no longer
      reports an SDP answer alone as an active conversation. All 12 Electron tests,
      strict TypeScript checking and the production frontend build pass. A live
      authenticated retest confirmed that the conversation remains stable and
      uninterrupted with the Codex-specific model. This isolates the former
      `You have reached your usage limit` closure to the omitted model selecting the
      wrong entitlement/quota path, rather than the account's actual Codex allowance
      or Electron/WebRTC stability. Carry the explicit model and official activation
      gate into the production implementation.
      Do not consume a Codex rate-limit reset credit for this condition. Realtime v3 is
      technically stable on the Electron path, but further endurance testing is
      Voice-quota-blocked.
      Next, surface this quota failure clearly in the production flow and decide with the
      user whether to migrate the production shell or retain Electron as an audio
      companion, then scope packaging and the Rust-native feature bridge accordingly.
- [ ] Fix native microphone authorization under WebKitGTK: handle only
      `UserMediaPermissionRequest` and `DeviceInfoPermissionRequest` for the trusted
      local main WebView, preserve default handling for unrelated web permissions,
      add native regression coverage, validate dictation with explicit user consent,
      then rebuild and reinstall the Debian package.
      The native fix, strict TypeScript check, production build, and 10 Rust tests
      pass. The 4,831,276-byte package
      (`37c6b04584d0a56bd08bd91b98699a69bee273487af1d97520b0da28131f0441`)
      was force-installed. First user validation reached the microphone, then the
      WebKitWebProcess crashed with SIGSEGV in GStreamer's `libgstinterleave.so`.
      The machine uses a mono Razer input and an 8-channel Focusrite output; dictation
      incorrectly negotiated bidirectional audio. Make dictation mono/send-only with
      no output element, cover the negotiation, rebuild, and retest explicitly.
      The regression test, strict check, and production package pass; the replacement
      4,831,284-byte package
      (`8609b129c7f67324f2f30a0486b809de197a3fe89998bf17718b527d89df8ceb`)
      was force-installed, but the same WebKit capture crash remained. Replace native
      dictation capture with a device-agnostic `parec @DEFAULT_SOURCE@` PCM stream
      bridged into a mono Web Audio MediaStream, declare `pulseaudio-utils` in the
      Ubuntu package, and keep browser `getUserMedia` only for non-native previews.
      Both native audio intents use this capture path because the crash is below the
      feature layer in WebKitGTK/GStreamer; only Realtime attaches remote audio output.
      A user retest showed no new native crash report and confirmed `parec` itself
      captures the default source (94,080 PCM bytes in a bounded two-second probe),
      but the dictation UI stalled before a Linux capture session remained active.
      Remove the remaining WebKit audio graph from native dictation entirely: stream
      the Tauri channel's PCM frames directly through Realtime WebSocket `appendAudio`.
      The revised 348-test suite, strict TypeScript, 11 native tests and Debian build
      pass; the replacement package is force-installed pending a clean restart/retest.
      The retest then reached App Server and exposed the next protocol precondition:
      official Codex marks `RealtimeConversation` under development and disabled by
      default, so threads from the desktop-owned backend lacked the capability. Launch
      only the client's private `codex app-server` with the narrow
      `features.realtime_conversation=true` override; do not mutate global config.toml.
      The installed Codex binary accepts the override, 12 native tests pass, and the
      rebuilt package is force-installed pending a complete app/backend restart.
      The next retest reached Realtime session validation and exposed an official
      version invariant: text output is supported only by Realtime v2. Keep the
      conversational waveform on v3, but construct transcription-only dictation with
      v2 plus text output; cover the split in unit and installed-schema contract tests.
      The focused protocol/audio suite, all 34 installed-schema contracts, strict
      TypeScript, 12 native tests and Debian build pass; the package is force-installed.
      The next native validation exposed that the selected v3 voice (`juniper`) is not
      in the v2 voice inventory. Dictation has text-only output, so omit its irrelevant
      voice field and let Codex choose a version-compatible v2 default; retain the
      persisted voice preference exclusively for v3 conversation audio.
      The negative payload assertion, installed-schema contracts, strict TypeScript
      and Debian build pass; the corrected package is force-installed.
      Realtime v2 then required separately billed API-key auth, so retire Realtime
      from the microphone button. Batch native PCM until the user's second click,
      encode it as compact mono WebM/Opus inside Rust (no Python, FFmpeg, libopus or
      new Linux runtime dependency), and POST multipart to the ChatGPT-authenticated
      `https://chatgpt.com/backend-api/transcribe` endpoint with the current Codex
      OAuth token and account ID read only inside the native boundary. Return only
      transcription text to React, cap capture near nine minutes and network wait at
      60 seconds, prevent duplicate completion, and expose a Transcribing state.
      The generated WebM is independently accepted by ffprobe as Opus. All 350
      frontend/contract tests and 13 native tests pass; package metadata and `ldd`
      confirm no FFmpeg, libopus, avcodec, avformat or Python runtime dependency.
      The resulting package is force-installed pending an explicit native retest.
      End-to-end Realtime v3 testing while an agent turn was active crashed again.
      Kernel evidence at 13:07:12 confirms the same `libgstinterleave.so` SIGSEGV;
      an active turn may cause a protocol refusal but cannot explain a WebProcess
      segfault. Native capture alone is insufficient because feeding it through a
      Web Audio `MediaStreamDestination` still enters WebKitGTK/GStreamer. The Codex
      auth store has no temporary Platform/Realtime key, and exchanging the ID token
      would change this to separately billed API WebSocket usage. Next implementation
      direction was initially to move the peer connection and audio graph into Rust.
      A deeper Tauri/WebKitGTK documentation audit narrows the diagnosis: Tauri/Wry
      has no Linux audio backend and delegates Web APIs to the system WebKitGTK;
      Wry 0.55.1 explicitly enables Web Audio, while the embedder must handle WebKit's
      permission-request signal (which this client does). WebKit also exposes explicit
      media-stream/WebRTC settings that should be enabled defensively, but their
      absence cannot explain this crash because capture and negotiation already begin.
      WebKitGTK itself describes WebAudio/WebRTC support as unfinished, and a current
      upstream getUserMedia crash report reproduces in WebKitGTK/GStreamer outside
      Tauri. Keep the native-WebRTC fallback as a last resort: first build a minimal
      isolated native probe using direct getUserMedia plus explicit WebKit settings,
      no Web Audio graph and no remote playback, to determine whether the system
      WebKit/GStreamer update fixes the upstream failure without growing our pipeline.
      The native bridge follows Tauri's documented split: a narrow Rust command owns
      the child process and streams binary PCM through an IPC `Channel` (the documented
      mechanism for streaming data), without exposing the shell plugin or a generic
      executable/argument surface to the WebView. All 347 frontend/contract tests,
      11 native tests, strict TypeScript, formatting and the Debian build pass. The
      resulting package declares `pulseaudio-utils` and was force-installed. A full
      application restart followed by explicit user-consented dictation remains the
      final native verification.
- [x] Make App Server thread state authoritative when hydrating session widgets:
      synchronize cwd, model, reasoning effort, and active permission profile from
      `thread/start` / `thread/resume` responses; do not overwrite restored values
      with React fallbacks; load the effective workspace `config/read` model and
      reasoning effort before a new thread, and omit an unselected permission profile
      so Codex applies its own default. Personality and collaboration mode remain
      explicit client choices because Codex 0.145 does not expose them in these
      hydration responses. Regression and installed-schema contract coverage pass.
      The rebuilt 4,833,236-byte Debian package
      (`211d2479b606f166e4a66950dbee1aa584f56bd745bdc5da50a74643dadd8b53`)
      is force-installed. Native close/reopen/resume verification on the replacement
      process confirmed that the client shows Full access and that Codex receives an
      unrestricted execution environment for the resumed thread.
- [x] Separate composer audio intents: keep the waveform button for full Realtime v3,
      reserve the microphone for transcription-only dictation, prevent both sessions
      from overlapping, inject only finalized user transcript into the draft without
      sending it, localize distinct listening/stopping/error states, cover the mode-
      specific protocol and composer behavior, and validate the two controls in browser
      preview and native WebKitGTK without silently starting a billed session during QA.
      Implementation, installed-schema contract, responsive Chromium captures, package
      build and forced local reinstall are complete. Native WebKitGTK inspection after
      restart confirmed both controls at 1240×820; QA deliberately did not activate the
      microphone or start a billed Realtime session.
- [x] Close the Realtime v3 audio lot against the installed experimental schema:
      start sessions explicitly on v3, replace the hard-coded voice with a bounded
      `thread/realtime/listVoices` inventory and persisted preference, turn the Voice
      settings placeholder into a complete loading/empty/error/ready surface, preserve
      WebRTC/WebSocket fallback behavior, harden thread-scoped lifecycle errors, add
      protocol/controller/component/native tests, and refresh browser/WebKitGTK captures.
      Native QA loaded the real catalog and verified atomic Maple→Juniper persistence;
      it deliberately did not open the microphone or start a billed Realtime session.
- [x] Cover the remaining stable Codex 0.145 migration workflow in Advanced:
      validate the installed schema, add bounded detection for home/current workspace,
      explicit Claude Code/Cursor source selection, per-item selection and confirmation,
      import progress/completion, recent history, localized failure reporting, protocol
      contracts, component and controller tests, browser/native validation, and
      refreshed screenshots. Native QA performed detection only; it imported nothing.
- [x] Refresh `APP_SERVER_COVERAGE.md` against the current official checkout after the
      migration lot, keeping post-0.145 alpha-only surfaces clearly separated.
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
- [x] Resolve the development dependency advisory by updating `fast-uri` from 3.1.3
      to 3.1.4; verify a clean npm audit, all 315 tests, strict TypeScript and the
      production frontend build.

## Nice-to-have backlog

Ordered by expected real-world value. None blocks a clean broadly capable release.

1. Add an explicit MCP configuration reload action (`config/mcpServer/reload`) next to
   inventory refresh for external `config.toml` edits.
2. Surface relevant enterprise constraints from `configRequirements/read` only when
   present, especially permission and managed-hook restrictions.
3. Add opt-in feedback upload with classification, log preview and explicit attachment
   consent.
4. Revisit remote control, memory controls and runtime feature flags only after their
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
- Run `npm run check`, `npm test -- --run`, `npm run test:electron`, and `npm run build`.
- Validate meaningful UI changes in packaged Electron. Wait at least 0.5 seconds
  before updating curated captures under `screenshots/`.

## Environment notes

- Native development uses `npm run electron:dev`; package checks use
  `npm run electron:deb`.
- Browser automation uses a separately managed open-source Chromium process, never an
  embedded general-purpose WebView. The system browser is the explicit fallback.
- The official Microsoft Playwright MCP server is configured globally in headless,
  isolated mode; Codex sessions opened after 2026-07-24 can use it directly.
- `~/dev/codex-desktop-linux-official` and `references/official-ui/2026-07-19/` are UX
  references only; do not copy bundled implementation code.
- The integrated Browser inventory may be empty; native X11 validation remains valid.
- No active blocker.
