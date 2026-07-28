import type { MessageKey } from "../i18n/locales/fr";

export type SettingsSectionId =
  | "general"
  | "browser"
  | "chat"
  | "memory"
  | "remoteControl"
  | "agent"
  | "appearance"
  | "voice"
  | "account"
  | "plugins"
  | "mcp"
  | "permissions"
  | "config"
  | "hooks"
  | "advanced";

type Translate = (key: MessageKey) => string;

type SettingsSectionDefinition = {
  id: SettingsSectionId;
  labelKey: MessageKey;
  keywords: string;
  available: boolean;
};

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  available: boolean;
};

const settingsSectionDefinitions: SettingsSectionDefinition[] = [
  {
    id: "general",
    labelKey: "settings.section.general",
    keywords: "application startup démarrage notifications language langue",
    available: true,
  },
  {
    id: "browser",
    labelKey: "settings.section.browser",
    keywords:
      "web browser navigateur chromium playwright shared partagé mcp internet search recherche cache live indexed indexée",
    available: true,
  },
  {
    id: "chat",
    labelKey: "settings.section.chat",
    keywords:
      "chat conversation feedback detail détail summary summaries résumé résumés reasoning raisonnement",
    available: true,
  },
  {
    id: "memory",
    labelKey: "settings.section.memory",
    keywords: "mémoire memory memories recall souvenir personnalisation",
    available: true,
  },
  {
    id: "remoteControl",
    labelKey: "settings.section.remoteControl",
    keywords:
      "remote control distance appareil device pairing association chatgpt relay relais",
    available: true,
  },
  {
    id: "agent",
    labelKey: "settings.section.agent",
    keywords:
      "global agent default défaut model modèle effort personality personnalité",
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
  {
    id: "permissions",
    labelKey: "settings.section.permissions",
    keywords:
      "global default défaut sandbox approvals approbations profile profil access accès",
    available: true,
  },
  {
    id: "config",
    labelKey: "settings.section.config",
    keywords: "config configuration toml global codex options features modèles",
    available: true,
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
];

export function filteredSettingsSections(
  query: string,
  t: Translate,
): SettingsSection[] {
  const needle = query.trim().toLocaleLowerCase();
  return settingsSectionDefinitions
    .filter((item) =>
      `${t(item.labelKey)} ${item.keywords}`
        .toLocaleLowerCase()
        .includes(needle),
    )
    .map((item) => ({
      id: item.id,
      label: t(item.labelKey),
      available: item.available,
    }));
}

export function settingsSectionLabel(section: SettingsSectionId, t: Translate) {
  const item = settingsSectionDefinitions.find(
    (candidate) => candidate.id === section,
  );
  return item ? t(item.labelKey) : t("settings.title");
}
