import type { ThreadSummary } from "../types";

export function removeThread(
  threads: ThreadSummary[],
  threadId: string,
): ThreadSummary[] {
  return threads.filter((thread) => thread.id !== threadId);
}

export function restoreThread(
  threads: ThreadSummary[],
  restored: ThreadSummary,
): ThreadSummary[] {
  return [restored, ...threads.filter((thread) => thread.id !== restored.id)];
}

export function markThreadClosed(
  threads: ThreadSummary[],
  threadId: string,
): ThreadSummary[] {
  return threads.map((thread) =>
    thread.id === threadId ? { ...thread, status: "notLoaded" } : thread,
  );
}
