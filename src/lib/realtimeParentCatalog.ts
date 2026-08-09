import type { ThreadSummary } from "../types";
import type { ThreadReadResponse } from "./appServerTypes";
import { request } from "./codex";
import {
  readDesktopSettingsSnapshot,
  updateDesktopSettings,
} from "./desktopSettings";
import { threadReadParams } from "./protocol";
import { restoreThread } from "./threadReconciliation";
import { threadSummary } from "./threadSummary";

const MAX_REALTIME_PARENTS = 100;

/**
 * Temporary compatibility catalog for Realtime-only parents. App Server 0.147
 * persists injected transcript items but omits parents without ordinary turns
 * from thread/list.
 */
export async function rememberRealtimeParentThread(threadId: string) {
  const settings = await readDesktopSettingsSnapshot();
  const current = settings.realtimeParentThreadIds ?? [];
  const next = [threadId, ...current.filter((id) => id !== threadId)].slice(
    0,
    MAX_REALTIME_PARENTS,
  );
  if (next.length === current.length && next.every((id, index) => id === current[index])) {
    return next;
  }
  await updateDesktopSettings({ realtimeParentThreadIds: next });
  return next;
}

export async function readRememberedRealtimeParents() {
  const settings = await readDesktopSettingsSnapshot();
  return settings.realtimeParentThreadIds ?? [];
}

export async function hydrateRealtimeParents(threadIds: readonly string[]) {
  const summaries = await Promise.all(
    threadIds.map(async (threadId) => {
      try {
        const response = await request<ThreadReadResponse>(
          "thread/read",
          threadReadParams(threadId),
        );
        const summary = threadSummary(response.thread);
        return summary.id === threadId ? summary : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  return summaries.filter((summary): summary is ThreadSummary => Boolean(summary));
}

export function mergeRememberedRealtimeParents(
  catalog: ThreadSummary[],
  current: ThreadSummary[],
  rememberedIds: ReadonlySet<string>,
) {
  return current
    .filter(
      (thread) =>
        rememberedIds.has(thread.id) &&
        !catalog.some((candidate) => candidate.id === thread.id),
    )
    .reduce((threads, thread) => restoreThread(threads, thread), catalog);
}
