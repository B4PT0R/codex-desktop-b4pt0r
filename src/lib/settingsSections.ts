import type { MessageKey } from "../i18n/locales/fr";

export type SettingsSectionId =
  | "general"
  | "agent"
  | "appearance"
  | "voice"
  | "account"
  | "plugins"
  | "mcp"
  | "permissions"
  | "git"
  | "hooks"
  | "advanced";

type Translate = (key: MessageKey) => string;

type SettingsGroupDefinition = {
  labelKey: MessageKey;
  items: Array<{
    id: SettingsSectionId;
    labelKey: MessageKey;
    keywords: string;
    available: boolean;
  }>;
};

export type SettingsGroup = {
  label: string;
  items: Array<{
    id: SettingsSectionId;
    label: string;
    available: boolean;
  }>;
};

const settingsGroupDefinitions: SettingsGroupDefinition[] = [
  {
    labelKey: "settings.group.personal",
    items: [
      {
        id: "general",
        labelKey: "settings.section.general",
        keywords: "application startup démarrage notifications language langue",
        available: true,
      },
      {
        id: "agent",
        labelKey: "settings.section.agent",
        keywords: "model modèle effort personality personnalité collaboration",
        available: true,
      },
      {
        id: "appearance",
        labelKey: "settings.section.appearance",
        keywords: "theme thème clair sombre interface font police size taille",
        available: true,
      },
      {
        id: "voice",
        labelKey: "settings.section.voice",
        keywords: "audio realtime microphone micro",
        available: true,
      },
      {
        id: "account",
        labelKey: "settings.section.account",
        keywords: "login connexion limits quotas usage billing facturation",
        available: true,
      },
    ],
  },
  {
    labelKey: "settings.group.integrations",
    items: [
      {
        id: "plugins",
        labelKey: "settings.section.plugins",
        keywords: "connectors connecteurs marketplace skills apps",
        available: true,
      },
      {
        id: "mcp",
        labelKey: "settings.section.mcp",
        keywords: "tools outils oauth resources ressources status statut",
        available: true,
      },
    ],
  },
  {
    labelKey: "settings.group.code",
    items: [
      {
        id: "permissions",
        labelKey: "settings.section.permissions",
        keywords: "sandbox approvals approbations profile profil access accès",
        available: true,
      },
      {
        id: "git",
        labelKey: "settings.section.git",
        keywords: "worktree project projet environment environnement",
        available: false,
      },
      {
        id: "hooks",
        labelKey: "settings.section.hooks",
        keywords: "automation automatisation commands commandes",
        available: true,
      },
      {
        id: "advanced",
        labelKey: "settings.section.advanced",
        keywords: "experimental expérimental import diagnostics feedback",
        available: true,
      },
    ],
  },
];

export function settingsGroups(t: Translate): SettingsGroup[] {
  return settingsGroupDefinitions.map((group) => ({
    label: t(group.labelKey),
    items: group.items.map((item) => ({
      id: item.id,
      label: t(item.labelKey),
      available: item.available,
    })),
  }));
}

export function filteredSettingsGroups(query: string, t: Translate) {
  const needle = query.trim().toLocaleLowerCase();
  return settingsGroupDefinitions.flatMap((group) => {
    const items = group.items.filter((item) =>
      `${t(item.labelKey)} ${item.keywords}`
        .toLocaleLowerCase()
        .includes(needle),
    );
    return items.length > 0
      ? [
          {
            label: t(group.labelKey),
            items: items.map((item) => ({
              id: item.id,
              label: t(item.labelKey),
              available: item.available,
            })),
          },
        ]
      : [];
  });
}

export function settingsSectionLabel(section: SettingsSectionId, t: Translate) {
  const item = settingsGroupDefinitions
    .flatMap((group) => group.items)
    .find((candidate) => candidate.id === section);
  return item ? t(item.labelKey) : t("settings.title");
}
