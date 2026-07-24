import type { MessageKey } from "../i18n/locales/fr";

export type AgentActivity =
  | "thinking"
  | "talking"
  | "compacting"
  | "working"
  | "waiting"
  | "listening"
  | null;
export function activityFromEvent(
  method: string,
  itemType?: string,
): AgentActivity | undefined {
  if (method === "turn/started") return "working";
  if (
    method === "item/reasoning/summaryTextDelta" ||
    method === "item/reasoning/textDelta" ||
    itemType === "reasoning"
  )
    return "thinking";
  if (method === "item/agentMessage/delta") return "talking";
  if (method === "thread/compacted") return "compacting";
  if (
    method.endsWith("/requestApproval") ||
    method === "item/tool/requestUserInput"
  )
    return "waiting";
  if (
    method === "thread/realtime/started" ||
    method === "thread/realtime/transcript/delta"
  )
    return "listening";
  if (
    method === "item/started" &&
    itemType !== "agentMessage" &&
    itemType !== "userMessage"
  )
    return "working";
  if (
    method === "turn/completed" ||
    method === "thread/realtime/closed" ||
    method === "thread/realtime/error"
  )
    return null;
  return undefined;
}
export const activityLabelKeys: Record<
  Exclude<AgentActivity, null>,
  MessageKey
> = {
  thinking: "activity.thinking",
  talking: "activity.talking",
  compacting: "activity.compacting",
  working: "activity.working",
  waiting: "activity.waiting",
  listening: "activity.listening",
};
