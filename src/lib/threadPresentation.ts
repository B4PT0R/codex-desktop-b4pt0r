import type {
  AppServerThread,
  AppServerThreadItem,
  AppServerTurn,
} from "./appServerTypes";
import { applyConversationEvent } from "./conversationEvents";
import type { ChatMessage } from "../types";
import { defaultTranslate, type Translate } from "../i18n/translate";
import {
  isRealtimeTextItemId,
  isRealtimeVoiceItemId,
} from "./realtimeTranscript";
import { scheduledTaskFromPrompt } from "./scheduledTaskMessage";

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
    const items = turn.items ?? [];
    for (const [itemIndex, item] of items.entries()) {
      const itemRunning = isRunningTurnItem(
        turn,
        item,
        itemIndex === items.length - 1,
      );
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
        const scheduledTask = scheduledTaskFromPrompt(text);
        messages = [
          ...messages,
          {
            id: item.id,
            role: "user",
            content: scheduledTask?.prompt ?? text,
            ...(scheduledTask
              ? {
                  modality: "scheduledTask" as const,
                  title: scheduledTask.name,
                }
              : {}),
            ...(attachments.length > 0 ? { attachments } : {}),
            ...(skills.length > 0 ? { skills } : {}),
          },
        ];
        continue;
      }
      if (item.type === "agentMessage") {
        const text = item.text ?? "";
        if (!text.trim()) continue;
        messages = [
          ...messages,
          {
            id: item.id,
            role: "assistant",
            content: text,
            ...(item.phase === "commentary" || item.phase === "final_answer"
              ? { phase: item.phase }
              : {}),
            ...(isRealtimeVoiceItemId(item.id)
              ? { modality: "realtimeVoice" as const }
              : isRealtimeTextItemId(item.id)
                ? { modality: "realtimeText" as const }
              : {}),
            ...(itemRunning ? { streaming: true } : {}),
          },
        ];
        continue;
      }
      messages = applyConversationEvent(
        messages,
        { method: "item/started", params: { item } },
        t,
      );
      if (itemRunning) continue;
      messages = applyConversationEvent(
        messages,
        {
          method: "item/completed",
          params: {
            item,
            startedAtMs: item.startedAtMs,
            completedAtMs: item.completedAtMs,
          },
        },
        t,
      );
    }
    if (turn.status === "failed" && turn.error?.message) {
      messages = [
        ...messages,
        {
          id: `turn-error-${turn.id ?? crypto.randomUUID()}`,
          role: "assistant",
          modality: "applicationError",
          title: t("thread.replayedTurnFailed"),
          content: turn.error.message,
        },
      ];
    }
  }
  return messages;
}

function isRunningTurnItem(
  turn: AppServerTurn,
  item: AppServerThreadItem,
  last: boolean,
) {
  if (turn.status !== "inProgress" || item.type === "userMessage") return false;
  const status = typeof item.status === "string" ? item.status : undefined;
  if (status === "inProgress" || status === "running") return true;
  if (
    status === "completed" ||
    status === "failed" ||
    status === "declined" ||
    status === "interrupted"
  ) {
    return false;
  }
  return last;
}
