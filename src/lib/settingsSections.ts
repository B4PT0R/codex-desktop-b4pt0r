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
  | "skills"
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
  group: SettingsSectionGroupId;
};

export type SettingsSectionGroupId = "application" | "agents" | "extensions" | "advanced";

export type SettingsSection = {
  id: SettingsSectionId;
  label: string;
  available: boolean;
  group: SettingsSectionGroupId;
};

const settingsSectionDefinitions: SettingsSectionDefinition[] = [
  {
    id: "general",
    labelKey: "settings.section.general",
    keywords: "application startup démarrage notifications language langue",
    available: true,
    group: "application",
  },
  {
    id: "account",
    labelKey: "settings.section.account",
    keywords: "login connexion limits quotas usage billing facturation",
    available: true,
    group: "application",
  },
  {
    id: "appearance",
    labelKey: "settings.section.appearance",
    keywords:
      "theme thème clair sombre interface font police size taille chat conversation feedback detail détail summary summaries résumé résumés reasoning raisonnement display affichage",
    available: true,
    group: "application",
  },
  {
    id: "remoteControl",
    labelKey: "settings.section.remoteControl",
    keywords:
      "remote control distance appareil device pairing association chatgpt relay relais",
    available: true,
    group: "application",
  },
  {
    id: "agent",
    labelKey: "settings.section.agent",
    keywords:
      "global agent default défaut model modèle effort personality personnalité service tier fast rapide subagents sous-agents multi-agent",
    available: true,
    group: "agents",
  },
  {
    id: "permissions",
    labelKey: "settings.section.permissions",
    keywords:
      "global default défaut sandbox approvals approbations reviewer relecteur auto review profile profil access accès",
    available: true,
    group: "agents",
  },
  {
    id: "browser",
    labelKey: "settings.section.browser",
    keywords:
      "web browser navigateur chromium playwright shared partagé mcp internet search recherche cache live indexed indexée",
    available: true,
    group: "agents",
  },
  {
    id: "voice",
    labelKey: "settings.section.voice",
    keywords: "audio realtime microphone micro",
    available: true,
    group: "agents",
  },
  {
    id: "memory",
    labelKey: "settings.section.memory",
    keywords: "mémoire memory memories recall souvenir personnalisation",
    available: true,
    group: "agents",
  },
  {
    id: "automations",
    labelKey: "settings.section.automations",
    keywords:
      "scheduled tasks automations automatisations planifiées récurrentes reminders rappels",
    available: true,
    group: "agents",
  },
  {
    id: "skills",
    labelKey: "settings.section.skills",
    keywords: "skills capacités capabilities instructions workflows",
    available: true,
    group: "extensions",
  },
  {
    id: "apps",
    labelKey: "settings.section.apps",
    keywords: "apps connectors connecteurs services data données",
    available: true,
    group: "extensions",
  },
  {
    id: "mcp",
    labelKey: "settings.section.mcp",
    keywords: "tools outils oauth resources ressources status statut",
    available: true,
    group: "extensions",
  },
  {
    id: "plugins",
    labelKey: "settings.section.plugins",
    keywords: "plugins marketplace bundles apps skills mcp",
    available: true,
    group: "extensions",
  },
  {
    id: "hooks",
    labelKey: "settings.section.hooks",
    keywords: "automation automatisation commands commandes",
    available: true,
    group: "extensions",
  },
  {
    id: "config",
    labelKey: "settings.section.config",
    keywords:
      "advanced avancée config configuration toml global codex options features modèles",
    available: true,
    group: "advanced",
  },
  {
    id: "advanced",
    labelKey: "settings.section.advanced",
    keywords:
      "import agents migration cursor claude code settings configuration history historique",
    available: true,
    group: "advanced",
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
      group: item.group,
    }));
}

export function settingsSectionLabel(section: SettingsSectionId, t: Translate) {
  const item = settingsSectionDefinitions.find(
    (candidate) => candidate.id === section,
  );
  return item ? t(item.labelKey) : t("settings.title");
}
