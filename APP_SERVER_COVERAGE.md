# App Server v2 coverage

## Authoritative snapshot

This inventory was refreshed on 2026-08-03 against:

- installed `codex-cli 0.146.0`;
- its generated stable and experimental v2 JSON schemas;
- official Codex tag `rust-v0.146.0` (`be449751a`);
- `codex-rs/app-server-protocol/src/protocol/common.rs`;
- `codex-rs/app-server/README.md`.

The installed schemas expose:

| Surface              | Stable | With experimental API |
| -------------------- | -----: | --------------------: |
| Client requests      |     90 |                   127 |
| Server requests      |     10 |                    11 |
| Server notifications |     70 |                    70 |

The desktop client opts into `capabilities.experimentalApi`. It emits 67 product
request methods in addition to the one-shot `initialize` handshake:

- 47 are stable;
- 20 are experimental;
- every request shape added or changed by this client is checked against the
  installed schema in the contract suite.

It explicitly interprets 56 of the 70 notification method names and answers 7
of the 11 server-request methods. Unknown additive notifications remain
forward-compatible and do not crash the session. Counts are useful audit
checkpoints, not product targets: App Server deliberately includes host,
filesystem, process and compatibility primitives that should not become generic
buttons.

The 0.146 schema change is additive for every method emitted or interpreted by
the client. It adds thread pinning, external-import history recording and
optional capability/configuration metadata; the only removed experimental field
is `AppMetadata.firstPartyType`, which the client never consumed. No protocol
adaptation is required for the current product surface.

## Feature coverage

| Product domain                | App Server surface used                                                                                        | Coverage                                                  | Maturity and notes                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection and lifecycle      | `initialize`, process exit/reconnect, one-shot initialized state                                               | Complete                                                  | Stable transport over stdio. The initialized client identity uses the package version injected at build time; the app-owned Playwright MCP client receives the same Electron release version. Experimental WebSocket hosting is intentionally not used.                                                                                                                                                                         |
| Thread creation and hydration | `thread/start`, `thread/resume`, `thread/read`, paginated `thread/list`, `thread/turns/list`, `config/read`           | Complete for the desktop workflow                         | The sidebar consumes the complete interactive thread catalog with cursor-loop protection and refreshes it when the window regains focus so chats created by Remote Control or another Codex client appear without an App Server restart; active partial turns and older turn-page loading are covered separately. At start and resume, the client reads the effective configured developer instructions for the target cwd, appends a bounded Codex Desktop identity, and supplies the result as the session's `developerInstructions`; App Server continues to discover and apply hierarchical AGENTS.md instructions separately. This avoids recording repeated per-turn application context in rollout history and lets another client resume with its own session instructions. Multiple threads may remain active in App Server: switching changes the visible event scope immediately, then `thread/resume` restores background work and the active turn before buffered notifications continue. `thread/turns/list` is experimental. Raw unloaded item APIs are not needed. |
| Scheduled tasks               | ordinary `thread/start`, `thread/resume`, `turn/start`, `thread/settings/update`; experimental `thread/start.dynamicTools`; native Electron scheduler | Complete for an app-resident scheduler                    | Scheduling and persistence are client-owned because 0.146 exposes no automation CRUD or run API. New ordinary threads register a bounded `scheduler` namespace so the agent can list, create, update, enable, disable and run tasks; deletion remains user-confirmed. Wake-ups serialize per target thread while different threads remain parallel, and carry a persistent scheduler identity in chat/replay. Tasks inherit normal security unless the user explicitly enables unattended Full access/Never ask; the prior settings are restored before that thread queue continues. |
| Thread discovery              | `thread/search`, local recent-thread grouping                                                                  | Complete                                                  | Global content search is experimental. `thread/searchOccurrences` is not exposed because ordinary search already covers the product flow.                                                                                                                                                                                                                                                                                     |
| Thread management             | rename, pin, fork, archive, unarchive, delete, compact                                                         | Complete                                                  | Pinning uses authoritative `thread/metadata/update.isPinned`; pinned conversations remain visible above project groups in the fully paginated catalog. Success, confirmation and failure are covered. Archive, unarchive and close notifications reconcile the sidebar and active session when another client changes the thread.                                                                                                                                                              |
| Turns and steering            | `turn/start`, `turn/steer`, `turn/interrupt`                                                                   | Complete                                                  | Text, images, file mentions, App mentions, collaboration, model, reasoning, personality and permission context are constructed through typed protocol helpers. Client identity is established once through the thread session instructions rather than appended to every turn. |
| Review                        | `review/start`, review-mode items, turn diffs                                                                  | Complete                                                  | Inline review activity and the structured persistent diff panel are covered.                                                                                                                                                                                                                                                                                                                                                  |
| Agent output                  | message streaming, reasoning summaries, plans, compaction, memory citations, warnings and errors               | Complete for user-facing output                           | Structured memory citations remain outside Markdown and open only through the bounded memory-file route. Replay accepts additive item timestamps and terminal turn errors already present on official `main`; raw reasoning text and upstream response events are intentionally not rendered.                                                                                                                                 |
| Tool activity                 | item lifecycle, command output, terminal interaction, file patches, MCP progress, collaboration and completed artifacts | Complete for canonical Codex tools | Spawned agents remain ordinary actions in the parent activity group. Their descendant threads are discovered through `thread/list.ancestorThreadId`, replayed with `thread/read.includeTurns`, and updated from the shared notification stream inside a bounded, thread-isolated transcript expander. Unknown item types are ignored safely. `item/fileChange/outputDelta` is not separately shown when patch updates/completion already provide the useful diff. |
| Approvals and questions       | command, file-change and permission approval requests; auto-review completion; user input; MCP elicitation; resolved-request cleanup | Complete for v2 flows | Legacy `applyPatchApproval` and `execCommandApproval` callbacks are not used by this v2 client. The `/approve` shortcut retains bounded denied auto-review actions per thread and uses the schema-backed raw-item injection path to authorize only the selected action. Its temporary notification shape is isolated in one hook. |
| Persistent goals              | `thread/goal/get`, `thread/goal/set`, `thread/goal/clear`, goal notifications                                  | Complete                                                  | Creation, update, pause/resume, progress and guarded deletion are covered.                                                                                                                                                                                                                                                                                                                                                    |
| Thread behavior               | `thread/settings/update`, `thread/settings/updated`                                                            | Complete for current controls                             | Model, effort, service tier, collaboration, personality, permission profile, approval policy and cwd changes are written. Start, resume and live notifications share one effective-state normalizer, so server state wins.                                                                                                                                                                                                    |
| Models and capability pickers | `model/list`, `collaborationMode/list`, `permissionProfile/list`                                               | Complete for current controls                             | Reasoning efforts and service tiers come from each model's advertised capabilities; unsupported tiers are never guessed. Collaboration-mode discovery is experimental. `modelProvider/capabilities/read` is not needed for the current single-provider UI.                                                                                                                                                                    |
| Global Codex defaults         | `config/read`, targeted `config/value/write`, plus bounded native `config.toml` editing                        | Complete for current product scope                        | Domain settings own global model, reasoning, personality, service tier, permissions, approval policy/reviewer and documented `agents.*` subagent defaults. Config guides less-common context/tool-output limits, project-instruction discovery, login shells and credential stores. Targeted writes preserve unrelated TOML; custom granular policies and arbitrary hand-authored keys remain owned by the raw editor.          |
| Local memories                | targeted `config/value/write`, `memory/reset`                                                                  | Experimental but usable                                   | The UI controls documented global feature/use/generation/privacy/quota settings. Reset is explicitly confirmed and uses App Server's global reset; per-thread memory mode remains deferred.                                                                                                                                                                                                                                   |
| Remote control                | `remoteControl/enable`, `remoteControl/disable`, status, pairing and client management                         | Experimental but complete for the current App Server flow | A dedicated Settings section exposes persistent relay state, temporary manual pairing codes, authorized-device pagination and guarded revocation. Managed policy, unavailable, connecting and error states are explicit. App Server remains the sole owner of relay and grant state.                                                                                                                                          |
| Skills                        | structured `skill` turn input, `skills/list`, `skills/config/write`, `skills/extraRoots/set`, `skills/changed` | Complete                                                  | Inventory, warnings, enable/disable and refresh are covered. A bounded native scaffold creates only a new personal or workspace `<slug>/SKILL.md`; App Server force-reloads and remains authoritative for whether it is valid and discoverable. Enabled skills can be attached explicitly from the composer and remain identified on replay. Implicit invocation is not claimed because App Server emits no corresponding lifecycle item. The packaged shared-browser routing skill remains a process-scoped extra root. |
| Installed plugins             | `plugin/installed`, targeted `config/value/write`                                                              | Complete for installed inventory and enablement            | Settings shows App Server's effective installed plugins, marketplace provenance, versions, load errors and administrator-disabled state. Enablement follows the official CLI path by upserting `plugins.<id>` through App Server, then refreshing dependent Skills and MCP inventory. Catalog browsing, details, install and uninstall remain deferred while their methods are explicitly development-only. |
| Hooks                         | `hooks/list`, hook-prompt items, `hook/started`, `hook/completed`                                              | Complete for current scope                                | Effective inventory, configuration warnings and a quiet runtime lifecycle are visible. Managed-only policy is explained when active.                                                                                                                                                                                                                                                                                          |
| MCP                           | `mcpServerStatus/list`, OAuth login, layered `config/read`, targeted `config/value/write`, `config/mcpServer/reload` and startup notifications | Complete for inventory/authentication/startup and guided add/remove | The tabbed addition modal covers stdio and streamable HTTP essentials plus commonly useful timeouts, inherited environment, static/environment-backed headers, tool filters and default approval. Removal is offered only when layered config confirms the server belongs to the writable base user layer; built-in, managed, system and profile-only servers remain untouched. Both paths write App Server's native config keys directly, reload MCP, then refresh authoritative inventory. Rare environment routing, custom OAuth clients/scopes/resources, required/forced-parallel flags and per-tool approval maps remain in `config.toml`. Startup state stays scoped to the current thread; generic resource/tool invocation is intentionally absent. |
| Apps/connectors               | `app/list`, `app/installed`, `app/read`, `config/read`, targeted `config/value/write`, atomic `config/batchWrite`, list updates, `$app` mentions and typed `app://` context | Complete for discovery, hosted connection handoff, global policy and tool configuration | Settings separates the connected inventory from a searchable catalog of accessible and available Apps. Cursor pagination is consumed to exhaustion under defensive loop/size bounds; source categories and an alphabetical index organize the resulting inventory. Detail views use public `app/read` tool summaries; connection opens only the App Server-provided HTTP(S) `installUrl`, then offers an explicit authoritative refresh because no `app/install` request exists. Quick activation, shared defaults and per-App/tool policy remain App Server-owned. No unsupported persistent per-thread override, installation mutation, or client-owned App state is simulated. |
| External-agent import         | detect, import, history recovery, progress and completion                                                      | Complete for Cursor and Claude Code artifacts             | Guarded, experimental-adjacent workflow isolated under Advanced settings.                                                                                                                                                                                                                                                                                                                                                     |
| File search                   | fuzzy-search session start/update/stop plus notifications                                                      | Complete                                                  | Experimental session API; cancellation, stale response protection and keyboard selection are covered.                                                                                                                                                                                                                                                                                                                         |
| Account and login             | account read, ChatGPT login/cancel/logout and login notifications                                              | Complete for Codex-managed ChatGPT auth                   | Bedrock and externally hosted token/attestation flows are intentionally outside the ordinary Linux client.                                                                                                                                                                                                                                                                                                                    |
| Usage and workspace billing   | usage, rate limits, update notifications, reset credits, workspace messages and owner nudge                    | Complete                                                  | Quota windows, reset times, guarded credit consumption and relevant workspace messages are covered. Sparse rolling rate-limit notifications merge non-null available fields into the latest full snapshot.                                                                                                                                                                                                                    |
| Realtime voice v3             | start/stop, voice list, SDP, transcript, audio/session lifecycle notifications, `thread/inject_items`, `config/read`, fork `instructionSources`, startup `initialItems` | Complete for model-context persistence | Experimental voice transport with stable raw-item injection. The client uses browser-owned WebRTC only; it does **not** claim a WebSocket fallback. Effective `developer_instructions` from the fork workspace and AGENTS.md sources attested by its response are composed in normal precedence order through a bounded native boundary, then seeded as one developer item because Codex's generated Realtime startup context intentionally excludes them. Finalized utterances are injected into the persistent parent rollout in order, including headless sessions started from the tray against the client-owned default conversation. Current resume projection omits standalone injected response items, so visual replay remains a backend gap. |
| Dictation                     | Codex OAuth transcription endpoint through the native Electron boundary                                        | Complete, indirect                                        | This is not an App Server realtime request. Capture uses WebM/Opus and the authenticated Codex backend transcription endpoint.                                                                                                                                                                                                                                                                                                |
| Background terminals          | list and terminate                                                                                             | Complete for focused inspection                           | Experimental. The list is refreshed during active turns so matching command cards can yield visually while their process and streamed output remain active. Individual termination remains available in the dedicated panel; `/stop` intentionally applies the same guarded termination request to every currently listed job. |
| Shared Playwright browser     | `config/mcpServer/reload`, `skills/extraRoots/set` after native setup                                          | Complete, native + MCP                                    | Electron owns a pinned Playwright/MCP runtime and an opt-in private Chromium download. The UI and App Server connect to the same loopback MCP server and persistent visible context; a packaged host skill routes browser work to that MCP instead of unsupported official-desktop Browser surfaces. The system browser is the fallback.                                                                                      |
| Workspace instructions        | `config/read`, thread response `instructionSources`; bounded native editing and Realtime startup read          | Complete, native                                          | `<workspace>/AGENTS.md` is edited through a single-file bounded native boundary with conflict detection and atomic replacement. Realtime combines the effective `developer_instructions` with only instruction paths attested by the App Server for its ephemeral fork; renderer input cannot nominate arbitrary files.                                                                                                      |

## Emitted request inventory

The 67 product methods currently emitted by the renderer are:

- **Threads and turns (24):** `thread/start`, `thread/resume`,
  `thread/list`, `thread/search`, `thread/turns/list`, `thread/name/set`,
  `thread/fork`, `thread/archive`, `thread/unarchive`, `thread/delete`,
  `thread/compact/start`, `thread/metadata/update`, `thread/settings/update`, `thread/inject_items`,
  `thread/shellCommand`,
  `thread/goal/get`, `thread/goal/set`, `thread/goal/clear`,
  `thread/backgroundTerminals/list`,
  `thread/backgroundTerminals/terminate`, `turn/start`, `turn/steer`,
  `turn/interrupt`, `review/start`.
- **Models, defaults and managed policy (8):** `model/list`,
  `collaborationMode/list`, `permissionProfile/list`, `config/read`,
  `config/value/write`, `config/batchWrite`, `configRequirements/read`,
  `config/mcpServer/reload`.
- **Local memory (1 experimental):** `memory/reset`.
- **Remote control (7 experimental):** `remoteControl/enable`,
  `remoteControl/disable`, `remoteControl/status/read`,
  `remoteControl/pairing/start`, `remoteControl/pairing/status`,
  `remoteControl/client/list`, `remoteControl/client/revoke`.
- **Integrations and discovery (16):** `app/list`, `app/installed`, `app/read`,
  `plugin/installed`,
  `skills/list`,
  `skills/config/write`, `skills/extraRoots/set`, `hooks/list`, `mcpServerStatus/list`,
  `mcpServer/oauth/login`, `fuzzyFileSearch/sessionStart`,
  `fuzzyFileSearch/sessionUpdate`, `fuzzyFileSearch/sessionStop`,
  `externalAgentConfig/detect`, `externalAgentConfig/import`,
  `externalAgentConfig/import/readHistories`.
- **Account and usage (9):** `account/read`, `account/usage/read`,
  `account/workspaceMessages/read`, `account/rateLimits/read`,
  `account/rateLimitResetCredit/consume`,
  `account/sendAddCreditsNudgeEmail`, `account/login/start`,
  `account/login/cancel`, `account/logout`.
- **Realtime (3):** `thread/realtime/start`, `thread/realtime/stop`,
  `thread/realtime/listVoices`.

The 20 experimental methods in that inventory are:

`collaborationMode/list`, the three `fuzzyFileSearch/session*` methods,
`thread/backgroundTerminals/list`, `thread/backgroundTerminals/terminate`,
`thread/realtime/start`, `thread/realtime/stop`,
`thread/realtime/listVoices`, `thread/search`, `thread/settings/update`, and
`thread/turns/list`, `memory/reset`, plus the seven `remoteControl/*` methods
listed above.

## Server-initiated requests

The client answers:

- `item/commandExecution/requestApproval`;
- `item/fileChange/requestApproval`;
- `item/permissions/requestApproval`;
- `item/tool/requestUserInput`;
- `mcpServer/elicitation/request`;
- experimental `item/tool/call` for the client-owned `scheduler` namespace;
- experimental `currentTime/read`.

It intentionally does not answer:

- legacy `applyPatchApproval` and `execCommandApproval`, because current v2
  flows use the typed item approval requests;
- `account/chatgptAuthTokens/refresh` and `attestation/generate`, which belong
  to externally hosted/internal authentication rather than Codex-managed login.

## Deliberately indirect or absent surfaces

| Protocol surface                                                                                    | Decision                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fs/*`, `command/exec*`, `process/*`                                                                | Host/agent primitives. User outcomes are exposed through Codex tools, artifacts and guarded shell-command flows, not a generic remote shell or file manager.                                                                            |
| `mcpServer/resource/read`, `mcpServer/tool/call`                                                    | Agentic MCP workflows already own these operations. A manual RPC console would duplicate the agent and weaken safety.                                                                                                                   |
| `thread/loaded/list`, `thread/items/list`                                                           | Resume and bounded turn pagination provide the user workflow. Loaded-process diagnostics and generic item paging remain infrastructure.                                                                                                 |
| `thread/unsubscribe`, elicitation counters                                                          | App Server lifecycle bookkeeping, not user actions.                                                                                                                                                                                     |
| `threadSection/list`, `thread.section`, `thread/list.sectionId`, `thread/metadata/update.sectionId` | The published 0.146 schema exposes thread pinning but no server-owned sections. Native section organization remains deferred until a public contract exists.                                                                            |
| App Server daemon/socket hosting                                                                    | The Unix daemon remains experimental in 0.146. Scheduler, transport and execution boundaries are separate so ownership can migrate later, but the production client keeps the proven child-process lifecycle for now.                  |
| Automation CRUD/run                                                                                 | No public App Server automation surface exists in 0.146. The native scheduler deliberately composes ordinary thread and turn methods; the chat-facing control uses the generic experimental dynamic-tool contract rather than guessing a future automation API. App-owned starts are serialized, but 0.146 has no public atomic start-if-idle primitive for excluding a simultaneous external client. |
| `thread/rollback`                                                                                   | Deprecated and intentionally excluded.                                                                                                                                                                                                  |
| Generic structured config forms                                                                    | Arbitrary hand-authored TOML remains owned by the bounded raw editor. Targeted `config/value/write` and Apps-owned `config/batchWrite` are used only for focused controls whose shapes and ownership are verified.                        |
| Marketplace/plugin share/install/uninstall                                                          | Discovery may become useful later, but official docs still mark production install/uninstall under development and explicitly prohibit production clients from calling them.                                                            |
| `experimentalFeature/*`                                                                             | Global runtime feature mutation is not an ordinary desktop preference and can violate managed requirements.                                                                                                                             |
| `thread/memoryMode/set`                                                                             | Per-thread memory controls remain experimental and are deferred until replay exposes the effective mode reliably.                                                                                                                       |
| `environment/*` and thread environment notifications                                                | Experimental remote-executor administration. Local Linux workspaces remain the supported daily flow.                                                                                                                                    |
| `feedback/upload`                                                                                   | Valuable only with explicit consent, redacted diagnostic preview and attachment controls.                                                                                                                                               |
| `windowsSandbox/*` and Windows warnings                                                             | Not applicable to the Linux package.                                                                                                                                                                                                    |
| raw responses, moderation metadata and unstable realtime items                                      | Backend/internal or unstable payloads. Ignore safely until a concrete user-facing contract exists.                                                                                                                                      |

## Prioritized compatibility work

1. **Diagnostic feedback:** design redacted export first, then optionally add
   guarded `feedback/upload`.

Environments and feature-flag mutation remain deliberately later than these
compatibility improvements. No stable App Server Git/worktree workflow exists
in this snapshot.

## Audit procedure

On every material Codex upgrade:

1. record the exact installed `codex --version` and official checkout commit;
2. generate both stable and `--experimental` JSON schemas;
3. compare client, server-request and notification method inventories;
4. classify additions as stable, experimental, internal/host primitive or
   product-relevant;
5. update typed normalization before presentation;
6. add contract coverage for every newly emitted request shape;
7. update this document and the concise compatibility note in `TODO.md`.

A new wire method is not automatically a new UI feature. Conversely, a server
notification that changes effective state may matter even when no new button is
required.
