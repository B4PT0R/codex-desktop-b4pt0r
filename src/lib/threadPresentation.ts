import type { AppServerThread, AppServerTurn } from "./appServerTypes";
import { applyConversationEvent } from "./conversationEvents";
import type { ChatMessage } from "../types";
import { defaultTranslate, type Translate } from "../i18n/translate";
import { isRealtimeVoiceItemId } from "./realtimeTranscript";

/** Rebuilds the visible conversation from persisted App Server thread items. */
export function messagesFromThread(
  thread: AppServerThread,
  t: Translate = defaultTranslate,
): ChatMessage[] {
  return messagesFromTurns(thread.turns ?? [], t);
}

/** Rebuilds messages from turns returned newest-first by thread/turns/list. */
export function messagesFromTurnsNewestFirst(
  turns: AppServerTurn[],
  t: Translate = defaultTranslate,
): ChatMessage[] {
  return messagesFromTurns([...turns].reverse(), t);
}

function messagesFromTurns(
  turns: AppServerTurn[],
  t: Translate,
): ChatMessage[] {
  let messages: ChatMessage[] = [];
  for (const turn of turns) {
    for (const item of turn.items ?? []) {
      if (item.type === "userMessage") {
        const content = item.content ?? [];
        const text = content
          .filter((entry) => entry.type === "text")
          .map((entry) => entry.text ?? "")
          .filter(Boolean)
          .join("\n");
        const attachments = content.flatMap((entry) =>
          entry.type === "localImage" && entry.path
            ? [entry.path.split("/").at(-1) ?? entry.path]
            : [],
        );
        const skills = content.flatMap((entry) =>
          entry.type === "skill" && entry.name ? [{ name: entry.name }] : [],
        );
        messages = [
          ...messages,
          {
            id: item.id,
            role: "user",
            content: text,
            ...(attachments.length > 0 ? { attachments } : {}),
            ...(skills.length > 0 ? { skills } : {}),
          },
        ];
        continue;
      }
      if (item.type === "agentMessage") {
        messages = [
          ...messages,
          {
            id: item.id,
            role: "assistant",
            content: item.text ?? "",
            ...(isRealtimeVoiceItemId(item.id)
              ? { modality: "realtimeVoice" as const }
              : {}),
          },
        ];
        continue;
      }
      messages = applyConversationEvent(
        messages,
        { method: "item/started", params: { item } },
        t,
      );
      messages = applyConversationEvent(
        messages,
        { method: "item/completed", params: { item } },
        t,
      );
    }
  }
  return messages;
}
