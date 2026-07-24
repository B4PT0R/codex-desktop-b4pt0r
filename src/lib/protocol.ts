import type { Quota } from "../types";
import type { CollaborationMode, Personality } from "../types";
import type {
  RateLimitSnapshot,
  RateLimitWindow,
  RealtimeVoice,
} from "./appServerTypes";
import type { ExternalAgentMigrationItem } from "./appServerTypes";

export type Permission = string;
export type TurnContextItem =
  | { type: "localImage"; path: string }
  | { type: "mention"; name: string; path: string };

export function threadStartParams(
  cwd: string | undefined,
  model: string,
  permission?: Permission,
  personality: Personality = "pragmatic",
) {
  return {
    ...(cwd ? { cwd } : {}),
    model,
    ...(permission ? { permissions: permission } : {}),
    personality,
  };
}
export function realtimeThreadStartParams(
  cwd: string | undefined,
  model: string,
  permission?: Permission,
  personality: Personality = "pragmatic",
) {
  return {
    ...threadStartParams(cwd, model, permission, personality),
    ephemeral: true,
  };
}
export function configReadParams(cwd?: string) {
  return { cwd: cwd ?? null, includeLayers: false };
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
    personality: behavior?.personality,
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
    includeStartupContext: false,
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
export function threadCwdUpdateParams(threadId: string, cwd: string) {
  return { threadId, cwd };
}
export function threadArchiveParams(threadId: string) {
  return { threadId };
}
export function threadDeleteParams(threadId: string) {
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
  personality: Personality,
  mode: CollaborationMode,
  permission: Permission,
) {
  return {
    threadId,
    model,
    effort,
    personality,
    permissions: permission,
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
