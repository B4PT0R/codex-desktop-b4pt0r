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
  markRealtimeConversationUpdates,
  markRealtimeTextUpdates,
  realtimeConversationScope,
  realtimeTextItemId,
  realtimeVoiceItemId,
  reserveRealtimeUserMessage,
} from "./realtimeTranscript";
import type { AgentActivity } from "./activity";
import type { ChatMessage, Personality } from "../types";
import type { Translate } from "../i18n/I18nProvider";
import { applyConversationEvent } from "./conversationEvents";

type RealtimeConversationOptions = {
  activeParentThreadId?: string;
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
  activeParentThreadId,
  setActivity,
  setMessages,
  showError,
  translate,
}: RealtimeConversationOptions) {
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [headlessParentThreadId, setHeadlessParentThreadId] = useState<string>();
  const activeThreadId = useRef<string | undefined>(undefined);
  const parentThreadId = useRef<string | undefined>(undefined);
  const visibleParentThreadId = useRef(activeParentThreadId);
  const startGeneration = useRef(0);
  const startingRef = useRef(false);
  const startOperation = useRef<Promise<boolean> | undefined>(undefined);
  const terminationOperation = useRef<Promise<void> | undefined>(undefined);
  const releasingThreadIds = useRef(new Set<string>());
  const transcriptWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const preRealtimeMessageIds = useRef<ReadonlySet<string>>(new Set());
  const assistantMessageId = useRef<string | undefined>(undefined);
  const assistantSegmentText = useRef("");
  const assistantResponseSegmented = useRef(false);
  const delegationInProgress = useRef(false);
  const userMessageId = useRef<string | undefined>(undefined);
  const transcriptDisplayRequested = useRef(true);
  const bufferedTranscripts = useRef(new Map<string, ChatMessage[]>());
  const errorReporter = useRef(showError);
  const defaultErrorReporter = useRef(showError);
  const translateRef = useRef(translate);
  translateRef.current = translate;
  defaultErrorReporter.current = showError;
  visibleParentThreadId.current = activeParentThreadId;

  const transcriptIsVisible = useCallback(
    () =>
      transcriptDisplayRequested.current &&
      parentThreadId.current !== undefined &&
      parentThreadId.current === visibleParentThreadId.current,
    [],
  );

  const attachBufferedTranscript = useCallback((visibleThreadId?: string) => {
    const targetThreadId = visibleThreadId ?? visibleParentThreadId.current;
    if (!transcriptDisplayRequested.current || !targetThreadId) return false;
    const buffered = bufferedTranscripts.current.get(targetThreadId) ?? [];
    if (!buffered.length) return false;
    setMessages((messages) => {
      preRealtimeMessageIds.current = new Set(
        messages.map((message) => message.id),
      );
      return mergeBufferedTranscript(messages, buffered);
    });
    return true;
  }, [setMessages]);

  const updateTranscript = useCallback(
    (update: TranscriptUpdate) => {
      const transcriptThreadId = parentThreadId.current;
      if (!transcriptThreadId) return;
      const buffered = update(
        bufferedTranscripts.current.get(transcriptThreadId) ?? [],
      ).slice(-200);
      bufferedTranscripts.current.delete(transcriptThreadId);
      bufferedTranscripts.current.set(transcriptThreadId, buffered);
      while (bufferedTranscripts.current.size > 20) {
        const oldest = bufferedTranscripts.current.keys().next().value;
        if (typeof oldest !== "string") break;
        bufferedTranscripts.current.delete(oldest);
      }
      if (transcriptIsVisible()) {
        setMessages(update);
      }
    },
    [setMessages, transcriptIsVisible],
  );

  const finish = useCallback(() => {
    const assistantId = assistantMessageId.current;
    const userId = userMessageId.current;
    const transcriptVisible = transcriptIsVisible();
    if (assistantId || userId) {
      updateTranscript((messages) =>
        finalizeInterruptedRealtimeMessages(messages, assistantId, userId),
      );
    }
    if (transcriptVisible) setActivity(null);
    setRecording(false);
    startingRef.current = false;
    setStarting(false);
    activeThreadId.current = undefined;
    parentThreadId.current = undefined;
    assistantMessageId.current = undefined;
    assistantSegmentText.current = "";
    assistantResponseSegmented.current = false;
    delegationInProgress.current = false;
    userMessageId.current = undefined;
    preRealtimeMessageIds.current = new Set();
    transcriptDisplayRequested.current = true;
    setHeadlessParentThreadId(undefined);
    errorReporter.current = defaultErrorReporter.current;
  }, [setActivity, transcriptIsVisible, updateTranscript]);

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
      modality: "text" | "voice" = "voice",
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
            modality === "text"
              ? realtimeTextItemId(messageId)
              : realtimeVoiceItemId(role, messageId),
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

  const terminate = useCallback((notifyRemote = true) => {
    if (terminationOperation.current) return terminationOperation.current;
    startGeneration.current += 1;
    startingRef.current = true;
    setStarting(true);
    const pendingStart = startOperation.current;
    const threadId = activeThreadId.current;
    const reportError = errorReporter.current;
    activeThreadId.current = undefined;
    const operation = (async () => {
      let stopError: unknown;
      try {
        await stopRealtime(notifyRemote);
      } catch (error) {
        stopError = error;
      }
      await pendingStart?.catch(() => false);
      await releaseFork(threadId, reportError);
      finish();
      if (stopError) {
        reportError(translateRef.current("app.audioInterrupted"), stopError);
      }
    })().finally(() => {
      if (terminationOperation.current === operation) {
        terminationOperation.current = undefined;
      }
    });
    terminationOperation.current = operation;
    return operation;
  }, [finish, releaseFork]);

  const stop = useCallback(() => terminate(true), [terminate]);

  const reset = useCallback(() => {
    void terminate(true);
  }, [terminate]);

  const start = useCallback(
    async (options: StartRealtimeConversationOptions) => {
      if (startingRef.current || activeThreadId.current || recording) {
        return false;
      }
      const generation = startGeneration.current + 1;
      startGeneration.current = generation;
      startingRef.current = true;
      setStarting(true);
      transcriptDisplayRequested.current = options.displayTranscript !== false;
      setHeadlessParentThreadId(
        options.displayTranscript === false
          ? options.parentThreadId
          : undefined,
      );
      errorReporter.current =
        options.reportError ?? defaultErrorReporter.current;
      const reportError = errorReporter.current;
      let createdThreadId: string | undefined;
      const operation = (async () => {
        try {
          const started = await createRealtimeThread(request, options);
          const threadId = started.thread.id as string;
          createdThreadId = threadId;
          if (startGeneration.current !== generation) {
            await releaseFork(threadId, reportError);
            return false;
          }
          activeThreadId.current = threadId;
          parentThreadId.current = options.parentThreadId;
          const initialItems = await realtimeInstructionItems(
            threadId,
            started.cwd ?? options.cwd,
          );
          if (startGeneration.current !== generation) {
            return false;
          }
          if (options.displayTranscript !== false) {
            attachBufferedTranscript(options.parentThreadId);
          }
          await startRealtime(
            threadId,
            options.voice,
            "conversation",
            (error) => {
              if (
                startGeneration.current !== generation ||
                activeThreadId.current !== threadId
              ) {
                void releaseFork(threadId, reportError);
                return;
              }
              void terminate(false).then(() =>
                reportError(
                  translateRef.current("app.audioInterrupted"),
                  error,
                ),
              );
            },
            initialItems,
          );
          if (startGeneration.current !== generation) {
            await stopRealtime().catch(() => undefined);
            return false;
          }
          setRecording(true);
          return true;
        } catch (error) {
          if (startGeneration.current === generation) {
            finish();
            reportError(translateRef.current("app.realtimeUnavailable"), error);
            void releaseFork(createdThreadId, reportError);
          }
          return false;
        } finally {
          if (startGeneration.current === generation) {
            startingRef.current = false;
            setStarting(false);
          }
        }
      })();
      startOperation.current = operation;
      try {
        return await operation;
      } finally {
        if (startOperation.current === operation) {
          startOperation.current = undefined;
        }
      }
    },
    [
      attachBufferedTranscript,
      finish,
      recording,
      releaseFork,
      terminate,
      transcriptIsVisible,
    ],
  );

  const attachHeadlessTranscript = useCallback(() => {
    if (
      transcriptDisplayRequested.current ||
      !activeThreadId.current ||
      !parentThreadId.current
    ) {
      return false;
    }
    transcriptDisplayRequested.current = true;
    errorReporter.current = defaultErrorReporter.current;
    setHeadlessParentThreadId(undefined);
    attachBufferedTranscript(visibleParentThreadId.current);
    return true;
  }, [attachBufferedTranscript]);

  const attachVisibleTranscript = useCallback(
    (threadId: string) => {
      visibleParentThreadId.current = threadId;
      return attachBufferedTranscript(threadId);
    },
    [attachBufferedTranscript],
  );

  const detachVisibleTranscript = useCallback(
    (nextThreadId?: string) => {
      visibleParentThreadId.current = nextThreadId;
      if (
        !transcriptDisplayRequested.current ||
        !parentThreadId.current ||
        nextThreadId === parentThreadId.current
      )
        return;
    },
    [],
  );

  const captureMessageDecorator = useCallback(() => {
    const active =
      activeThreadId.current !== undefined && transcriptIsVisible();
    const preexistingMessageIds = preRealtimeMessageIds.current;
    return (previous: ChatMessage[], next: ChatMessage[]) =>
      markRealtimeTextUpdates(
        previous,
        next,
        active,
        preexistingMessageIds,
      );
  }, [transcriptIsVisible]);

  const handleConversationEvent = useCallback(
    (message: AppServerMessage, eventThreadId?: string) => {
      if (!realtimeConversationScope(
        eventThreadId,
        activeThreadId.current,
        parentThreadId.current,
      )) return false;
      if (!delegationInProgress.current) {
        delegationInProgress.current = true;
        const voiceMessageId = assistantMessageId.current;
        const voiceTranscript = assistantSegmentText.current.trim();
        if (voiceMessageId) {
          updateTranscript((messages) =>
            finalizeRealtimeVoiceMessage(
              messages,
              voiceMessageId,
              voiceTranscript,
            ),
          );
          persistTranscript("assistant", voiceMessageId, voiceTranscript);
          assistantMessageId.current = undefined;
          assistantSegmentText.current = "";
          assistantResponseSegmented.current = true;
        }
      }
      const preexistingMessageIds = preRealtimeMessageIds.current;
      updateTranscript((messages) =>
        markRealtimeConversationUpdates(
          messages,
          applyConversationEvent(messages, message, translateRef.current),
          preexistingMessageIds,
        ),
      );
      if (message.method === "item/completed") {
        const item = appServerRecord(appServerRecord(message.params)?.item);
        if (appServerString(item?.type) === "agentMessage") {
          const itemId = appServerString(item?.id);
          const text = appServerString(item?.text)?.trim();
          if (itemId && text) {
            persistTranscript("assistant", itemId, text, "text");
          }
          delegationInProgress.current = false;
        }
      }
      return true;
    },
    [persistTranscript, updateTranscript],
  );

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
          const delta = appServerString(params?.delta) ?? "";
          assistantMessageId.current ??= crypto.randomUUID();
          const messageId = assistantMessageId.current;
          assistantSegmentText.current += delta;
          updateTranscript((messages) =>
            appendRealtimeVoiceDelta(
              messages,
              messageId,
              delta,
            ),
          );
        }
      }
      if (message.method === "thread/realtime/transcript/done") {
        const role = params?.role === "user" ? "user" : "assistant";
        const transcript = appServerString(params?.text)?.trim() ?? "";
        if (role === "assistant") {
          const segmented = assistantResponseSegmented.current;
          const segmentTranscript = assistantSegmentText.current.trim();
          if (assistantMessageId.current || (!segmented && transcript)) {
            assistantMessageId.current ??= crypto.randomUUID();
            const messageId = assistantMessageId.current;
            const finalTranscript = segmented ? segmentTranscript : transcript;
            updateTranscript((messages) =>
              finalizeRealtimeVoiceMessage(messages, messageId, finalTranscript),
            );
            persistTranscript(role, messageId, finalTranscript);
          }
          assistantMessageId.current = undefined;
          assistantSegmentText.current = "";
          assistantResponseSegmented.current = false;
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
        const reportError = errorReporter.current;
        const realtimeError =
          message.method === "thread/realtime/error"
            ? (appServerString(params?.message) ??
              translateRef.current("app.realtimeUnavailable"))
            : undefined;
        void terminate(false).then(() => {
          if (realtimeError) {
            reportError(
              translateRef.current("app.audioInterrupted"),
              realtimeError,
            );
          }
        });
      }
      return true;
    },
    [persistTranscript, terminate, updateTranscript],
  );

  return {
    handleConversationEvent,
    recording,
    starting,
    headlessParentThreadId,
    attachHeadlessTranscript,
    attachVisibleTranscript,
    detachVisibleTranscript,
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
      !existingIds.has(realtimeVoiceItemId(message.role, message.id)) &&
      !existingIds.has(realtimeTextItemId(message.id)),
  );
  return additions.length ? [...messages, ...additions] : messages;
}
