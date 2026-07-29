import { useState, type Dispatch, type SetStateAction } from "react";
import type { ThreadForkResponse } from "./appServerTypes";
import { request } from "./codex";
import {
  threadArchiveParams,
  threadCompactParams,
  threadDeleteParams,
  threadForkParams,
  threadSetNameParams,
  threadUnarchiveParams,
} from "./protocol";
import type { ThreadSummary } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import type { ThreadTurnCoordinator } from "./threadTurnCoordinator";

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

  function dismissArchiveNotice(threadId: string) {
    setArchivedThreads((items) =>
      items.filter((item) => item.thread.id !== threadId),
    );
  }

  async function archive(threadId: string, fallbackThread?: ThreadSummary) {
    const previousIndex = threads.findIndex((item) => item.id === threadId);
    const thread = threads[previousIndex] ?? fallbackThread;
    if (!thread) return false;
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
  }

  async function deleteThread(threadId = activeThreadId) {
    if (!threadId || busy) return false;
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
  }

  async function unarchive(archived: ArchivedThread) {
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
  }

  async function rename(name: string) {
    if (!activeThreadId) return false;
    try {
      await request(
        "thread/name/set",
        threadSetNameParams(activeThreadId, name),
      );
      setThreads((items) =>
        items.map((thread) =>
          thread.id === activeThreadId ? { ...thread, name } : thread,
        ),
      );
      return true;
    } catch (error) {
      onError(t("thread.renameError"), error);
      return false;
    }
  }

  async function compact() {
    if (!activeThreadId || busy) return false;
    setBusy(true);
    try {
      await turnCoordinator.runWhenIdle(
        activeThreadId,
        () =>
          request(
            "thread/compact/start",
            threadCompactParams(activeThreadId),
          ),
      );
      return true;
    } catch (error) {
      setBusy(false);
      onError(t("thread.compactError"), error);
      return false;
    }
  }

  async function fork() {
    if (!activeThreadId || busy) return false;
    setBusy(true);
    try {
      const response = await request<ThreadForkResponse>(
        "thread/fork",
        threadForkParams(activeThreadId),
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
  }

  return {
    archive,
    archivedThreads,
    compact,
    deleteThread,
    dismissArchiveNotice,
    fork,
    rename,
    unarchive,
  };
}
