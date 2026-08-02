import type { ChatMessage } from "../types";

/** Removes reasoning-only separators without leaving their tool groups split. */
export function messagesForPresentation(
  messages: ChatMessage[],
  showReasoningItems: boolean,
): ChatMessage[] {
  if (showReasoningItems) return messages;

  const presented: ChatMessage[] = [];
  for (const message of messages) {
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
