# App Server v2 coverage audit

Authoritative snapshot: Codex checkout `0fb559f0f6`, 2026-07-19. The inventory was
derived from `codex-rs/app-server-protocol/src/protocol/common.rs` and checked
against `codex-rs/app-server/README.md` and the generated installed schema.

The current protocol declares 124 client requests, 9 server requests and 71
notifications. Endpoint count is not a product target: filesystem, process and
configuration primitives support user workflows without becoming generic buttons.

## Product coverage

The client directly calls 46 request methods, covering the main workflows:

- **Threads:** start, resume, list/search, paginated history, rename, fork,
  archive/unarchive/delete, compact, interrupt/steer, shell commands and persisted
  goals (read/create/update/pause/resume/clear).
- **Turns:** text, images, structured file/App mentions, collaboration and permission
  context, streaming, review, diffs and tool activity.
- **Agent interaction:** command/file/permission approvals, user questions, MCP
  elicitations, current-time responses and safe cleanup of resolved requests.
- **Models and capabilities:** model catalog, reasoning effort, personality,
  collaboration presets and named permission profiles.
- **Integrations:** skills inventory/toggle, effective hooks inventory, connected Apps,
  MCP inventory and OAuth, plus fuzzy workspace file search.
- **Account:** managed login/logout, identity, usage, quota windows, earned reset
  credits, workspace messages and owner credit nudges.
- **Realtime and long-running work:** microphone/audio Realtime and focused background
  terminal inspection/termination.

The event stream also covers the canonical turn/item lifecycle, streamed messages,
reasoning and plans, tool progress, token usage, compaction, reroutes, warnings,
connection failures and Realtime transport events. Unknown additive notifications are
ignored safely.

## Correctly indirect or deliberately absent

| Protocol surface | Decision |
| --- | --- |
| `fs/*`, `command/exec*`, `process/*` | Host/agent primitives. Exposed through Codex tools, artifact viewers and the guarded `thread/shellCommand`, not a generic remote shell/file manager. |
| `mcpServer/resource/read`, `mcpServer/tool/call` | Used by agentic MCP workflows; a generic manual RPC console would duplicate the agent and weaken safety. |
| `thread/read`, `thread/loaded/list`, `thread/items/list`, `thread/inject_items` | Resume and bounded turn pagination provide the user workflow. Raw item injection and loaded-process diagnostics are infrastructure. |
| `thread/unsubscribe`, elicitation counters | App Server lifecycle bookkeeping, not user actions. |
| `thread/metadata/update` | Only patches stored Git metadata; it is not Git/worktree management. No stable v2 worktree API exists. |
| `thread/rollback` | Deprecated; intentionally excluded. |
| `skills/extraRoots/set` | Runtime host configuration. Normal workspace skills and config-backed roots remain visible through `skills/list`. |
| `app/read`, `app/installed` | `app/list` supplies the accessible connector inventory needed by settings and mentions. |
| `item/tool/call` | Dynamic-tool callback is not advertised because this client registers no client-owned dynamic tools. |
| token refresh, attestation | Internal/external-host authentication surfaces are not advertised; Codex-managed ChatGPT login is used. |
| `windowsSandbox/*`, Windows warnings | Not applicable to this Linux client. |
| plugin/marketplace/share/install APIs | Official README marks the production-facing plugin catalog/install workflow under development and says not to call it from production clients. Keep the navigation placeholder-free until that restriction is removed. |
| environment APIs | Remote executor administration is experimental platform infrastructure; local workspace selection remains the default daily flow. |

## Remaining product opportunities

These are optional follow-ups, ordered by likely value rather than protocol order:

1. **Safety/model notices:** present `model/verification` and
   `model/safetyBuffering/updated` as calm, bounded conversation notices instead of
   silently ignoring them.
2. **Voice choice:** use experimental `thread/realtime/listVoices` to replace the
   hard-coded Realtime voice, with a small persisted selector and graceful fallback.
3. **MCP config reload:** pair an explicit `config/mcpServer/reload` action with the
   existing inventory refresh for users who edited `config.toml` externally.
4. **Managed constraints:** summarize relevant `configRequirements/read` restrictions
   inside Permissions/Hooks when enterprise policy actually supplies them.
5. **Feedback:** add a deliberately opt-in `feedback/upload` form with a clear log
   preview and attachment consent.
6. **External-agent import:** offer the stable detect/import/history workflow only in
   Advanced, with per-item preview and progress. Low frequency, so it stays late.
7. **Remote control:** wait for the experimental enable/pair/client APIs to stabilize;
   this requires a complete security-oriented device management flow.
8. **Memory controls and feature flags:** experimental and destructive/global. Do not
   expose until their user model and recovery semantics are settled.

Git/worktrees are not on this list because App Server v2 currently has no stable API
for them. Plugin installation is not on the implementation list while the official
production-client prohibition remains in force.

## Audit maintenance

Repeat this audit when the parent Codex checkout changes materially. Compare all three
macro inventories in `common.rs`, then inspect README stability notes; a new wire method
is not automatically a new UI requirement. Add contract coverage whenever this client
constructs a new request payload.
