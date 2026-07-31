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
import { realtimeInstructionItems } from "./realtimeInstructions";
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
  personality?: Personality;
  approvalPolicy?: ApprovalPolicy;
  voice: RealtimeVoice;
  displayTranscript?: boolean;
  reportError?: (title: string, error: unknown) => void;
};

type TranscriptUpdate = (messages: ChatMessage[]) => ChatMessage[];

export function useRealtimeConversation({
  setActivity,
  setMessages,
  showError,
  translate,
}: RealtimeConversationOptions) {
  const [recording, setRecording] = useState(false);
  const [headlessParentThreadId, setHeadlessParentThreadId] = useState<string>();
  const activeThreadId = useRef<string | undefined>(undefined);
  const parentThreadId = useRef<string | undefined>(undefined);
  const releasingThreadIds = useRef(new Set<string>());
  const transcriptWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const preRealtimeMessageIds = useRef<ReadonlySet<string>>(new Set());
  const assistantMessageId = useRef<string | undefined>(undefined);
  const userMessageId = useRef<string | undefined>(undefined);
  const displayTranscript = useRef(true);
  const bufferedTranscript = useRef<ChatMessage[]>([]);
  const errorReporter = useRef(showError);
  const defaultErrorReporter = useRef(showError);
  const translateRef = useRef(translate);
  translateRef.current = translate;
  defaultErrorReporter.current = showError;

  const updateTranscript = useCallback(
    (update: TranscriptUpdate) => {
      if (displayTranscript.current) {
        setMessages(update);
      } else {
        bufferedTranscript.current = update(bufferedTranscript.current);
      }
    },
    [setMessages],
  );

  const finish = useCallback(() => {
    const assistantId = assistantMessageId.current;
    const userId = userMessageId.current;
    if (displayTranscript.current && (assistantId || userId)) {
      setMessages((messages) =>
        finalizeInterruptedRealtimeMessages(messages, assistantId, userId),
      );
    }
    if (displayTranscript.current) setActivity(null);
    setRecording(false);
    activeThreadId.current = undefined;
    parentThreadId.current = undefined;
    assistantMessageId.current = undefined;
    userMessageId.current = undefined;
    preRealtimeMessageIds.current = new Set();
    bufferedTranscript.current = [];
    displayTranscript.current = true;
    setHeadlessParentThreadId(undefined);
    errorReporter.current = defaultErrorReporter.current;
  }, [setActivity, setMessages]);

  const releaseFork = useCallback(
    async (
      threadId?: string,
      reportError = errorReporter.current,
    ) => {
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
        reportError(translateRef.current("app.audioInterrupted"), error);
      } finally {
        releasingThreadIds.current.delete(threadId);
      }
    },
    [],
  );

  const persistTranscript = useCallback(
    (
      role: "user" | "assistant",
      messageId: string,
      transcript: string,
    ) => {
      const persistentThreadId = parentThreadId.current;
      if (!persistentThreadId || !transcript) return;
      const reportError = errorReporter.current;
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
          reportError(
            translateRef.current("app.realtimeTranscriptSaveError"),
            error,
          ),
        );
    },
    [],
  );

  const stop = useCallback(async () => {
    const threadId = activeThreadId.current;
    const reportError = errorReporter.current;
    let stopError: unknown;
    try {
      await stopRealtime();
    } catch (error) {
      stopError = error;
    }
    await releaseFork(threadId);
    finish();
    if (stopError) {
      reportError(translateRef.current("app.audioInterrupted"), stopError);
    }
  }, [finish, releaseFork]);

  const reset = useCallback(() => {
    const threadId = activeThreadId.current;
    const reportError = errorReporter.current;
    activeThreadId.current = undefined;
    void stopRealtime()
      .catch((error) =>
        reportError(translateRef.current("app.audioInterrupted"), error),
      )
      .then(() => releaseFork(threadId, reportError))
      .catch(() => undefined);
    finish();
  }, [finish, releaseFork]);

  const start = useCallback(
    async (options: StartRealtimeConversationOptions) => {
      displayTranscript.current = options.displayTranscript !== false;
      bufferedTranscript.current = [];
      setHeadlessParentThreadId(
        options.displayTranscript === false
          ? options.parentThreadId
          : undefined,
      );
      errorReporter.current =
        options.reportError ?? defaultErrorReporter.current;
      try {
        const started = await createRealtimeThread(request, options);
        const threadId = started.thread.id as string;
        activeThreadId.current = threadId;
        parentThreadId.current = options.parentThreadId;
        const initialItems = await realtimeInstructionItems(
          threadId,
          started.cwd ?? options.cwd,
        );
        if (displayTranscript.current) {
          setMessages((messages) => {
            preRealtimeMessageIds.current = new Set(
              messages.map((message) => message.id),
            );
            return messages;
          });
        }
        await startRealtime(
          threadId,
          options.voice,
          "conversation",
          (error) => {
            const failedThreadId = activeThreadId.current;
            const reportError = errorReporter.current;
            finish();
            reportError(translateRef.current("app.audioInterrupted"), error);
            void releaseFork(failedThreadId, reportError);
          },
          initialItems,
        );
        setRecording(true);
        return true;
      } catch (error) {
        const failedThreadId = activeThreadId.current;
        const reportError = errorReporter.current;
        finish();
        reportError(translateRef.current("app.realtimeUnavailable"), error);
        void releaseFork(failedThreadId, reportError);
        return false;
      }
    },
    [finish, releaseFork, setMessages],
  );

  const attachHeadlessTranscript = useCallback(() => {
    if (
      displayTranscript.current ||
      !activeThreadId.current ||
      !parentThreadId.current
    ) {
      return false;
    }
    displayTranscript.current = true;
    errorReporter.current = defaultErrorReporter.current;
    setHeadlessParentThreadId(undefined);
    const buffered = bufferedTranscript.current;
    bufferedTranscript.current = [];
    setMessages((messages) => {
      preRealtimeMessageIds.current = new Set(
        messages.map((message) => message.id),
      );
      return mergeBufferedTranscript(messages, buffered);
    });
    return true;
  }, [setMessages]);

  const captureMessageDecorator = useCallback(() => {
    const active =
      activeThreadId.current !== undefined && displayTranscript.current;
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
          updateTranscript((messages) =>
            reserveRealtimeUserMessage(messages, messageId),
          );
        }
      }
      if (message.method === "thread/realtime/transcript/delta") {
        const role = params?.role === "user" ? "user" : "assistant";
        if (role === "user") {
          userMessageId.current ??= crypto.randomUUID();
          const messageId = userMessageId.current;
          updateTranscript((messages) =>
            appendRealtimeUserDelta(
              messages,
              messageId,
              appServerString(params?.delta) ?? "",
            ),
          );
        } else {
          assistantMessageId.current ??= crypto.randomUUID();
          const messageId = assistantMessageId.current;
          updateTranscript((messages) =>
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
          updateTranscript((messages) =>
            finalizeRealtimeVoiceMessage(messages, messageId, transcript),
          );
          persistTranscript(role, messageId, transcript);
          assistantMessageId.current = undefined;
        } else {
          userMessageId.current ??= crypto.randomUUID();
          const messageId = userMessageId.current;
          updateTranscript((messages) =>
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
        const reportError = errorReporter.current;
        finish();
        void stopRealtime(false).catch(() => undefined);
        void releaseFork(closedThreadId, reportError);
        if (message.method === "thread/realtime/error") {
          reportError(
            translateRef.current("app.audioInterrupted"),
            appServerString(params?.message) ??
              translateRef.current("app.realtimeUnavailable"),
          );
        }
      }
      return true;
    },
    [finish, persistTranscript, releaseFork, updateTranscript],
  );

  return {
    recording,
    headlessParentThreadId,
    attachHeadlessTranscript,
    captureMessageDecorator,
    handleMessage,
    reset,
    start,
    stop,
  };
}

function mergeBufferedTranscript(
  messages: ChatMessage[],
  buffered: ChatMessage[],
) {
  if (!buffered.length) return messages;
  const existingIds = new Set(messages.map((message) => message.id));
  const additions = buffered.filter(
    (message) =>
      !existingIds.has(message.id) &&
      !existingIds.has(realtimeVoiceItemId(message.role, message.id)),
  );
  return additions.length ? [...messages, ...additions] : messages;
}
