import type { ThreadTelemetry } from "./sessionTelemetry";
import type { ThreadSummary } from "../types";

export function removeDeletedThread(
  threads: ThreadSummary[],
  threadId: string,
): ThreadSummary[] {
  return threads.filter((thread) => thread.id !== threadId);
}

export function removeDeletedThreadTelemetry(
  current: Record<string, ThreadTelemetry>,
  threadId: string,
): Record<string, ThreadTelemetry> {
  if (!(threadId in current)) return current;
  const telemetry = { ...current };
  delete telemetry[threadId];
  return telemetry;
}
