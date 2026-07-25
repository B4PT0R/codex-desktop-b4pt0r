import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { RealtimeVoice } from "./appServerTypes";
import {
  acceptRealtimeAnswer,
  playRealtimeAudio,
  startRealtime,
  stopRealtime,
} from "./realtimeBridge";
import {
  threadInjectTranscriptParams,
  threadUnsubscribeParams,
  type ApprovalPolicy,
  type Permission,
} from "./protocol";
import { request, type AppServerMessage } from "./codex";
import {
  appServerRecord,
  appServerString,
  realtimeAudioFromValue,
} from "./appServerValues";
import { createRealtimeThread } from "./realtimeThread";
import {
  appendRealtimeUserDelta,
  appendRealtimeVoiceDelta,
  finalizeInterruptedRealtimeMessages,
  finalizeRealtimeUserMessage,
  finalizeRealtimeVoiceMessage,
  markRealtimeTextUpdates,
  realtimeVoiceItemId,
  reserveRealtimeUserMessage,
} from "./realtimeTranscript";
import type { AgentActivity } from "./activity";
import type { ChatMessage, Personality } from "../types";
import type { Translate } from "../i18n/I18nProvider";

type RealtimeConversationOptions = {
  setActivity: Dispatch<SetStateAction<AgentActivity>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  showError: (title: string, error: unknown) => void;
  translate: Translate;
};

type StartRealtimeConversationOptions = {
  parentThreadId: string;
  cwd?: string;
  model: string;
  permission?: Permission;
  personality: Personality;
  approvalPolicy?: ApprovalPolicy;
  voice: RealtimeVoice;
};

export function useRealtimeConversation({
  setActivity,
  setMessages,
  showError,
  translate,
}: RealtimeConversationOptions) {
  const [recording, setRecording] = useState(false);
  const activeThreadId = useRef<string | undefined>(undefined);
  const parentThreadId = useRef<string | undefined>(undefined);
  const releasingThreadIds = useRef(new Set<string>());
  const transcriptWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const preRealtimeMessageIds = useRef<ReadonlySet<string>>(new Set());
  const assistantMessageId = useRef<string | undefined>(undefined);
  const userMessageId = useRef<string | undefined>(undefined);
  const translateRef = useRef(translate);
  translateRef.current = translate;

  const finish = useCallback(() => {
    const assistantId = assistantMessageId.current;
    const userId = userMessageId.current;
    if (assistantId || userId) {
      setMessages((messages) =>
        finalizeInterruptedRealtimeMessages(messages, assistantId, userId),
      );
    }
    setActivity(null);
    setRecording(false);
    activeThreadId.current = undefined;
    parentThreadId.current = undefined;
    assistantMessageId.current = undefined;
    userMessageId.current = undefined;
    preRealtimeMessageIds.current = new Set();
  }, [setActivity, setMessages]);

  const releaseFork = useCallback(
    async (threadId?: string) => {
      if (!threadId || releasingThreadIds.current.has(threadId)) return;
      releasingThreadIds.current.add(threadId);
      if (activeThreadId.current === threadId)
        activeThreadId.current = undefined;
      try {
        await request(
          "thread/unsubscribe",
          threadUnsubscribeParams(threadId),
        );
      } catch (error) {
        showError(translateRef.current("app.audioInterrupted"), error);
      } finally {
        releasingThreadIds.current.delete(threadId);
      }
    },
    [showError],
  );

  const persistTranscript = useCallback(
    (
      role: "user" | "assistant",
      messageId: string,
      transcript: string,
    ) => {
      const persistentThreadId = parentThreadId.current;
      if (!persistentThreadId || !transcript) return;
      const write = () =>
        request(
          "thread/inject_items",
          threadInjectTranscriptParams(
            persistentThreadId,
            role,
            transcript,
            realtimeVoiceItemId(role, messageId),
          ),
        ).then(() => undefined);
      transcriptWriteQueue.current = transcriptWriteQueue.current
        .then(write, write)
        .catch((error) =>
          showError(
            translateRef.current("app.realtimeTranscriptSaveError"),
            error,
          ),
        );
    },
    [showError],
  );

  const stop = useCallback(async () => {
    const threadId = activeThreadId.current;
    await stopRealtime();
    await releaseFork(threadId);
    finish();
  }, [finish, releaseFork]);

  const reset = useCallback(() => {
    const threadId = activeThreadId.current;
    activeThreadId.current = undefined;
    void stopRealtime().finally(() => releaseFork(threadId));
    finish();
  }, [finish, releaseFork]);

  const start = useCallback(
    async (options: StartRealtimeConversationOptions) => {
      try {
        const started = await createRealtimeThread(request, options);
        const threadId = started.thread.id as string;
        activeThreadId.current = threadId;
        parentThreadId.current = options.parentThreadId;
        setMessages((messages) => {
          preRealtimeMessageIds.current = new Set(
            messages.map((message) => message.id),
          );
          return messages;
        });
        await startRealtime(
          threadId,
          options.voice,
          "conversation",
          (error) => {
            const failedThreadId = activeThreadId.current;
            finish();
            showError(translateRef.current("app.audioInterrupted"), error);
            void releaseFork(failedThreadId);
          },
        );
        setRecording(true);
      } catch (error) {
        const failedThreadId = activeThreadId.current;
        finish();
        showError(translateRef.current("app.realtimeUnavailable"), error);
        void releaseFork(failedThreadId);
      }
    },
    [finish, releaseFork, setMessages, showError],
  );

  const captureMessageDecorator = useCallback(() => {
    const active = activeThreadId.current !== undefined;
    const preexistingMessageIds = preRealtimeMessageIds.current;
    return (previous: ChatMessage[], next: ChatMessage[]) =>
      markRealtimeTextUpdates(
        previous,
        next,
        active,
        preexistingMessageIds,
      );
  }, []);

  const handleMessage = useCallback(
    (message: AppServerMessage) => {
      if (!message.method?.startsWith("thread/realtime/")) return false;
      const params = appServerRecord(message.params);
      const eventThreadId = appServerString(params?.threadId);
      if (eventThreadId && eventThreadId !== activeThreadId.current) return true;

      if (message.method === "thread/realtime/sdp") {
        acceptRealtimeAnswer(
          eventThreadId ?? "",
          appServerString(params?.sdp) ?? "",
        );
      }
      if (message.method === "thread/realtime/outputAudio/delta") {
        playRealtimeAudio(
          eventThreadId ?? "",
          realtimeAudioFromValue(params?.audio),
        );
      }
      if (message.method === "thread/realtime/itemAdded") {
        const item = appServerRecord(params?.item);
        if (appServerString(item?.type) === "input_audio_buffer.speech_started") {
          userMessageId.current ??= crypto.randomUUID();
          const messageId = userMessageId.current;
          setMessages((messages) =>
            reserveRealtimeUserMessage(messages, messageId),
          );
        }
      }
      if (message.method === "thread/realtime/transcript/delta") {
        const role = params?.role === "user" ? "user" : "assistant";
        if (role === "user") {
          userMessageId.current ??= crypto.randomUUID();
          const messageId = userMessageId.current;
          setMessages((messages) =>
            appendRealtimeUserDelta(
              messages,
              messageId,
              appServerString(params?.delta) ?? "",
            ),
          );
        } else {
          assistantMessageId.current ??= crypto.randomUUID();
          const messageId = assistantMessageId.current;
          setMessages((messages) =>
            appendRealtimeVoiceDelta(
              messages,
              messageId,
              appServerString(params?.delta) ?? "",
            ),
          );
        }
      }
      if (message.method === "thread/realtime/transcript/done") {
        const role = params?.role === "user" ? "user" : "assistant";
        const transcript = appServerString(params?.text)?.trim() ?? "";
        if (role === "assistant") {
          assistantMessageId.current ??= crypto.randomUUID();
          const messageId = assistantMessageId.current;
          setMessages((messages) =>
            finalizeRealtimeVoiceMessage(messages, messageId, transcript),
          );
          persistTranscript(role, messageId, transcript);
          assistantMessageId.current = undefined;
        } else {
          userMessageId.current ??= crypto.randomUUID();
          const messageId = userMessageId.current;
          setMessages((messages) =>
            finalizeRealtimeUserMessage(messages, messageId, transcript),
          );
          persistTranscript(role, messageId, transcript);
          userMessageId.current = undefined;
        }
      }
      if (
        message.method === "thread/realtime/closed" ||
        message.method === "thread/realtime/error"
      ) {
        const closedThreadId = activeThreadId.current;
        finish();
        stopRealtime(false);
        void releaseFork(closedThreadId);
        if (message.method === "thread/realtime/error") {
          showError(
            translateRef.current("app.audioInterrupted"),
            appServerString(params?.message) ??
              translateRef.current("app.realtimeUnavailable"),
          );
        }
      }
      return true;
    },
    [finish, persistTranscript, releaseFork, setMessages, showError],
  );

  return {
    recording,
    captureMessageDecorator,
    handleMessage,
    reset,
    start,
    stop,
  };
}
