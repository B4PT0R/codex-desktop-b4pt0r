import type { ThreadRuntimeResponse } from "./appServerTypes";
import {
  automationThreadResumeParams,
  threadDeleteParams,
  threadSetNameParams,
  threadStartParams,
} from "./protocol";

export const DEFAULT_REALTIME_THREAD_NAME = "Let's discuss anything";

type ThreadRequest = <T>(
  method: string,
  params: Record<string, unknown>,
) => Promise<T>;

export type DefaultRealtimeThread = {
  response: ThreadRuntimeResponse;
  created: boolean;
  workspace?: string;
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
    model: string;
    createDiscussionWorkspace: () => Promise<string>;
    resolveDeveloperInstructions?: (cwd?: string) => Promise<string | undefined>;
  },
): Promise<DefaultRealtimeThread> {
  if (options.threadId) {
    try {
      const developerInstructions =
        await options.resolveDeveloperInstructions?.();
      const response = await request<ThreadRuntimeResponse>(
        "thread/resume",
        automationThreadResumeParams(options.threadId, developerInstructions),
      );
      return {
        response: await applyDefaultName(request, response, false),
        created: false,
        workspace: response.cwd ?? response.thread.cwd,
      };
    } catch (error) {
      if (!isMissingThreadError(error)) throw error;
    }
  }

  const discussionCwd = await options.createDiscussionWorkspace();
  const developerInstructions =
    await options.resolveDeveloperInstructions?.(discussionCwd);
  const response = await request<ThreadRuntimeResponse>(
    "thread/start",
    threadStartParams(
      discussionCwd,
      options.model,
      undefined,
      undefined,
      undefined,
      undefined,
      developerInstructions,
    ),
  );
  return {
    response: await applyDefaultName(request, response, true),
    created: true,
    workspace: response.cwd ?? response.thread.cwd ?? discussionCwd,
  };
}

async function applyDefaultName(
  request: ThreadRequest,
  response: ThreadRuntimeResponse,
  discardOnFailure: boolean,
) {
  if (response.thread.name?.trim()) return response;
  try {
    await request(
      "thread/name/set",
      threadSetNameParams(response.thread.id, DEFAULT_REALTIME_THREAD_NAME),
    );
  } catch (error) {
    if (!discardOnFailure) return response;
    await discardIncompleteThread(request, response.thread.id);
    throw error;
  }
  return {
    ...response,
    thread: {
      ...response.thread,
      name: DEFAULT_REALTIME_THREAD_NAME,
    },
  };
}

async function discardIncompleteThread(
  request: ThreadRequest,
  threadId: string,
) {
  try {
    await request("thread/delete", threadDeleteParams(threadId));
  } catch {
    // Preserve the naming failure, which explains why setup could not finish.
  }
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
