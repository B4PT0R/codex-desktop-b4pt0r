import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "../types";
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

type ThreadHistoryOptions = {
  activeThreadId?: string;
  onError: (title: string, error: unknown) => void;
  onMessagesPrepended: (messages: ChatMessage[]) => void;
  onMessagesReplaced: (messages: ChatMessage[]) => void;
  onThreadResumed: (threadId: string, cwd?: string) => void;
};

/** Owns persisted conversation hydration and protects it from stale responses. */
export function useThreadHistory({
  activeThreadId,
  onError,
  onMessagesPrepended,
  onMessagesReplaced,
  onThreadResumed,
}: ThreadHistoryOptions) {
  const { t } = useI18n();
  const [cursor, setCursor] = useState<string>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const resumeGeneration = useRef(0);

  const reset = useCallback(() => {
    resumeGeneration.current += 1;
    loadingOlderRef.current = false;
    setCursor(undefined);
    setLoadingOlder(false);
  }, []);

  const resume = useCallback(
    async (threadId: string) => {
      const generation = resumeGeneration.current + 1;
      resumeGeneration.current = generation;
      loadingOlderRef.current = false;
      setCursor(undefined);
      try {
        const response = await request<ThreadResumeResponse>(
          "thread/resume",
          threadResumeParams(threadId),
        );
        if (resumeGeneration.current !== generation) return;
        const page = response.initialTurnsPage;
        onMessagesReplaced(
          page
            ? messagesFromTurnsNewestFirst(page.data, t)
            : messagesFromThread(response.thread, t),
        );
        setCursor(page?.nextCursor ?? undefined);
        onThreadResumed(threadId, response.thread.cwd);
      } catch (error) {
        if (resumeGeneration.current === generation)
          onError(t("thread.resumeError"), error);
      }
    },
    [onError, onMessagesReplaced, onThreadResumed, t],
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
      onMessagesPrepended(messagesFromTurnsNewestFirst(page.data, t));
      setCursor(page.nextCursor ?? undefined);
    } catch (error) {
      if (resumeGeneration.current === generation)
        onError(t("thread.historyError"), error);
    } finally {
      if (resumeGeneration.current === generation) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    }
  }, [activeThreadId, cursor, onError, onMessagesPrepended, t]);

  return {
    canLoadOlder: Boolean(cursor),
    loadOlder,
    loadingOlder,
    reset,
    resume,
  };
}
