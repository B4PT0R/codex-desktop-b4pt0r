import type { ThreadRuntimeResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import type { Permission } from "./protocol";

export type ThreadRuntimeSettings = {
  cwd?: string;
  model?: string;
  effort?: string;
  permission?: Permission;
};

/**
 * Normalizes the effective settings returned by App Server after it has applied
 * persisted config, managed requirements, and thread-specific overrides.
 */
export function threadRuntimeSettings(
  response: Partial<ThreadRuntimeResponse>,
): ThreadRuntimeSettings {
  const activePermissionProfile = appServerRecord(
    response.activePermissionProfile,
  );
  return {
    cwd: appServerString(response.cwd) ?? appServerString(response.thread?.cwd),
    model: appServerString(response.model),
    effort: appServerString(response.reasoningEffort),
    permission: appServerString(activePermissionProfile?.id),
  };
}
