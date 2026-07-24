import type { MessageKey } from "../i18n/locales/fr";
import type { SettingsSectionId } from "./settingsSections";

export type ComposerCommandId =
  | "model"
  | "permissions"
  | "plan"
  | "review"
  | "new"
  | "compact"
  | "fork"
  | "resume"
  | "status"
  | "usage"
  | "personality"
  | "skills"
  | "mcp"
  | "apps"
  | "plugins"
  | "hooks"
  | "stop"
  | "clear";

export type ComposerCommand = {
  id: ComposerCommandId;
  value: `/${ComposerCommandId}`;
  labelKey: MessageKey;
  requiresThread?: boolean;
  requiresTurn?: boolean;
  settingsSection?: SettingsSectionId;
};

export const composerCommands: ComposerCommand[] = [
  command("model", { settingsSection: "agent" }),
  command("permissions", { settingsSection: "permissions" }),
  command("plan"),
  command("review", { requiresThread: true }),
  command("new"),
  command("compact", { requiresThread: true }),
  command("fork", { requiresThread: true }),
  command("resume"),
  command("status"),
  command("usage", { settingsSection: "account" }),
  command("personality", { settingsSection: "agent" }),
  command("skills", { settingsSection: "plugins" }),
  command("mcp", { settingsSection: "mcp" }),
  command("apps", { settingsSection: "plugins" }),
  command("plugins", { settingsSection: "plugins" }),
  command("hooks", { settingsSection: "hooks" }),
  command("stop", { requiresTurn: true }),
  command("clear"),
];

export function filteredComposerCommands(
  query: string,
  labelFor: (key: MessageKey) => string,
) {
  const needle = query.replace(/^\//, "").trim().toLocaleLowerCase();
  if (!needle) return composerCommands;
  return composerCommands.filter((item) =>
    `${item.value} ${labelFor(item.labelKey)}`
      .toLocaleLowerCase()
      .includes(needle),
  );
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
