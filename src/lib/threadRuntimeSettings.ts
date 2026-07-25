import type { ThreadRuntimeResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import type { ApprovalPolicy, Permission } from "./protocol";
import type { CollaborationMode, Personality } from "../types";

export type ThreadRuntimeSettings = {
  cwd?: string;
  model?: string;
  effort?: string;
  permission?: Permission;
  personality?: Personality;
  collaborationMode?: CollaborationMode;
  approvalPolicy?: ApprovalPolicy;
};

/**
 * Normalizes the effective settings returned by App Server after it has applied
 * persisted config, managed requirements, and thread-specific overrides.
 */
export function threadRuntimeSettings(
  response: Partial<ThreadRuntimeResponse>,
): ThreadRuntimeSettings {
  return normalizeThreadRuntimeSettings(response, response);
}

/** Normalizes the `thread/settings/updated` notification payload. */
export function threadRuntimeSettingsFromNotification(
  value: unknown,
): ThreadRuntimeSettings | undefined {
  const params = appServerRecord(value);
  const settings = appServerRecord(params?.threadSettings);
  if (!settings) return undefined;
  return normalizeThreadRuntimeSettings(settings, settings);
}

function normalizeThreadRuntimeSettings(
  value: Record<string, unknown> | Partial<ThreadRuntimeResponse>,
  cwdFallback: Record<string, unknown> | Partial<ThreadRuntimeResponse>,
): ThreadRuntimeSettings {
  const settings = value as Record<string, unknown>;
  const fallback = cwdFallback as Record<string, unknown>;
  const activePermissionProfile = appServerRecord(
    settings.activePermissionProfile,
  );
  const sandbox = appServerRecord(settings.sandboxPolicy ?? settings.sandbox);
  const collaboration = appServerRecord(settings.collaborationMode);
  const collaborationMode = appServerString(collaboration?.mode);
  const personality = appServerString(settings.personality);
  const approvalPolicy = appServerString(settings.approvalPolicy);
  return {
    cwd:
      appServerString(settings.cwd) ??
      appServerString(appServerRecord(fallback.thread)?.cwd),
    model: appServerString(settings.model),
    effort:
      appServerString(settings.effort) ??
      appServerString(settings.reasoningEffort),
    permission:
      appServerString(activePermissionProfile?.id) ??
      permissionFromSandbox(appServerString(sandbox?.type)),
    personality: isPersonality(personality) ? personality : undefined,
    collaborationMode: isCollaborationMode(collaborationMode)
      ? collaborationMode
      : undefined,
    approvalPolicy: isApprovalPolicy(approvalPolicy)
      ? approvalPolicy
      : undefined,
  };
}

function isApprovalPolicy(value?: string): value is ApprovalPolicy {
  return value === "untrusted" || value === "on-request" || value === "never";
}

function permissionFromSandbox(type?: string): Permission | undefined {
  if (type === "dangerFullAccess") return ":danger-full-access";
  if (type === "readOnly") return ":read-only";
  if (type === "workspaceWrite") return ":workspace";
  return undefined;
}

function isPersonality(value?: string): value is Personality {
  return value === "none" || value === "friendly" || value === "pragmatic";
}

function isCollaborationMode(value?: string): value is CollaborationMode {
  return value === "default" || value === "plan";
}
