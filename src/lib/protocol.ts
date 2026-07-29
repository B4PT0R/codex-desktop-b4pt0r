import type { Quota } from "../types";
import type { CollaborationMode, Personality } from "../types";
import type {
  RateLimitSnapshot,
  RateLimitWindow,
  RealtimeVoice,
} from "./appServerTypes";
import type { ExternalAgentMigrationItem } from "./appServerTypes";
import { schedulerDynamicTools } from "./schedulerTools";
import { scheduledTaskPrompt } from "./scheduledTaskMessage";
export { scheduledTaskPrompt } from "./scheduledTaskMessage";

export type Permission = string;
export type ApprovalPolicy = "untrusted" | "on-request" | "never";
export type WebSearchMode = "disabled" | "cached" | "indexed" | "live";
export type ReasoningSummaryMode = "auto" | "concise" | "detailed" | "none";
export type FileOpener =
  "vscode" | "vscode-insiders" | "windsurf" | "cursor" | "none";
export type ModelVerbosity = "low" | "medium" | "high";
export type PlanReasoningEffort =
  "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type TurnContextItem =
  | { type: "localImage"; path: string }
  | { type: "mention"; name: string; path: string }
  | { type: "skill"; name: string; path: string };

export function threadStartParams(
  cwd: string | undefined,
  model: string,
  permission?: Permission,
  personality?: Personality,
  approvalPolicy?: ApprovalPolicy,
) {
  return {
    ...(cwd ? { cwd } : {}),
    model,
    ...(permission ? { permissions: permission } : {}),
    ...(approvalPolicy ? { approvalPolicy } : {}),
    ...(personality ? { personality } : {}),
    dynamicTools: schedulerDynamicTools(),
  };
}
export function realtimeThreadForkParams(
  threadId: string,
  cwd: string | undefined,
  model: string,
  permission?: Permission,
  approvalPolicy?: ApprovalPolicy,
) {
  return {
    threadId,
    ...(cwd ? { cwd } : {}),
    model,
    ...(permission ? { permissions: permission } : {}),
    ...(approvalPolicy ? { approvalPolicy } : {}),
    ephemeral: true,
    excludeTurns: true,
  };
}
export function realtimeEphemeralThreadStartParams(
  cwd: string | undefined,
  model: string,
  permission?: Permission,
  personality?: Personality,
  approvalPolicy?: ApprovalPolicy,
) {
  const { dynamicTools: _dynamicTools, ...params } = threadStartParams(
    cwd,
    model,
    permission,
    personality,
    approvalPolicy,
  );
  return {
    ...params,
    ephemeral: true,
  };
}
export function automationThreadStartParams(cwd?: string, ephemeral = false) {
  return {
    ...(cwd ? { cwd } : {}),
    ...(ephemeral ? { ephemeral: true } : {}),
  };
}
export function automationThreadResumeParams(threadId: string) {
  return { threadId, excludeTurns: true };
}
export function automationTurnStartParams(
  threadId: string,
  name: string,
  prompt: string,
  unattendedAccess = false,
) {
  return {
    threadId,
    input: [{ type: "text", text: scheduledTaskPrompt(name, prompt) }],
    ...(unattendedAccess
      ? {
          permissions: ":danger-full-access",
          approvalPolicy: "never",
        }
      : {}),
  };
}
export function automationThreadSecurityRestoreParams(
  threadId: string,
  permission: Permission,
  approvalPolicy: ApprovalPolicy,
) {
  return { threadId, permissions: permission, approvalPolicy };
}

export function configReadParams(cwd?: string) {
  return { cwd: cwd ?? null, includeLayers: false };
}
export function configValueWriteParams(keyPath: string, value: unknown) {
  return { keyPath, value, mergeStrategy: "upsert" as const };
}
export function remoteControlEnableParams() {
  return {};
}
export function remoteControlDisableParams() {
  return {};
}
export function remoteControlPairingStartParams() {
  return { manualCode: true };
}
export function remoteControlPairingStatusParams(pairingCode: string) {
  return { pairingCode, manualPairingCode: null };
}
export function remoteControlClientsListParams(
  environmentId: string,
  cursor: string | null = null,
) {
  return {
    environmentId,
    cursor,
    limit: 50,
    order: "desc" as const,
  };
}
export function remoteControlClientRevokeParams(
  environmentId: string,
  clientId: string,
) {
  return { environmentId, clientId };
}
export function webSearchConfigWriteParams(mode: WebSearchMode) {
  return {
    keyPath: "web_search",
    value: mode,
    mergeStrategy: "upsert" as const,
  };
}
export function reasoningSummaryConfigWriteParams(mode: ReasoningSummaryMode) {
  return {
    keyPath: "model_reasoning_summary",
    value: mode,
    mergeStrategy: "upsert" as const,
  };
}
export function fileOpenerConfigWriteParams(opener: FileOpener) {
  return {
    keyPath: "file_opener",
    value: opener,
    mergeStrategy: "upsert" as const,
  };
}
export function modelVerbosityConfigWriteParams(verbosity: ModelVerbosity) {
  return {
    keyPath: "model_verbosity",
    value: verbosity,
    mergeStrategy: "upsert" as const,
  };
}
export function planReasoningEffortConfigWriteParams(
  effort: PlanReasoningEffort,
) {
  return {
    keyPath: "plan_mode_reasoning_effort",
    value: effort,
    mergeStrategy: "upsert" as const,
  };
}
export function turnStartParams(
  threadId: string,
  model: string,
  text: string,
  context: TurnContextItem[],
  behavior?: {
    effort?: string;
    personality?: Personality;
    mode?: CollaborationMode;
  },
) {
  const input: Array<Record<string, string>> = [];
  if (text) input.push({ type: "text", text });
  input.push(...context);
  const collaborationMode = behavior?.mode
    ? {
        mode: behavior.mode,
        settings: {
          model,
          reasoning_effort: behavior.effort ?? null,
          developer_instructions: null,
        },
      }
    : undefined;
  return {
    threadId,
    input,
    model,
    effort: behavior?.effort,
    ...(behavior?.personality ? { personality: behavior.personality } : {}),
    collaborationMode,
  };
}
export function turnSteerParams(
  threadId: string,
  expectedTurnId: string,
  text: string,
  context: TurnContextItem[],
) {
  const input: Array<Record<string, string>> = [];
  if (text) input.push({ type: "text", text });
  input.push(...context);
  return { threadId, expectedTurnId, input };
}
export function realtimeStartParams(
  threadId: string,
  transport: { type: "websocket" } | { type: "webrtc"; sdp: string },
  voice: RealtimeVoice,
  mode: "conversation" | "dictation" = "conversation",
) {
  return {
    threadId,
    outputModality: mode === "dictation" ? "text" : "audio",
    transport,
    version: mode === "dictation" ? "v2" : "v3",
    includeStartupContext: mode === "conversation",
    flushTranscriptTailOnSessionEnd: mode !== "dictation",
    ...(mode === "conversation"
      ? {
          model: "gpt-live-1-codex",
          voice,
          codexResponseHandoffPrefix: "",
          codexResponseItemPrefix: null,
          codexResponsesAsItems: false,
          initialItems: [],
          realtimeSessionId: null,
        }
      : { clientManagedHandoffs: true }),
  };
}

export function realtimeListVoicesParams() {
  return {};
}
export function threadInjectTranscriptParams(
  threadId: string,
  role: "user" | "assistant",
  text: string,
  itemId: string,
) {
  return {
    threadId,
    items: [
      {
        id: itemId,
        type: "message",
        role,
        content: [
          {
            type: role === "user" ? "input_text" : "output_text",
            text,
          },
        ],
      },
    ],
  };
}
export function threadCwdUpdateParams(threadId: string, cwd: string) {
  return { threadId, cwd };
}
export function threadArchiveParams(threadId: string) {
  return { threadId };
}
export function threadDeleteParams(threadId: string) {
  return { threadId };
}
export function threadUnsubscribeParams(threadId: string) {
  return { threadId };
}
export function threadUnarchiveParams(threadId: string) {
  return { threadId };
}
export function threadSetNameParams(threadId: string, name: string) {
  return { threadId, name };
}
export function threadCompactParams(threadId: string) {
  return { threadId };
}
export function threadShellCommandParams(threadId: string, command: string) {
  return { threadId, command };
}
export function threadForkParams(threadId: string) {
  return { threadId };
}
export function threadResumeParams(threadId: string) {
  return {
    threadId,
    initialTurnsPage: {
      limit: 30,
      sortDirection: "desc" as const,
      itemsView: "full" as const,
    },
  };
}
export function threadTurnsListParams(threadId: string, cursor: string) {
  return {
    threadId,
    cursor,
    limit: 30,
    sortDirection: "desc" as const,
    itemsView: "full" as const,
  };
}
export function skillsListParams(cwd: string, forceReload = false) {
  return {
    cwds: cwd ? [cwd] : [],
    forceReload,
  };
}
export function skillsExtraRootsSetParams(root: string) {
  return { extraRoots: [root] };
}
export function hooksListParams(cwd: string) {
  return { cwds: cwd ? [cwd] : [] };
}
export function skillsConfigWriteParams(path: string, enabled: boolean) {
  return { path, name: null, enabled };
}
export function mcpServerStatusListParams(threadId?: string, cursor?: string) {
  return {
    cursor: cursor ?? null,
    limit: 100,
    detail: "toolsAndAuthOnly" as const,
    threadId: threadId ?? null,
  };
}
export function mcpServerOauthLoginParams(name: string, threadId?: string) {
  return {
    name,
    threadId: threadId ?? null,
    scopes: null,
    timeoutSecs: null,
  };
}
export function permissionProfileListParams(cwd: string, cursor?: string) {
  return { cursor: cursor ?? null, limit: 100, cwd: cwd || null };
}
export function accountReadParams() {
  return { refreshToken: false };
}

export function chatgptLoginParams() {
  return {
    type: "chatgpt" as const,
    useHostedLoginSuccessPage: true,
    appBrand: "codex" as const,
  };
}

export function cancelLoginParams(loginId: string) {
  return { loginId };
}

export function consumeRateLimitResetCreditParams(
  idempotencyKey: string,
  creditId?: string,
) {
  return {
    idempotencyKey,
    creditId: creditId ?? null,
  };
}

export function creditsNudgeParams(creditType: "credits" | "usage_limit") {
  return { creditType };
}
export function collaborationModeListParams() {
  return {};
}
export function appsListParams(threadId?: string, forceRefetch = false) {
  return {
    cursor: null,
    limit: 50,
    threadId: threadId ?? null,
    forceRefetch,
  };
}

export function externalAgentDetectParams(
  cwd?: string,
  migrationSource: "claude-code" | "cursor" = "claude-code",
) {
  return {
    includeHome: true,
    cwds: cwd ? [cwd] : [],
    source: null,
    migrationSource,
  };
}

export function externalAgentImportParams(
  migrationItems: ExternalAgentMigrationItem[],
  migrationSource: "claude-code" | "cursor" = "claude-code",
) {
  return {
    migrationItems,
    source: "codex-desktop-linux",
    migrationSource,
  };
}

export function externalAgentImportHistoriesReadParams() {
  return undefined;
}
export function threadBehaviorUpdateParams(
  threadId: string,
  model: string,
  effort: string,
  personality: Personality | undefined,
  mode: CollaborationMode,
  permission: Permission,
  approvalPolicy: ApprovalPolicy,
) {
  return {
    threadId,
    model,
    effort,
    ...(personality ? { personality } : {}),
    permissions: permission,
    approvalPolicy,
    collaborationMode: {
      mode,
      settings: {
        model,
        reasoning_effort: effort,
        developer_instructions: null,
      },
    },
  };
}

export function threadPermissionUpdateParams(
  threadId: string,
  permission: Permission,
) {
  return { threadId, permissions: permission };
}

export function threadApprovalPolicyUpdateParams(
  threadId: string,
  approvalPolicy: ApprovalPolicy,
) {
  return { threadId, approvalPolicy };
}

export function backgroundTerminalsListParams(
  threadId: string,
  cursor?: string,
) {
  return { threadId, cursor: cursor ?? null, limit: 50 };
}

export function backgroundTerminalTerminateParams(
  threadId: string,
  processId: string,
) {
  return { threadId, processId };
}
export function fuzzyFileSearchSessionStartParams(
  sessionId: string,
  root: string,
) {
  return { sessionId, roots: [root] };
}
export function fuzzyFileSearchSessionUpdateParams(
  sessionId: string,
  query: string,
) {
  return { sessionId, query };
}
export function fuzzyFileSearchSessionStopParams(sessionId: string) {
  return { sessionId };
}
export function threadSearchParams(searchTerm: string, cursor?: string) {
  return {
    searchTerm,
    cursor: cursor ?? null,
    limit: 50,
    sortKey: "updated_at" as const,
    sortDirection: "desc" as const,
  };
}
export function threadGoalGetParams(threadId: string) {
  return { threadId };
}
export function threadGoalClearParams(threadId: string) {
  return { threadId };
}
export function threadGoalSaveParams(
  threadId: string,
  objective: string,
  tokenBudget: number | null,
) {
  return { threadId, objective, tokenBudget };
}
export function threadGoalStatusParams(
  threadId: string,
  status: "active" | "paused",
) {
  return { threadId, status };
}
export function quotasFromRateLimits(
  rateLimits: RateLimitSnapshot | null | undefined,
): Quota[] {
  return [rateLimits?.primary, rateLimits?.secondary]
    .filter((window): window is RateLimitWindow => window != null)
    .map((x) => ({
      used: Math.round(x.usedPercent),
      durationMinutes: x.windowDurationMins,
      resetsAt: x.resetsAt,
    }));
}
