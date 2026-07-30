import { useCallback, useRef, useState } from "react";
import type { ChatMessage, ThreadSummary } from "../types";
import type {
  ThreadResumeResponse,
  ThreadTurnsListResponse,
} from "./appServerTypes";
import { request } from "./codex";
import { threadResumeParams, threadTurnsListParams } from "./protocol";
import {
  messagesFromThread,
  messagesFromTurnsNewestFirst,
} from "./threadPresentation";
import { useI18n } from "../i18n/I18nProvider";
import {
  threadRuntimeSettings,
  type ThreadRuntimeSettings,
} from "./threadRuntimeSettings";
import { threadStatusFromValue } from "./threadLifecycle";
import type { AgentActivity } from "./activity";
import type { ThreadStatus } from "../types";
import { threadSummary } from "./threadSummary";

export type ThreadResumeRunState = {
  activity: AgentActivity;
  busy: boolean;
  status?: ThreadStatus;
  turnId?: string;
};

type ThreadHistoryOptions = {
  activeThreadId?: string;
  onError: (title: string, error: unknown) => void;
  onMessagesPrepended: (messages: ChatMessage[]) => void;
  onMessagesReplaced: (messages: ChatMessage[]) => void;
  onThreadResumeFailed: (threadId: string) => void;
  onThreadResumeStarted: (threadId: string) => void;
  onThreadResumed: (
    threadId: string,
    settings: ThreadRuntimeSettings,
    runState: ThreadResumeRunState,
    summary: ThreadSummary,
  ) => void;
};

/** Owns persisted conversation hydration and protects it from stale responses. */
export function useThreadHistory({
  activeThreadId,
  onError,
  onMessagesPrepended,
  onMessagesReplaced,
  onThreadResumeFailed,
  onThreadResumeStarted,
  onThreadResumed,
}: ThreadHistoryOptions) {
  const { t } = useI18n();
  const [cursor, setCursor] = useState<string>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [resuming, setResuming] = useState(false);
  const loadingOlderRef = useRef(false);
  const resumeGeneration = useRef(0);
  const callbacks = useRef({
    onError,
    onMessagesPrepended,
    onMessagesReplaced,
    onThreadResumeFailed,
    onThreadResumeStarted,
    onThreadResumed,
  });
  callbacks.current = {
    onError,
    onMessagesPrepended,
    onMessagesReplaced,
    onThreadResumeFailed,
    onThreadResumeStarted,
    onThreadResumed,
  };

  const reset = useCallback(() => {
    resumeGeneration.current += 1;
    loadingOlderRef.current = false;
    setCursor(undefined);
    setLoadingOlder(false);
    setResuming(false);
  }, []);

  const resume = useCallback(
    async (threadId: string) => {
      const generation = resumeGeneration.current + 1;
      resumeGeneration.current = generation;
      loadingOlderRef.current = false;
      setCursor(undefined);
      setLoadingOlder(false);
      setResuming(true);
      callbacks.current.onThreadResumeStarted(threadId);
      try {
        const response = await request<ThreadResumeResponse>(
          "thread/resume",
          threadResumeParams(threadId),
        );
        if (resumeGeneration.current !== generation) return false;
        const page = response.initialTurnsPage;
        callbacks.current.onMessagesReplaced(
          page
            ? messagesFromTurnsNewestFirst(page.data, t)
            : messagesFromThread(response.thread, t),
        );
        setCursor(page?.nextCursor ?? undefined);
        const runtimeSettings = threadRuntimeSettings(response);
        const summary = threadSummary(response.thread);
        callbacks.current.onThreadResumed(
          threadId,
          runtimeSettings,
          threadResumeRunState(response),
          {
            ...summary,
            cwd: summary.cwd ?? runtimeSettings.cwd,
          },
        );
        setResuming(false);
        return true;
      } catch (error) {
        if (resumeGeneration.current === generation) {
          setResuming(false);
          callbacks.current.onThreadResumeFailed(threadId);
          callbacks.current.onError(t("thread.resumeError"), error);
        }
        return false;
      }
    },
    [t],
  );

  const loadOlder = useCallback(async () => {
    if (!activeThreadId || !cursor || loadingOlderRef.current) return;
    const threadId = activeThreadId;
    const generation = resumeGeneration.current;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await request<ThreadTurnsListResponse>(
        "thread/turns/list",
        threadTurnsListParams(threadId, cursor),
      );
      if (resumeGeneration.current !== generation) return;
      callbacks.current.onMessagesPrepended(
        messagesFromTurnsNewestFirst(page.data, t),
      );
      setCursor(page.nextCursor ?? undefined);
    } catch (error) {
      if (resumeGeneration.current === generation)
        callbacks.current.onError(t("thread.historyError"), error);
    } finally {
      if (resumeGeneration.current === generation) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    }
  }, [activeThreadId, cursor, t]);

  return {
    canLoadOlder: Boolean(cursor),
    loadOlder,
    loadingOlder,
    reset,
    resuming,
    resume,
  };
}

export function threadResumeRunState(
  response: ThreadResumeResponse,
): ThreadResumeRunState {
  const status = threadStatusFromValue(response.thread.status);
  const busy = status === "active";
  const pagedTurns = response.initialTurnsPage?.data;
  const turns =
    pagedTurns && pagedTurns.length > 0
      ? pagedTurns
      : (response.thread.turns ?? []);
  const activeTurn = turns.find((turn) => turn.status === "inProgress");
  const waiting = response.thread.status?.activeFlags?.some(
    (flag) => flag === "waitingOnApproval" || flag === "waitingOnUserInput",
  );
  return {
    activity: busy ? (waiting ? "waiting" : "working") : null,
    busy,
    status,
    ...(busy && activeTurn?.id ? { turnId: activeTurn.id } : {}),
  };
}
