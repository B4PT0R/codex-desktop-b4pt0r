import type { ThreadSummary } from "../types";
import type { AppServerThread } from "./appServerTypes";
import { threadStatusFromValue } from "./threadLifecycle";

export function threadSummary(thread: AppServerThread): ThreadSummary {
  return {
    id: thread.id,
    name: thread.name,
    preview:
      thread.preview ??
      thread.turns?.at(-1)?.items?.find((item) => item.type === "userMessage")
        ?.content?.[0]?.text,
    updatedAt: thread.updatedAt,
    cwd: thread.cwd,
    status: threadStatusFromValue(thread.status),
  };
}
