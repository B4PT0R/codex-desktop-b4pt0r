import type { AppServerMessage } from "./codex";
import { activityFromEvent, type AgentActivity } from "./activity";
import { appServerRecord, appServerString } from "./appServerValues";
import {
  contextUsageFromValue,
  modelRerouteFromValue,
  type ContextUsage,
  type ModelReroute,
} from "./sessionTelemetry";
import { threadStatusFromValue } from "./threadLifecycle";
import {
  threadRuntimeSettingsFromNotification,
  type ThreadRuntimeSettings,
} from "./threadRuntimeSettings";
import type { ThreadSummary } from "../types";

export type ThreadNotification =
  | { type: "archived"; threadId: string }
  | { type: "closed"; threadId: string }
  | { type: "deleted"; threadId: string }
  | { type: "nameUpdated"; threadId: string; name: string | null }
  | {
      type: "settingsUpdated";
      threadId: string;
      settings: ThreadRuntimeSettings;
    }
  | {
      type: "statusChanged";
      threadId: string;
      status: NonNullable<ThreadSummary["status"]>;
    }
  | { type: "unarchived"; threadId: string };

export type TelemetryNotification =
  | { type: "clearReroute"; threadId: string }
  | { type: "contextUpdated"; threadId: string; context: ContextUsage }
  | { type: "modelRerouted"; threadId: string; reroute: ModelReroute };

export type AppNotificationRouting = {
  activity?: AgentActivity;
  clearsActivity: boolean;
  completesTurn: boolean;
  conversationEvent: boolean;
  startsTurn: boolean;
  telemetry?: TelemetryNotification;
  thread?: ThreadNotification;
  turnId?: string;
};

/**
 * Converts App Server notifications into application-level effects.
 *
 * Keep wire-format parsing here so App only coordinates the resulting product
 * state. Unknown or incomplete notifications intentionally produce no effect.
 */
export function routeAppNotification(
  message: AppServerMessage,
): AppNotificationRouting {
  const method = message.method ?? "";
  const params = appServerRecord(message.params);
  const item = appServerRecord(params?.item);
  const activity = activityFromEvent(method, appServerString(item?.type));
  const terminalError = method === "error" && params?.willRetry !== true;
  const result: AppNotificationRouting = {
    clearsActivity: terminalError,
    completesTurn: method === "turn/completed" || terminalError,
    conversationEvent: !method.startsWith("thread/realtime/"),
    startsTurn: method === "turn/started",
    ...(activity !== undefined ? { activity } : {}),
  };

  if (method === "turn/started") {
    result.turnId = appServerString(appServerRecord(params?.turn)?.id);
    const threadId = appServerString(params?.threadId);
    if (threadId) result.telemetry = { type: "clearReroute", threadId };
    return result;
  }

  if (method === "thread/name/updated") {
    const threadId = appServerString(params?.threadId);
    if (threadId) {
      result.thread = {
        type: "nameUpdated",
        threadId,
        name: appServerString(params?.threadName) ?? null,
      };
    }
    return result;
  }

  if (method === "thread/status/changed") {
    const threadId = appServerString(params?.threadId);
    const status = threadStatusFromValue(params?.status);
    if (threadId && status) {
      result.thread = { type: "statusChanged", threadId, status };
    }
    return result;
  }

  if (method === "thread/settings/updated") {
    const threadId = appServerString(params?.threadId);
    const settings = threadRuntimeSettingsFromNotification(params);
    if (threadId && settings) {
      result.thread = { type: "settingsUpdated", threadId, settings };
    }
    return result;
  }

  if (
    method === "thread/archived" ||
    method === "thread/unarchived" ||
    method === "thread/closed" ||
    method === "thread/deleted"
  ) {
    const threadId = appServerString(params?.threadId);
    if (threadId) {
      result.thread = {
        type: method.slice("thread/".length) as
          | "archived"
          | "unarchived"
          | "closed"
          | "deleted",
        threadId,
      };
    }
    return result;
  }

  if (method === "thread/tokenUsage/updated") {
    const threadId = appServerString(params?.threadId);
    const context = contextUsageFromValue(params?.tokenUsage);
    if (threadId && context) {
      result.telemetry = { type: "contextUpdated", threadId, context };
    }
    return result;
  }

  if (method === "model/rerouted") {
    const threadId = appServerString(params?.threadId);
    const reroute = modelRerouteFromValue(params);
    if (threadId && reroute) {
      result.telemetry = { type: "modelRerouted", threadId, reroute };
    }
  }

  return result;
}
