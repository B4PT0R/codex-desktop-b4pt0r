import type { MessageKey } from "../i18n/locales/fr";

export type SettingsSectionId =
  | "general"
  | "browser"
  | "memory"
  | "remoteControl"
  | "automations"
  | "agent"
  | "appearance"
  | "voice"
  | "account"
  | "apps"
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
    id: "agent",
    labelKey: "settings.section.agent",
    keywords:
      "global agent default défaut model modèle effort personality personnalité service tier fast rapide subagents sous-agents multi-agent",
    available: true,
  },
  {
    id: "permissions",
    labelKey: "settings.section.permissions",
    keywords:
      "global default défaut sandbox approvals approbations reviewer relecteur auto review profile profil access accès",
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
    id: "voice",
    labelKey: "settings.section.voice",
    keywords: "audio realtime microphone micro",
    available: true,
  },
  {
    id: "appearance",
    labelKey: "settings.section.appearance",
    keywords:
      "theme thème clair sombre interface font police size taille chat conversation feedback detail détail summary summaries résumé résumés reasoning raisonnement display affichage",
    available: true,
  },
  {
    id: "automations",
    labelKey: "settings.section.automations",
    keywords:
      "scheduled tasks automations automatisations planifiées récurrentes reminders rappels",
    available: true,
  },
  {
    id: "memory",
    labelKey: "settings.section.memory",
    keywords: "mémoire memory memories recall souvenir personnalisation",
    available: true,
  },
  {
    id: "apps",
    labelKey: "settings.section.apps",
    keywords: "apps connectors connecteurs services data données",
    available: true,
  },
  {
    id: "plugins",
    labelKey: "settings.section.plugins",
    keywords: "plugins marketplace skills capacités capabilities",
    available: true,
  },
  {
    id: "mcp",
    labelKey: "settings.section.mcp",
    keywords: "tools outils oauth resources ressources status statut",
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
    id: "account",
    labelKey: "settings.section.account",
    keywords: "login connexion limits quotas usage billing facturation",
    available: true,
  },
  {
    id: "hooks",
    labelKey: "settings.section.hooks",
    keywords: "automation automatisation commands commandes",
    available: true,
  },
  {
    id: "config",
    labelKey: "settings.section.config",
    keywords:
      "advanced avancée config configuration toml global codex options features modèles",
    available: true,
  },
  {
    id: "advanced",
    labelKey: "settings.section.advanced",
    keywords:
      "import agents migration cursor claude code settings configuration history historique",
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
