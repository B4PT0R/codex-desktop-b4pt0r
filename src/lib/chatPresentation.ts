import type { ChatMessage } from "../types";

/** Removes reasoning-only separators without leaving their tool groups split. */
export function messagesForPresentation(
  messages: ChatMessage[],
  showReasoningItems: boolean,
): ChatMessage[] {
  const groupedMessages = groupConsecutiveRealtimeVoice(messages);
  if (showReasoningItems) return groupedMessages;

  const presented: ChatMessage[] = [];
  for (const message of groupedMessages) {
    const reasoningSeparator =
      message.role === "assistant" &&
      !message.content.trim() &&
      !message.modality &&
      !message.attachments?.length &&
      !message.skills?.length &&
      !message.memoryCitations?.length &&
      message.signals?.some((signal) => signal.kind === "reasoning") === true;
    const signals = message.signals?.filter(
      (signal) => signal.kind !== "reasoning",
    );
    const normalized = {
      ...message,
      ...(signals?.length ? { signals } : { signals: undefined }),
    };

    if (reasoningSeparator) {
      const previous = presented.at(-1);
      if (previous?.role === "assistant" && normalized.tools?.length) {
        presented[presented.length - 1] = {
          ...previous,
          tools: [...(previous.tools ?? []), ...normalized.tools],
          ...(normalized.signals?.length
            ? { signals: [...(previous.signals ?? []), ...normalized.signals] }
            : {}),
        };
        continue;
      }
      if (!hasVisibleContent(normalized)) continue;
    }
    presented.push(normalized);
  }
  return presented;
}

function groupConsecutiveRealtimeVoice(messages: ChatMessage[]) {
  let grouped: ChatMessage[] | undefined;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = grouped?.at(-1) ?? messages[index - 1];
    const merge =
      previous?.role === "assistant" &&
      previous.modality === "realtimeVoice" &&
      message.role === "assistant" &&
      message.modality === "realtimeVoice";
    if (!merge) {
      if (grouped) grouped.push(message);
      continue;
    }
    if (previous) {
      grouped ??= messages.slice(0, index);
      grouped[grouped.length - 1] = {
        ...previous,
        content: [previous.content.trimEnd(), message.content.trimStart()]
          .filter(Boolean)
          .join("\n\n"),
        streaming: Boolean(previous.streaming || message.streaming),
      };
    }
  }
  return grouped ?? messages;
}

function hasVisibleContent(message: ChatMessage) {
  return Boolean(
    message.content.trim() ||
      message.modality ||
      message.tools?.length ||
      message.signals?.length ||
      message.attachments?.length ||
      message.skills?.length ||
      message.memoryCitations?.length,
  );
}
