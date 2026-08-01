import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ThreadSummary } from "../types";
import type { ThreadReadResponse } from "./appServerTypes";
import { request } from "./codex";
import { threadReadParams } from "./protocol";
import { restoreThread } from "./threadReconciliation";
import { threadSummary } from "./threadSummary";

type Options = {
  connected: boolean;
  defaultThreadId?: string;
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>;
  threads: ThreadSummary[];
};

/**
 * Keeps the promoted default conversation backed by App Server metadata even
 * when it falls outside the bounded recent-thread catalog.
 */
export function useDefaultThreadCatalogEntry({
  connected,
  defaultThreadId,
  setThreads,
  threads,
}: Options) {
  const attemptedThreadId = useRef<string | undefined>(undefined);
  const resolvedThreadId = useRef<string | undefined>(undefined);
  const currentThreadId = useRef(defaultThreadId);
  const currentConnected = useRef(connected);
  const requestVersion = useRef(0);
  if (
    currentConnected.current !== connected ||
    currentThreadId.current !== defaultThreadId
  ) {
    requestVersion.current += 1;
    currentConnected.current = connected;
  }
  currentThreadId.current = defaultThreadId;

  useEffect(() => {
    if (!connected) {
      attemptedThreadId.current = undefined;
      resolvedThreadId.current = undefined;
      return;
    }
    const present = threads.some((thread) => thread.id === defaultThreadId);
    if (present) {
      requestVersion.current += 1;
      resolvedThreadId.current = defaultThreadId;
      return;
    }
    // Initial thread/list hydration can replace a metadata response that
    // completed first. Permit a fresh read after that replacement.
    if (resolvedThreadId.current === defaultThreadId) {
      attemptedThreadId.current = undefined;
      resolvedThreadId.current = undefined;
    }
    if (
      !defaultThreadId ||
      attemptedThreadId.current === defaultThreadId
    ) {
      return;
    }

    attemptedThreadId.current = defaultThreadId;
    const version = ++requestVersion.current;
    void readDefaultThreadCatalogEntry(defaultThreadId)
      .then((summary) => {
        if (
          currentThreadId.current !== defaultThreadId ||
          requestVersion.current !== version
        ) {
          return;
        }
        resolvedThreadId.current = defaultThreadId;
        setThreads((current) => restoreThread(current, summary));
      })
      .catch(() => {
        // A reconnect retries; the sidebar keeps a neutral navigable fallback.
      });
  }, [connected, defaultThreadId, setThreads, threads]);
}

export async function readDefaultThreadCatalogEntry(
  threadId: string,
): Promise<ThreadSummary> {
  const response = await request<ThreadReadResponse>(
    "thread/read",
    threadReadParams(threadId),
  );
  const summary = threadSummary(response.thread);
  if (summary.id !== threadId) {
    throw new Error("App Server returned a different thread");
  }
  return summary;
}
