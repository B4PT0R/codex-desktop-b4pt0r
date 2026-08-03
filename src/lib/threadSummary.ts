import type { ThreadSummary } from "../types";
import type { AppServerThread } from "./appServerTypes";
import { threadStatusFromValue } from "./threadLifecycle";
import { scheduledTaskFromPrompt } from "./scheduledTaskMessage";

export function threadSummary(thread: AppServerThread): ThreadSummary {
  return {
    id: thread.id,
    ...(typeof thread.isPinned === "boolean"
      ? { isPinned: thread.isPinned }
      : {}),
    name: thread.name,
    preview: cleanPreview(
      thread.preview ??
        thread.turns?.at(-1)?.items?.find((item) => item.type === "userMessage")
          ?.content?.[0]?.text,
    ),
    updatedAt: thread.updatedAt,
    cwd: thread.cwd,
    status: threadStatusFromValue(thread.status),
    section: thread.section ?? undefined,
  };
}

function cleanPreview(preview?: string) {
  return preview ? (scheduledTaskFromPrompt(preview)?.prompt ?? preview) : preview;
}
