import type { ThreadRuntimeResponse } from "./appServerTypes";
import {
  automationThreadResumeParams,
  threadStartParams,
} from "./protocol";

type ThreadRequest = <T>(
  method: string,
  params: Record<string, unknown>,
) => Promise<T>;

export type DefaultRealtimeThread = {
  response: ThreadRuntimeResponse;
  created: boolean;
};

/**
 * Resolves the persistent parent used by tray-launched Realtime sessions.
 *
 * A configured thread is never replaced after a transient transport failure.
 * Only an authoritative missing-thread response creates a new parent.
 */
export async function resolveDefaultRealtimeThread(
  request: ThreadRequest,
  options: {
    threadId?: string;
    home: string;
    model: string;
  },
): Promise<DefaultRealtimeThread> {
  if (options.threadId) {
    try {
      return {
        response: await request<ThreadRuntimeResponse>(
          "thread/resume",
          automationThreadResumeParams(options.threadId),
        ),
        created: false,
      };
    } catch (error) {
      if (!isMissingThreadError(error)) throw error;
    }
  }

  return {
    response: await request<ThreadRuntimeResponse>(
      "thread/start",
      threadStartParams(options.home, options.model),
    ),
    created: true,
  };
}

export function isMissingThreadError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error))
    .toLocaleLowerCase();
  return (
    message.includes("no rollout found for thread id") ||
    message.includes("thread not found") ||
    message.includes("unknown thread")
  );
}
