import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  ThreadForkResponse,
  ThreadMetadataUpdateResponse,
  ThreadReadResponse,
} from "./appServerTypes";
import { request } from "./codex";
import {
  threadArchiveParams,
  threadCompactParams,
  threadDeleteParams,
  threadForkParams,
  threadPinParams,
  threadReadParams,
  threadSetNameParams,
  threadUnarchiveParams,
} from "./protocol";
import type { ThreadSummary } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import type { ThreadTurnCoordinator } from "./threadTurnCoordinator";
import { threadSummary } from "./threadSummary";
import { restoreThread } from "./threadReconciliation";

export type ArchivedThread = {
  thread: ThreadSummary;
  previousIndex: number;
};

type Options = {
  activeThreadId?: string;
  busy: boolean;
  threads: ThreadSummary[];
  setBusy: Dispatch<SetStateAction<boolean>>;
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>;
  onActiveThreadRemoved: () => void;
  onError: (title: string, error: unknown) => void;
  onForked: (threadId: string) => Promise<unknown>;
  turnCoordinator: ThreadTurnCoordinator;
};

export function useThreadActions({
  activeThreadId,
  busy,
  threads,
  setBusy,
  setThreads,
  onActiveThreadRemoved,
  onError,
  onForked,
  turnCoordinator,
}: Options) {
  const { t } = useI18n();
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const pendingThreads = useRef(new Set<string>());

  async function runThreadAction<T>(
    threadId: string,
    blockedResult: T,
    action: () => Promise<T>,
  ) {
    if (pendingThreads.current.has(threadId)) return blockedResult;
    pendingThreads.current.add(threadId);
    try {
      return await action();
    } finally {
      pendingThreads.current.delete(threadId);
    }
  }

  function dismissArchiveNotice(threadId: string) {
    setArchivedThreads((items) =>
      items.filter((item) => item.thread.id !== threadId),
    );
  }

  async function archive(threadId: string, fallbackThread?: ThreadSummary) {
    const previousIndex = threads.findIndex((item) => item.id === threadId);
    const thread = threads[previousIndex] ?? fallbackThread;
    if (!thread) return false;
    return runThreadAction(threadId, false, async () => {
      try {
        await request("thread/archive", threadArchiveParams(threadId));
        setThreads((items) => items.filter((item) => item.id !== threadId));
        setArchivedThreads((items) => [...items, { thread, previousIndex }]);
        if (activeThreadId === threadId) onActiveThreadRemoved();
        return true;
      } catch (error) {
        onError(t("thread.archiveError"), error);
        return false;
      }
    });
  }

  async function deleteThread(threadId = activeThreadId) {
    if (!threadId || busy) return false;
    return runThreadAction(threadId, false, async () => {
      try {
        await request("thread/delete", threadDeleteParams(threadId));
        setThreads((items) => items.filter((thread) => thread.id !== threadId));
        setArchivedThreads((items) =>
          items.filter((item) => item.thread.id !== threadId),
        );
        if (activeThreadId === threadId) onActiveThreadRemoved();
        return true;
      } catch (error) {
        onError(t("thread.deleteError"), error);
        return false;
      }
    });
  }

  async function unarchive(archived: ArchivedThread) {
    await runThreadAction(archived.thread.id, undefined, async () => {
      try {
        await request(
          "thread/unarchive",
          threadUnarchiveParams(archived.thread.id),
        );
        setThreads((items) => {
          if (items.some((item) => item.id === archived.thread.id)) return items;
          const next = [...items];
          next.splice(
            Math.min(archived.previousIndex, next.length),
            0,
            archived.thread,
          );
          return next;
        });
        dismissArchiveNotice(archived.thread.id);
      } catch (error) {
        onError(t("thread.unarchiveError"), error);
      }
    });
  }

  async function rename(name: string) {
    if (!activeThreadId) return false;
    const threadId = activeThreadId;
    const normalizedName = name.trim();
    return runThreadAction(threadId, false, async () => {
      try {
        await request(
          "thread/name/set",
          threadSetNameParams(threadId, normalizedName),
        );
        const response = await request<ThreadReadResponse>(
          "thread/read",
          threadReadParams(threadId),
        );
        const summary = threadSummary(response.thread);
        if (
          summary.id !== threadId ||
          summary.name?.trim() !== normalizedName
        ) {
          throw new Error("App Server did not persist the conversation name");
        }
        setThreads((items) => restoreThread(items, summary));
        return true;
      } catch (error) {
        onError(t("thread.renameError"), error);
        return false;
      }
    });
  }

  async function setPinned(thread: ThreadSummary, isPinned: boolean) {
    return runThreadAction(thread.id, false, async () => {
      try {
        const response = await request<ThreadMetadataUpdateResponse>(
          "thread/metadata/update",
          threadPinParams(thread.id, isPinned),
        );
        const summary = threadSummary(response.thread);
        if (summary.id !== thread.id || summary.isPinned !== isPinned) {
          throw new Error("App Server did not persist the pin state");
        }
        setThreads((items) => restoreThread(items, summary));
        return true;
      } catch (error) {
        onError(t("thread.pinError"), error);
        return false;
      }
    });
  }

  async function compact() {
    if (!activeThreadId || busy) return false;
    const threadId = activeThreadId;
    return runThreadAction(threadId, false, async () => {
      setBusy(true);
      try {
        await turnCoordinator.runWhenIdle(threadId, () =>
          request("thread/compact/start", threadCompactParams(threadId)),
        );
        return true;
      } catch (error) {
        setBusy(false);
        onError(t("thread.compactError"), error);
        return false;
      }
    });
  }

  async function fork() {
    if (!activeThreadId || busy) return false;
    const threadId = activeThreadId;
    return runThreadAction(threadId, false, async () => {
      setBusy(true);
      try {
        const response = await request<ThreadForkResponse>(
          "thread/fork",
          threadForkParams(threadId),
        );
        const forked = response.thread;
        setThreads((items) => [
          {
            id: forked.id,
            name: forked.name,
            preview: forked.preview,
            cwd: response.cwd ?? forked.cwd,
          },
          ...items.filter((item) => item.id !== forked.id),
        ]);
        await onForked(forked.id);
        return true;
      } catch (error) {
        onError(t("thread.forkError"), error);
        return false;
      } finally {
        setBusy(false);
      }
    });
  }

  return {
    archive,
    archivedThreads,
    compact,
    deleteThread,
    dismissArchiveNotice,
    fork,
    rename,
    setPinned,
    unarchive,
  };
}
