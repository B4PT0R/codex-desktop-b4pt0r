import type { ThreadSummary } from "../types";
import type { AppServerThread } from "./appServerTypes";
import { threadStatusFromValue } from "./threadLifecycle";
import { scheduledTaskFromPrompt } from "./scheduledTaskMessage";
import { isPinnedThread } from "./threadSections";

export function threadSummary(thread: AppServerThread): ThreadSummary {
  return {
    id: thread.id,
    ...(isCodexDiscussionWorkspace(thread.cwd)
      ? { kind: "discussion" as const }
      : {}),
    ...(typeof thread.isPinned === "boolean"
      ? { isPinned: thread.isPinned }
      : thread.section !== undefined
        ? { isPinned: isPinnedThread(thread) }
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

/** Applies runtime cwd before classifying a newly started thread. */
export function startedThreadSummary(
  thread: AppServerThread,
  cwd: string | undefined,
  fallbackName: string,
): ThreadSummary {
  return {
    ...threadSummary({ ...thread, cwd }),
    name: thread.name ?? fallbackName,
  };
}

/**
 * Projectless Codex chats currently receive a synthetic cwd below the user's
 * Documents/Codex directory. App Server does not expose workspace_kind on
 * Thread yet, so keep this compatibility seam out of presentation components.
 */
export function isCodexDiscussionWorkspace(cwd?: string) {
  if (!cwd) return false;
  const segments = cwd.split(/[\\/]/).filter(Boolean);
  const leaf = segments.at(-1);
  return (
    segments.at(-3)?.toLocaleLowerCase() === "documents" &&
    segments.at(-2)?.toLocaleLowerCase() === "codex" &&
    Boolean(leaf && /^\d{4}-\d{2}-\d{2}(?:-.+)?$/.test(leaf))
  );
}

function cleanPreview(preview?: string) {
  return preview ? (scheduledTaskFromPrompt(preview)?.prompt ?? preview) : preview;
}
