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
  const previous = threads.find((thread) => thread.id === restored.id);
  const reconciled =
    previous?.name && !restored.name
      ? { ...restored, name: previous.name }
      : restored;
  return [
    reconciled,
    ...threads.filter((thread) => thread.id !== restored.id),
  ];
}

export function markThreadClosed(
  threads: ThreadSummary[],
  threadId: string,
): ThreadSummary[] {
  return threads.map((thread) =>
    thread.id === threadId ? { ...thread, status: "notLoaded" } : thread,
  );
}
