import type { ChatMessage } from "../types";

export type RealtimeTranscriptRole = "assistant" | "user";
// Injected Response API message IDs must retain the `msg` prefix when the
// rollout is later submitted as context for a delegated Codex turn, and the
// complete ID must remain within the API's 64-character limit.
const realtimeVoiceItemPrefix = "msg_rtv_";
const realtimeTextItemPrefix = "msg_rtt_";
const oversizedRealtimeVoiceItemPrefix = "msg_realtime_voice_";
const legacyRealtimeVoiceItemPrefix = "realtime_voice_";

export function realtimeVoiceItemId(
  role: RealtimeTranscriptRole,
  messageId: string,
) {
  return `${realtimeVoiceItemPrefix}${role}_${messageId}`;
}

export function isRealtimeVoiceItemId(itemId: string) {
  return (
    itemId.startsWith(realtimeVoiceItemPrefix) ||
    itemId.startsWith(oversizedRealtimeVoiceItemPrefix) ||
    itemId.startsWith(legacyRealtimeVoiceItemPrefix)
  );
}

export function realtimeTextItemId(messageId: string) {
  const itemId = `${realtimeTextItemPrefix}${messageId}`;
  if (itemId.length <= 64) return itemId;
  return `${realtimeTextItemPrefix}${stableIdHash(messageId)}_${messageId.slice(-40)}`;
}

export function isRealtimeTextItemId(itemId: string) {
  return itemId.startsWith(realtimeTextItemPrefix);
}

export function dedupeLiveRealtimeTextPersistence(
  previous: ChatMessage[],
  next: ChatMessage[],
) {
  const sourceIds = new Set(previous.map((message) =>
    realtimeTextItemId(message.id)
  ));
  return next.filter(
    (message) => !isRealtimeTextItemId(message.id) || !sourceIds.has(message.id),
  );
}

function stableIdHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function isVisibleRealtimeTranscript(role: RealtimeTranscriptRole) {
  return role === "assistant" || role === "user";
}

export function realtimeConversationScope(
  eventThreadId: string | undefined,
  realtimeThreadId: string | undefined,
  parentThreadId: string | undefined,
) {
  return eventThreadId !== undefined &&
    eventThreadId === realtimeThreadId &&
    parentThreadId !== undefined
    ? parentThreadId
    : undefined;
}

export function markRealtimeConversationUpdates(
  previous: ChatMessage[],
  next: ChatMessage[],
  preexistingMessageIds: ReadonlySet<string> = new Set(),
) {
  const previousIds = new Set(previous.map((message) => message.id));
  return markRealtimeTextUpdates(
    previous,
    next.filter(
      (message) => message.role !== "user" || previousIds.has(message.id),
    ),
    true,
    preexistingMessageIds,
  );
}

export function markRealtimeTextUpdates(
  previous: ChatMessage[],
  next: ChatMessage[],
  active: boolean,
  preexistingMessageIds: ReadonlySet<string> = new Set(),
) {
  if (!active || previous === next) return next;
  const previousById = new Map(previous.map((message) => [message.id, message]));
  return next.map((message) => {
    const previousMessage = previousById.get(message.id);
    if (
      message.role !== "assistant" ||
      !message.content ||
      message.modality ||
      preexistingMessageIds.has(message.id) ||
      previousMessage === message
    )
      return message;
    return { ...message, modality: "realtimeText" as const };
  });
}

export function appendRealtimeVoiceDelta(
  messages: ChatMessage[],
  messageId: string,
  delta: string,
) {
  if (!delta) return messages;
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0)
    return [
      ...messages,
      {
        id: messageId,
        role: "assistant" as const,
        modality: "realtimeVoice" as const,
        content: delta,
        streaming: true,
      },
    ];
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? {
          ...message,
          content: message.content + delta,
          streaming: true,
        }
      : message,
  );
}

export function appendRealtimeUserDelta(
  messages: ChatMessage[],
  messageId: string,
  delta: string,
) {
  if (!delta) return messages;
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0)
    return [
      ...messages,
      {
        id: messageId,
        role: "user" as const,
        content: delta,
        streaming: true,
      },
    ];
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? {
          ...message,
          content: message.content + delta,
          streaming: true,
        }
      : message,
  );
}

export function reserveRealtimeUserMessage(
  messages: ChatMessage[],
  messageId: string,
) {
  if (messages.some((message) => message.id === messageId)) return messages;
  return [
    ...messages,
    {
      id: messageId,
      role: "user" as const,
      content: "",
      streaming: true,
    },
  ];
}

export function finalizeRealtimeVoiceMessage(
  messages: ChatMessage[],
  messageId: string,
  transcript: string,
) {
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0)
    return transcript
      ? [
          ...messages,
          {
            id: messageId,
            role: "assistant" as const,
            modality: "realtimeVoice" as const,
            content: transcript,
            streaming: false,
          },
        ]
      : messages;
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? {
          ...message,
          content: transcript || message.content,
          streaming: false,
        }
      : message,
  );
}

export function finalizeRealtimeUserMessage(
  messages: ChatMessage[],
  messageId: string,
  transcript: string,
) {
  const index = messages.findIndex((message) => message.id === messageId);
  if (index < 0)
    return transcript
      ? [
          ...messages,
          {
            id: messageId,
            role: "user" as const,
            content: transcript,
            streaming: false,
          },
        ]
      : messages;
  return messages.map((message, messageIndex) =>
    messageIndex === index
      ? {
          ...message,
          content: transcript || message.content,
          streaming: false,
        }
      : message,
  );
}

export function finalizeInterruptedRealtimeMessages(
  messages: ChatMessage[],
  voiceMessageId?: string,
  userMessageId?: string,
) {
  let next = messages;
  if (voiceMessageId)
    next = finalizeRealtimeVoiceMessage(next, voiceMessageId, "");
  if (userMessageId)
    next = finalizeRealtimeUserMessage(next, userMessageId, "");
  return next;
}
