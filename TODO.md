# Codex Desktop Linux — Handoff

Last updated: 2026-08-01

Read `AGENTS.md` before contributing. Durable protocol and interface decisions
belong in `APP_SERVER_COVERAGE.md` and `UI_ARCHITECTURE.md`; release history
belongs in `CHANGELOG.md` and Git.

## Baseline

Codex Desktop Linux is a functional independent Electron client for the
official `codex app-server`. The current public release is v0.4.0.

The daily workflow covers conversation replay and concurrent activity,
streaming Markdown/LaTeX, reasoning, plans, tools, approvals, diffs, files,
images, permissions, models, quotas, goals, dictation, Realtime voice, global
configuration, skills, Apps, MCP, memory, remote control, scheduled tasks and a
shared Playwright Chromium session.

Compatibility is currently verified against installed `codex-cli 0.145.0`.

## Latest release

Release v0.4.0 completes the first ergonomic Extensions surface: guided MCP
server management, Apps defaults/configuration/discovery, Skills creation and a
dedicated Plugin inventory. Settings now uses a shared component hierarchy and
grouped navigation across all pages, with consistent responsive behavior and
light-theme styling. App discovery consumes the authoritative paginated App
Server catalog and remains dense enough for hundreds of entries.

## Durable constraints

- Server-hydrated thread state is authoritative. Background notifications may
  update catalogs but never the visible conversation unless their `threadId`
  matches.
- Realtime uses ephemeral voice forks and injects finalized exchanges into the
  persistent parent in order. App Server still does not replay those injected
  voice items as ordinary chat items, so the client cache is intentionally
  bounded and session-local.
- Installation, update and ordinary startup are idempotent for `config.toml`,
  desktop preferences and server-owned thread metadata.
- Scheduled turns are serialized per target thread. Unattended mode must
  restore the prior security state before releasing its queue reservation.
- The shared browser uses only the app-owned Playwright/MCP pair and managed
  open-source Chromium. Never assume a system Chromium.

## Active objective

Keep the v0.4.0 functional surface frozen while running bounded stabilization,
failure-path, simplification and maintainability passes across existing sectors.

Visual-work invariant: every frontend style or layout change starts with a real
before screenshot and ends with a comparable after screenshot at the same
viewport/theme/state. Accessibility snapshots do not replace this pair. Functional
correctness alone is insufficient: composition, ergonomics and visual harmony are
part of the acceptance criteria.

Settings header normalization: all top-level Settings pages now use
`SettingsPageHeader` for description and badge; operational inventory controls
use `SettingsControlsBar`, attached to the card or list they operate with status
on the left and compact actions on the right; global/experimental
cartouches share `SettingsPageHeaderBadge`. The primitive centrally cancels the
conversation header's inherited black divider/padding, then supplies its own
subtle theme-aware divider with symmetric 12px vertical spacing. It also owns
light/dark and narrow-window behavior. Permissions and MCP before/after
screenshots at 1164x860 and 840x620 confirm the result. MCP, Scheduled Tasks,
Apps, Skills, Hooks and Account actions now use the same compact control button
inside a content-attached controls bar instead of appearing inside the page
header; the current MCP light baseline is
kept in `screenshots/settings-mcp-light-1164x860.png`.

Settings content-card normalization: `IconCard` now owns the optional left
icon, title/subtitle hierarchy, secondary detail area, right-aligned widget slot,
row spacing and separators. Apps, Skills, MCP, Hooks, Scheduled Tasks, Account,
reset credits, Remote Control and planned integrations use it; feature CSS is
limited to domain widgets rather than rebuilding each card grid.

Settings group introductions now use `IconSubheader`: optional 19px icon,
title, optional subtitle, and no separator or card chrome. Icons are centered
against the complete title/subtitle column; light-theme titles use the shared
anthracite `#383834`. General, Memory, Permissions, Agent/Subagents, Appearance,
guided Config and Remote Control control groups use this primitive.
General now has explicit Application and Versions/Updates group introductions;
Permissions omits redundant subheader icons because its option cards already
carry them. Contextual browser-routing and Remote Control security copy instead
uses the shared `Note` blockquote-style primitive, keeping editorial guidance
distinct from control-group headings.

`CardStack` now owns joined-card composition and its optional `controlBar` slot.
General, Agent, Subagents, Permissions, service tiers, Voice and all current
integration inventories use the same outer border, radii, shadow and row
separators instead of assembling `.settings-card` wrappers locally.
Borderless trailing actions in `IconCard` remove their outer-side padding, so General's
Restart and Check for updates content aligns with version and status widgets.
Responsive `IconCard` keeps its trailing widgets in the right column and caps
that slot at two thirds of the card width. The title/subtitle column uses
single-line ellipses; narrow selects cap at 220px and obsolete MCP flex rules no
longer expand badges or squeeze alert copy into an unusable column. Version
labels no longer apply a second nested 50% cap, so their text remains intact
inside the shared trailing-widget constraint.
Voice's on-demand microphone note now uses the intended 10px tertiary treatment;
obsolete pre-`IconCard` capability-row CSS has been removed.
Memory's toggle and quota rows now use `CardStack` and `IconCard`; their trailing
widgets share one vertical axis and uniform 65px rows at the narrow reference
viewport instead of varying with wrapped legacy flex content.
The quota threshold selector uses the same shared Settings select treatment as
the other card controls; only its intentionally compact width remains local.
Settings operational notices now use one `Alert` component across Account,
Agent/Permissions, Apps, Skills, MCP, Voice, Memory, Scheduler, Hooks, Remote
Control, Configuration and Import. Preview limitations and other alerts share
Remote Control's restrained light-theme treatment instead of retaining the
legacy dark red inventory banner.
The Clear local memory action is also composed from the same primitives, including
its inline confirmation state; the bespoke reset-card border and layout are gone.
General, Updates and Memory card actions share the `RoundIconButton` primitive
rather than restart-specific CSS. Settings controls bars, Voice, MCP
authentication, Account, reset credits, Remote Control and external import use
the same primitive too. All `*Dialog` action buttons now use it with semantic
primary, secondary, tertiary or danger treatments; only whole-card interactive
surfaces remain ordinary buttons. Labeled primitive buttons centrally own their
11px type and disabled state, and obsolete local geometry/palette rules are gone.

The remaining Settings outliers now use the same composition: Agent and
Advanced Configuration file editors are actionable `IconCard` rows inside a
`CardStack`; Plugin catalog is an icon-bearing planned card; paired Remote
Control devices use the shared card layout and trailing revoke controls; the
local `This computer` row is the same primitive, with status expressed by the
shared icon column rather than a bespoke dark icon tile. Import
from Other Agents now composes discovery, selectable migration rows,
confirmation controls, result and history from `IconSubheader`, `IconCard`,
`CardStack` and `SettingsControlsBar`. Settings also resets its content scroll
when changing section so the next page heading cannot remain clipped by the
previous page position. Comparable light-theme screenshots were reviewed at
1164x860, plus the import flow at 840x620; trailing controls remain usable and
copy yields with ellipsis at the narrow viewport.

Settings hierarchy was then tightened after comparative review: Agent introduces
its primary option stack with the shared Global defaults subheader; Memory's
AGENTS.md guidance is editorial content and therefore uses `Note`; Advanced
Configuration keeps one parent subheader for its raw-file editors instead of
repeating a bespoke title, description and scope badge above every card; Import
from Other Agents starts directly with detection controls because its former
subheader only paraphrased the page header. Before/after light-theme captures at
1164x860 confirm the reduced repetition and balanced spacing.

The Settings CSS legacy sweep is complete for the normalized component lot.
Static selector-to-TSX auditing removed the obsolete `external-import-*`
implementation, pre-controls-bar integration headings and scope hint,
`settings-apply`, the retired automation main hover, their light-theme variants
and narrow-window leftovers. `settings.css` is now 1,749 lines, down by roughly
400 lines during this cleanup pass, and no literal class selector in the three
Settings stylesheets is orphaned from the source. Dynamic state classes such as
scheduled-task modality, realtime banners and tool output remain intentionally
excluded from literal matching. General, Agent, Memory, MCP and the bottom of
Advanced Configuration were captured before and after at 1164x860; the cleanup
is visually neutral across the shared primitives and representative legacy
domain widgets.

Completed current bounded lots: guided MCP add/remove and thread-scoped MCP
startup visibility.

Completed current Apps configuration lot: the global activation list now adds
runtime callable state from `app/installed`, catalog tool summaries from
`app/read`, and the documented effective `apps` policy from `config/read`.
Settings exposes shared defaults directly below the inventory through
`IconSubheader` plus the shared `CardStack` / `IconCard` rows. Changes autosave
after a short debounce; Essential / Tools remains a per-App modal and quick
activation stays on each card. Related policy changes are written
atomically with `config/batchWrite(reloadUserConfig: true)` and authoritative
views are refreshed afterwards. Cards, both modal tabs and their narrow layout
were reviewed in the live light-theme preview; the curated Apps baseline now
records the resulting inventory.

Completed Apps discovery lot: expose the non-accessible entries already returned
by `app/list` in a searchable catalog modal, without inventing an `app/install`
request that the installed protocol does not provide. Catalog cards distinguish
connected and available Apps, progressively reveal `app/read` tool metadata,
and open only the App Server-provided HTTP(S) `installUrl` through the existing
managed-browser/system-browser boundary. Returning users explicitly refresh the
authoritative `app/list` / `app/installed` state. The catalog now consumes
App Server pagination until cursor exhaustion, with repeated-cursor, 25-page and
5,000-entry safety bounds instead of truncating the alphabetical inventory at
200 entries. Search, connection state, source categories and an alphabetical
index compose before letter-grouped cards; their compact toolbar keeps search,
category and initial on one row, with category and A-Z exposed as dropdowns.
The inventory, catalog, detail and
840px layouts were reviewed in the live light-theme preview; both curated Apps
captures are current.
Catalog entries use the shared compact `IconCard` density: two-line rows retain
icons, descriptions and trailing actions while avoiding full Settings-card
height across inventories that may contain hundreds of Apps. Light-theme
`CardStack` shadows now remain at contact depth so compact stacks do not leave
grey halos around their lower corners.
Apps mutations now use synchronous per-App/per-configuration ownership sets
rather than React presentation state as an implicit lock. Same-tick duplicate
activation or autosave requests are ignored deterministically while distinct
Apps and configurations may still update concurrently.

Completed Skills creation lot: retain App Server `skills/list` and
`skills/config/write` as the discovery and activation authority, while adding a
strictly bounded Electron scaffold operation for new personal or workspace
skills. Settings will progressively collect the required name, trigger
description and Markdown instructions, create only a new
`<root>/<slug>/SKILL.md`, then force-refresh the authoritative inventory. The
flow must reject traversal, duplicates, symlinked targets and oversized content;
arbitrary file writing and optional resource editing remain outside this lot.
Skills and Plugins now have separate top-level Settings sections because a
Plugin is a bundle that may aggregate Apps, Skills and MCP integrations rather
than a subtype of Skill. Their redundant same-name subheaders were removed now
that each domain has its own page; content begins directly with its `CardStack`.
Navigation presents Apps, Skills and MCP first, then Plugins as their aggregate.
Settings navigation is grouped into Application, Agents & Capabilities,
Extensions and Advanced. Group headings are semantic and search-aware; medium
navigation rows prioritize legibility and vertical rhythm, with the navigation
pane scrolling independently whenever the complete hierarchy exceeds its height.
Hooks remains under Extensions so the existing feature stays discoverable.
The guided Essential / Instructions
modal normalizes names, explains trigger descriptions and supports personal or
workspace scope. Its native boundary rejects invalid names, duplicates,
symlinked roots/targets and oversized content before force-refreshing App Server.

Current MCP addition lot: Settings opens an Add server modal from the inventory
controls bar. It exposes the useful App Server configuration surface in
progressive Essential / Advanced tabs: transport connection first, then common
timeouts, tool filters, default approval and transport-specific environment or
header controls. Rare environment routing, custom OAuth and per-tool policy
remain in `config.toml`. Submission is a direct targeted
`config/value/write` at `mcp_servers."<name>"`, followed by MCP reload and an
authoritative inventory refresh. Duplicate visible names and malformed URLs,
environment variables, key/value lines and timeouts are rejected before write.
The final tabbed stdio and HTTP variants were reviewed in light theme at
1164x860 and the advanced local form at 840x620; its body scrolls independently
while actions remain visible.
MCP inventory cards no longer repeat the server key as a permanent monospace
third line; they stay at title/subtitle density unless a useful startup error
needs its own detail row.
Tool count, optional version, startup and authentication states now share that
single subtitle line. The trailing column contains only Sign in and conditional
Remove actions. Remove is exposed only for names found in App Server's writable
base user config layer, is explicitly confirmed, writes `null` with replace
semantics, reloads MCP and refreshes authoritative inventory. Wide and 840x620
light-theme cards plus the narrow confirmation dialog were visually reviewed.
MCP configuration mutations now share one synchronous owner across add, remove
and reload so their write/reload/refresh sequences cannot interleave. Skill
creation is single-flight, while enablement remains independently serialized per
Skill path; React state is presentation only, never the concurrency guard.

- Audited installed `codex-cli 0.145.0` schemas and official source conventions.
- Confirmed `app/list.isEnabled` plus targeted
  `config/value/write` at `apps."<id>".enabled` as the supported global flow.
- Implemented effective enabled/disabled inventory in Settings while keeping
  the composer restricted to accessible enabled Apps.
- Split Settings taxonomy into **Apps**, **Skills & Plugins**, and **MCP
  Servers**: Apps represent connected services/data, while Skills and Plugins
  share the agent-capability surface.
- Added quoted key-path construction, mutation/error state and focused unit,
  component and installed-schema contract coverage.
- Strict TypeScript, 620 deterministic frontend/unit tests, 51 installed-schema
  contracts, 114 Electron tests, production build and dependency audit pass.
- Shared-browser review passes at 1164x860 and 840x620 with enabled and disabled
  Apps; the separate Apps / Skills & Plugins / MCP navigation is readable, with
  no overflow or console error.
- MCP ready, failed, reauthentication and long-error states pass the 840x620
  shared-browser review; responsive actions no longer compress the description.
- MCP cards now reuse the Settings visual grammar: Hook-style wrapped badges,
  shared success/warning colors, a bordered secondary sign-in action and a
  compact inline error surface. Comparative MCP / Apps / Hooks / Remote Control
  screenshots were reviewed at 1164x860 and 840x620; narrow MCP metadata moves
  below the server copy instead of squeezing it.
- Final screenshot pass uses Agent and Permissions as the canonical palette:
  MCP cards and separators retain `#343431`, controls use `#41413d` and
  `#292927`, while semantic state is carried mainly by text color rather than
  stronger colored outlines. The inline error now uses the same neutral raised
  surface instead of a brown panel.
- Agent's primary Model / Effort / Personality / Verbosity labels now match
  Subagents in both themes. The light-theme override is verified in-browser at
  the same computed `rgb(56, 56, 52)` and weight 500 for both groups. Agent,
  Permissions and MCP screenshots were compared at the same 1164x860 viewport.
- Light-theme integration rows now have explicit palette coverage: App/Skill/MCP
  titles use `#33332e`, separators `#e0e0da`, and secondary copy/icons use the
  same muted grays as Agent and Permissions. The previous dark-theme values no
  longer leak into Apps; computed styles and screenshot were checked live.
- MCP inline-alert icons now explicitly set both dimensions to 12px; the Lucide
  default 24px height previously stretched the icon. Browser geometry confirms
  the icon and first text line now share the same vertical center.
- Voice capability rows now follow the Agent card separator model: one bottom
  divider per row, none on the last row. The light theme maps it to `#e0e0da`;
  this removes both the leaked dark border and the previous doubled separator.
- Voice inventory refresh now lives in the selector's own control column inside
  the Voice card. Its copy is shortened, its Lucide icon is 14x14px, and the
  borderless transparent action aligns exactly with the selector's right edge.
  Comparable before/after screenshots confirm the detached-row issue is gone.
- Packaged Electron was not rerun because the lot changes no native boundary;
  the emitted config write is covered against the installed App Server schema.
- Per-thread toggles remain intentionally absent: thread-scoped reads evaluate
  effective state, but App Server exposes no persistent thread mutation for Apps.
- MCP startup notifications are normalized and retained only for the current
  thread. Starting, ready, failed and cancelled states appear beside inventory;
  failure details are bounded and `reauthenticationRequired` reuses OAuth login.
- Startup state is cleared on thread change and MCP config reload. Unattributed
  notifications are ignored because App Server does not expose a persistent
  global startup-health snapshot.
- Plugin production calls remain deferred because App Server documents their
  current list/read/install/uninstall contract as under development and not for
  production clients.
- Next bounded integration lot: audit App Server's documented MCP configuration
  mutations and expose only a small reversible global control if the contract is
  stable; otherwise move directly to effective per-thread Apps visibility.

Remote Control enable/disable is now single-flight and participates in the same
generation ordering as status reads and pushed status notifications. A newer
notification invalidates a pending response, and disconnected transports ignore
late status pushes, preventing stale relay state from being resurrected.

Application update checks and installs now share one synchronous operation
owner. Same-tick duplicate actions are rejected before React rerenders, and a
new check cannot clear the candidate while its installation is still running.

Shared Chromium status reads, activation and deactivation now share one
synchronous lifecycle owner while cancellation remains available during an
installation. Recovery reads no longer replace the initiating operation's more
actionable error when both steps fail.

ChatGPT login now publishes its pending identity synchronously to the stable
App Server notification handler. Immediate completion can no longer be lost in
the React effect/rerender window, duplicate starts are single-flight, and a late
browser-open result cannot restore a flow that already completed or was cancelled.

External-agent detection is now scoped to the workspace that initiated it.
Changing workspace invalidates pending detection and clears its inventory;
retrying detection also removes stale items before a failure can leave them
selectable for import.

All file-backed configuration editors now use synchronous save ownership:
global/workspace AGENTS.md and raw config.toml. Repeated keyboard/button saves
cannot issue the same optimistic version twice, and reload/discard cannot
supersede a native write that is still in flight.

The destructive local-memory reset now has synchronous ownership independent
from ordinary Memory configuration writes. Repeated confirmation in one render
can issue only one `memory/reset` request.

Realtime voice discovery and persistence now have separate synchronous owners.
A late initial desktop-preference read cannot replace a newer saved choice, and
catalog refresh cannot interleave with voice persistence in the same render.

Default-thread metadata reads are now versioned by connection and selected
thread. A stale read from an earlier A → B → A selection cycle, or from before
disconnect, cannot overwrite the newer authoritative catalog entry.

## Known limitations

- Scheduled tasks require the app to remain running in the tray and the machine
  to stay awake; missed intervals are not replayed in a burst.
- A separate App Server client can still race between idle observation and
  `turn/start`; App Server 0.145 exposes no conditional start-if-idle request.
- Quitting interrupts scheduled work; closing the window preserves the hidden
  renderer and App Server.
- Linux/Ubuntu is the only regularly packaged environment. The `.deb` still
  needs a clean second-machine or VM lifecycle pass.
- The lazy Markdown/KaTeX chunk remains large, but is isolated and not a release
  blocker.

## Next bounded work

1. Exercise long-idle and suspend/resume recovery in packaged Electron with a
   scheduled task, approval gating, hidden-window delivery and Realtime active.
2. Audit another asynchronous controller outside Apps, integrations, Account,
   default-thread metadata, file-backed configuration editors, external-agent
   import, Memory, Remote Control, Voice settings, application updates and shared
   Chromium for stale responses, incomplete cancellation and recovery gaps.
3. Review large owners only where a concrete cohesive extraction removes
   mixed responsibilities; line count alone does not justify a module split.
4. Tighten outcome-oriented tests whose current assertions allow concurrency,
   cancellation or cleanup regressions to pass unnoticed.

Defer generic RPC/filesystem consoles, unstable marketplace production support
and Git/worktree management without a stable App Server product contract.

## Latest verification

- Strict TypeScript: passing.
- Settings primitive migration: 44 focused component tests across five files,
  passing; production build and full regression suite are listed below when
  rerun for the completed lot.
- Deterministic frontend/unit suite: 668 tests across 126 files, passing;
  Apps, integrations, Account, default-thread metadata, file-backed configuration
  editors, external-agent import, Memory, Remote Control, Voice settings,
  application updates and shared Chromium include focused concurrency, recovery
  and stale-response regressions.
- Installed App Server contract: 51 tests, passing against
  `codex-cli 0.145.0` (719 tests across 127 files including contract).
- Electron/Node: 117 tests, passing.
- Production Vite build: passing; main JS 660.01 kB, 189.40 kB gzip.
- Production dependency audit: zero vulnerabilities.
- `git diff --check`: passing.
- Settings primitive visual pass: Agent, Advanced Configuration, Plugin
  catalog, Remote Control and Import from Other Agents reviewed in light theme
  at 1164x860; Import also passes at 840x620. The local Remote Control card was
  recaptured after removing its bespoke dark icon tile.
- Shared-browser Apps settings preview: inventory, Essential and Tools dialogs
  pass at 1164x860 and 840x620 with no overflow or console error; stable enabled,
  disabled, callable and non-callable states are represented.
- Shared-browser Apps discovery preview: catalog search/filter, connected and
  available rows, progressive detail/tool view and hosted-connect action pass at
  1164x860 and 840x620 with no overflow or console error.
- Shared-browser MCP addition preview: essential and advanced stdio/HTTP states
  reviewed in light theme at 1164x860; the advanced form also passes at 840x620
  with an independently scrolling body, persistent actions and aligned icon/title.
- MCP inventory metadata/removal preview: wide and 840x620 layouts plus the
  confirmation dialog were reviewed in light theme. The shared modal danger
  action now uses a quiet tinted treatment with explicit hover/focus emphasis
  instead of a heavy low-contrast red fill.
- Shared-browser Skills and Plugins preview: dedicated pages without redundant
  subheaders, navigation ordered Apps → Skills → MCP Servers → Plugins, and the
  guided Essential / Instructions modal pass in light theme at 1164x860 and
  840x620 with no clipped controls or console error. Curated inventory,
  creation and Plugin captures are current.
- Shared-browser grouped Settings navigation: all four semantic groups and
  destinations fit at 1164x860 with compact shared buttons; the 840x620 layout
  scrolls the sidebar independently without clipping the page or controls.
  Search removes empty group headings and the console remains error-free.
- Debian package: built successfully as `codex-desktop-linux 0.4.0` (amd64),
  SHA-256
  `ea614d2fd169bd91fc2755fbc0f1a6023127107cb7cc74817359d29b45db2893`;
  package name, version, architecture and dependencies were inspected directly.
- Packaged Electron interaction check: the preceding Apps-catalog build was
  exercised after reinstalling v0.3.17; the version-only v0.4.0 artifact was not
  relaunched because the active App Server is coupled to this session.

Standard verification:

```bash
npm run check
npm test
npm run test:electron
npm run build
npm audit --omit=dev
```

Also run `npm run test:contract` for protocol changes, `npm run electron:dev`
for native lifecycle changes, and `npm run electron:deb` before shipping a
package.
