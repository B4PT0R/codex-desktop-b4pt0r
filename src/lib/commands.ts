import type { MessageKey } from "../i18n/locales/fr";

export type ComposerCommandId =
  | "model"
  | "reasoning"
  | "fast"
  | "plan"
  | "permissions"
  | "approvals"
  | "approve"
  | "review"
  | "init"
  | "compact"
  | "goal"
  | "copy"
  | "status"
  | "ps"
  | "stop"
  | "clear";

export type ComposerCommand = {
  id: ComposerCommandId;
  value: `/${ComposerCommandId}`;
  labelKey: MessageKey;
  availableDuringTask?: boolean;
  requiresThread?: boolean;
};

export type ComposerCommandChoiceRequest = {
  id: number;
  command: "/model" | "/reasoning" | "/permissions" | "/approvals" | "/approve";
  stage: "model" | "effort" | "permission" | "approval" | "autoReview";
  choices: Array<{
    id: string;
    label: string;
    detail?: string;
    selected?: boolean;
    disabled?: boolean;
  }>;
};

export type HeaderCommandRequest = {
  id: number;
  target: "agents" | "goal";
};

export const composerCommands: ComposerCommand[] = [
  command("model", { availableDuringTask: true }),
  command("reasoning", { availableDuringTask: true }),
  command("fast"),
  command("plan"),
  command("permissions", { availableDuringTask: true }),
  command("approvals", { availableDuringTask: true }),
  command("approve", { availableDuringTask: true, requiresThread: true }),
  command("review", { requiresThread: true }),
  command("init", { requiresThread: true }),
  command("compact", { requiresThread: true }),
  command("goal", { availableDuringTask: true, requiresThread: true }),
  command("copy", { availableDuringTask: true, requiresThread: true }),
  command("status", { availableDuringTask: true }),
  command("ps", { availableDuringTask: true, requiresThread: true }),
  command("stop", { availableDuringTask: true, requiresThread: true }),
  command("clear", { requiresThread: true }),
];

export function filteredComposerCommands(query: string) {
  const needle = query.replace(/^\//, "").trim().toLocaleLowerCase();
  if (!needle) return composerCommands;
  const exact = composerCommands.filter((item) => item.id === needle);
  const prefixes = composerCommands.filter(
    (item) => item.id !== needle && item.id.startsWith(needle),
  );
  return [...exact, ...prefixes];
}

export function commandFromText(text: string) {
  const value = text.trim();
  return composerCommands.find((item) => item.value === value);
}

function command(
  id: ComposerCommandId,
  options: Omit<ComposerCommand, "id" | "value" | "labelKey"> = {},
): ComposerCommand {
  return {
    id,
    value: `/${id}`,
    labelKey: `composer.command.${id}`,
    ...options,
  };
}
