import type { ThreadStartResponse } from "./appServerTypes";
import type { Personality } from "../types";
import {
  realtimeEphemeralThreadStartParams,
  realtimeThreadForkParams,
  type ApprovalPolicy,
  type Permission,
} from "./protocol";

type RealtimeThreadRequest = <T>(
  method: string,
  params: Record<string, unknown>,
) => Promise<T>;

type RealtimeThreadOptions = {
  parentThreadId: string;
  cwd?: string;
  model: string;
  permission?: Permission;
  personality?: Personality;
  approvalPolicy?: ApprovalPolicy;
  resolveDeveloperInstructions?: () => Promise<string | undefined>;
};

export async function createRealtimeThread(
  request: RealtimeThreadRequest,
  options: RealtimeThreadOptions,
) {
  try {
    return await request<ThreadStartResponse>(
      "thread/fork",
      realtimeThreadForkParams(
        options.parentThreadId,
        options.cwd,
        options.model,
        options.permission,
        options.approvalPolicy,
      ),
    );
  } catch (error) {
    if (!isMissingThreadRolloutError(error)) throw error;
    const developerInstructions =
      await options.resolveDeveloperInstructions?.();
    return request<ThreadStartResponse>(
      "thread/start",
      realtimeEphemeralThreadStartParams(
        options.cwd,
        options.model,
        options.permission,
        options.personality,
        options.approvalPolicy,
        developerInstructions,
      ),
    );
  }
}

export function isMissingThreadRolloutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("no rollout found for thread id");
}
