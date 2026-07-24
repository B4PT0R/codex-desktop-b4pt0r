import {
  ArrowLeft,
  Bot,
  Boxes,
  FlaskConical,
  GitBranch,
  Mic,
  Palette,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Webhook,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { Permission } from "../lib/protocol";
import {
  filteredSettingsGroups,
  settingsSectionLabel,
  type SettingsSectionId,
} from "../lib/settingsSections";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/locales/fr";
import type { CollaborationMode, Model, Personality } from "../types";
import type { IntegrationsController } from "../lib/useIntegrations";
import { McpSettings, SkillsSettings } from "./IntegrationSettings";
import type { CapabilityCatalog } from "../lib/useCapabilityCatalog";
import type { AccountController } from "../lib/useAccount";
import { AccountSettings } from "./AccountSettings";
import type { AppsController } from "../lib/useApps";
import type { RateLimitsController } from "../lib/useRateLimits";
import { useLaunchAtLogin } from "../lib/useLaunchAtLogin";
import { useChromium } from "../lib/useChromium";
import { AppearanceSettings } from "./AppearanceSettings";
import { HooksSettings } from "./HooksSettings";

export type SettingsViewProps = {
  account: AccountController;
  apps: AppsController;
  capabilities: CapabilityCatalog;
  collaborationMode: CollaborationMode;
  effort: string;
  integrations: IntegrationsController;
  model: string;
  models: Model[];
  permission: Permission;
  personality: Personality;
  rateLimits: RateLimitsController;
  section: SettingsSectionId;
  onChangeCollaborationMode: (mode: CollaborationMode) => void;
  onChangeEffort: (effort: string) => void;
  onChangeModel: (model: string) => void;
  onChangePermission: (permission: Permission) => void;
  onChangePersonality: (personality: Personality) => void;
  onClose: () => void;
  onSave: () => void;
  onSelectSection: (section: SettingsSectionId) => void;
};

const icons: Record<SettingsSectionId, ComponentType> = {
  general: Settings,
  agent: Bot,
  appearance: Palette,
  voice: Mic,
  account: UserRound,
  plugins: Boxes,
  mcp: Plug,
  permissions: ShieldCheck,
  git: GitBranch,
  hooks: Webhook,
  advanced: FlaskConical,
};

export function SettingsView(props: SettingsViewProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const groups = filteredSettingsGroups(query, t);
  useEffect(() => heading.current?.focus(), [props.section]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [props.onClose]);

  return (
    <div className="settings-view">
      <aside
        className="settings-navigation"
        aria-label={t("settings.navigation")}
      >
        <button className="settings-back" onClick={props.onClose}>
          <ArrowLeft /> {t("settings.back")}
        </button>
        <label className="settings-search">
          <Search />
          <input
            value={query}
            placeholder={t("settings.search")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <nav>
          {groups.map((group) => (
            <section key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((item) => {
                const Icon = icons[item.id];
                return (
                  <button
                    key={item.id}
                    aria-current={
                      props.section === item.id ? "page" : undefined
                    }
                    onClick={() => props.onSelectSection(item.id)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                    {!item.available && <small>{t("settings.planned")}</small>}
                  </button>
                );
              })}
            </section>
          ))}
          {groups.length === 0 && <p>{t("settings.noResults")}</p>}
        </nav>
      </aside>
      <main className="settings-content">
        <h1 ref={heading} tabIndex={-1}>
          {settingsSectionLabel(props.section, t)}
        </h1>
        <SettingsSection {...props} />
      </main>
    </div>
  );
}

function SettingsSection(props: SettingsViewProps) {
  if (props.section === "general") return <GeneralSettings />;
  if (props.section === "agent") return <AgentSettings {...props} />;
  if (props.section === "appearance") return <AppearanceSettings />;
  if (props.section === "permissions") return <PermissionSettings {...props} />;
  if (props.section === "plugins")
    return (
      <SkillsSettings apps={props.apps} integrations={props.integrations} />
    );
  if (props.section === "mcp")
    return <McpSettings integrations={props.integrations} />;
  if (props.section === "hooks")
    return <HooksSettings integrations={props.integrations} />;
  if (props.section === "account")
    return (
      <AccountSettings
        controller={props.account}
        rateLimits={props.rateLimits}
      />
    );
  return <PlannedSettings section={props.section} />;
}

function GeneralSettings() {
  const { locale, persistenceError, setLocale, t } = useI18n();
  const launchAtLogin = useLaunchAtLogin();
  const chromium = useChromium();
  const [confirmChromiumInstall, setConfirmChromiumInstall] = useState(false);
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.general.description")}</p>
      </header>
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.language.title")}</strong>
            <small>{t("settings.language.detail")}</small>
          </span>
          <select
            value={locale}
            aria-label={t("settings.language.title")}
            onChange={(event) =>
              setLocale(event.target.value === "en" ? "en" : "fr")
            }
          >
            <option value="fr">{t("settings.language.french")}</option>
            <option value="en">{t("settings.language.english")}</option>
          </select>
        </label>
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.startup.title")}</strong>
            <small>{t("settings.startup.detail")}</small>
          </span>
          <span className="startup-toggle">
            <input
              type="checkbox"
              checked={launchAtLogin.enabled}
              disabled={!launchAtLogin.available || launchAtLogin.loading}
              aria-label={t("settings.startup.title")}
              onChange={(event) =>
                void launchAtLogin.setEnabled(event.target.checked)
              }
            />
            {launchAtLogin.available
              ? t(
                  launchAtLogin.enabled
                    ? "settings.startup.enabled"
                    : "settings.startup.disabled",
                )
              : t("settings.startup.nativeOnly")}
          </span>
        </label>
        <div className="settings-browser-row">
          <span className="settings-field-description">
            <strong>{t("settings.chromium.title")}</strong>
            <small>{t("settings.chromium.detail")}</small>
          </span>
          <div className="settings-browser-status">
            {!chromium.native ? (
              <small>{t("settings.chromium.nativeOnly")}</small>
            ) : chromium.status?.available ? (
              <>
                <strong>{t("settings.chromium.available")}</strong>
                <small>{chromium.status.version}</small>
              </>
            ) : chromium.status?.installing ? (
              <button onClick={() => void chromium.cancelInstall()}>
                {t("settings.chromium.cancel")}
              </button>
            ) : confirmChromiumInstall ? (
              <div className="settings-browser-confirm" role="group">
                <small>
                  {t("settings.chromium.confirm", {
                    package: chromium.status?.installPackage ?? "Chromium",
                  })}
                </small>
                <span>
                  <button
                    className="secondary-button"
                    onClick={() => setConfirmChromiumInstall(false)}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    disabled={!chromium.status?.installSupported}
                    onClick={() => {
                      setConfirmChromiumInstall(false);
                      void chromium.install();
                    }}
                  >
                    {t("common.confirm")}
                  </button>
                </span>
              </div>
            ) : (
              <button
                disabled={chromium.loading || !chromium.status?.installSupported}
                onClick={() => setConfirmChromiumInstall(true)}
              >
                {t("settings.chromium.install")}
              </button>
            )}
          </div>
        </div>
      </div>
      {persistenceError && (
        <div className="inventory-message error" role="alert">
          {t("settings.persistence.error")} {persistenceError}
        </div>
      )}
      {launchAtLogin.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.startup.error")} {launchAtLogin.error}
        </div>
      )}
      {chromium.native &&
        !chromium.loading &&
        !chromium.status?.available &&
        !chromium.status?.installSupported && (
          <div className="inventory-message" role="status">
            {t("settings.chromium.unsupported")}
          </div>
        )}
      {chromium.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.chromium.error")} {chromium.error}
        </div>
      )}
    </section>
  );
}

function PlannedSettings({
  section,
}: {
  section: keyof typeof plannedSections;
}) {
  const { t } = useI18n();
  const planned = plannedSections[section];
  return (
    <section className="settings-page">
      <header>
        <p>{t(planned.description)}</p>
        <span className="planned-badge">
          {t("settings.plannedArchitecture")}
        </span>
      </header>
      <div className="settings-card planned-settings">
        {planned.items.map((item) => (
          <div key={item.title}>
            <span>
              <strong>{t(item.title)}</strong>
              <small>{t(item.detail)}</small>
            </span>
            <em>{t("settings.toConnect")}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentSettings(props: SettingsViewProps) {
  const { t } = useI18n();
  const selectedModel = props.models.find(
    (candidate) => candidate.id === props.model,
  );
  const efforts = selectedModel?.supportedReasoningEfforts ?? [
    { reasoningEffort: props.effort, description: "" },
  ];
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.agent.description")}</p>
        <span className="scope-badge">{t("settings.currentConversation")}</span>
      </header>
      {props.capabilities.collaborationModes.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.agent.presetsUnavailable")}
        </div>
      )}
      <div className="settings-card settings-fields">
        <SettingSelect
          label={t("settings.agent.model")}
          value={props.model}
          onChange={props.onChangeModel}
        >
          {props.models.map((model) => (
            <option value={model.id} key={model.id}>
              {model.label}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("settings.agent.effort")}
          value={props.effort}
          onChange={props.onChangeEffort}
        >
          {efforts.map((option) => (
            <option value={option.reasoningEffort} key={option.reasoningEffort}>
              {effortLabel(option.reasoningEffort, t)}
            </option>
          ))}
        </SettingSelect>
        {selectedModel?.supportsPersonality && (
          <SettingSelect
            label={t("settings.agent.personality")}
            value={props.personality}
            onChange={(value) =>
              props.onChangePersonality(value as Personality)
            }
          >
            <option value="pragmatic">{t("settings.agent.pragmatic")}</option>
            <option value="friendly">{t("settings.agent.friendly")}</option>
            <option value="none">{t("settings.agent.neutral")}</option>
          </SettingSelect>
        )}
        <SettingSelect
          label={t("settings.agent.workMode")}
          value={props.collaborationMode}
          onChange={(value) => {
            const preset = props.capabilities.collaborationModes.data.find(
              (candidate) => candidate.mode === value,
            );
            props.onChangeCollaborationMode(value as CollaborationMode);
            if (preset?.reasoning_effort)
              props.onChangeEffort(preset.reasoning_effort);
          }}
        >
          {props.capabilities.collaborationModes.data.flatMap((preset) =>
            preset.mode ? (
              <option value={preset.mode} key={preset.mode}>
                {preset.name === "Default"
                  ? t("settings.agent.defaultMode")
                  : preset.name}
              </option>
            ) : (
              []
            ),
          )}
        </SettingSelect>
      </div>
      <button className="settings-apply" onClick={props.onSave}>
        {t("settings.apply")}
      </button>
    </section>
  );
}

function PermissionSettings(props: SettingsViewProps) {
  const { t } = useI18n();
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.permissions.description")}</p>
        <span className="scope-badge">{t("settings.currentConversation")}</span>
      </header>
      {props.capabilities.permissionProfiles.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.permissions.catalogUnavailable")}
        </div>
      )}
      <div className="settings-card settings-fields">
        <SettingSelect
          label={t("settings.permissions.profile")}
          value={props.permission}
          onChange={props.onChangePermission}
        >
          {props.capabilities.permissionProfiles.data.map((profile) => (
            <option
              value={profile.id}
              key={profile.id}
              disabled={!profile.allowed}
            >
              {permissionLabel(profile.id, t)}
              {!profile.allowed
                ? ` — ${t("settings.permissions.notAllowed")}`
                : ""}
            </option>
          ))}
        </SettingSelect>
        <div className="settings-explanation">
          <ShieldCheck />
          <span>
            <strong>{t("settings.permissions.sensitiveTitle")}</strong>
            <small>{t("settings.permissions.sensitiveDetail")}</small>
          </span>
        </div>
      </div>
      <button className="settings-apply" onClick={props.onSave}>
        {t("settings.apply")}
      </button>
    </section>
  );
}

function SettingSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

const plannedSections: Record<
  Exclude<
    SettingsSectionId,
    | "general"
    | "agent"
    | "appearance"
    | "permissions"
    | "plugins"
    | "mcp"
    | "hooks"
    | "account"
  >,
  {
    description: MessageKey;
    items: Array<{ title: MessageKey; detail: MessageKey }>;
  }
> = {
  voice: {
    description: "settings.voice.description",
    items: [
      {
        title: "settings.voice.microphone",
        detail: "settings.voice.microphoneDetail",
      },
      { title: "settings.voice.voice", detail: "settings.voice.voiceDetail" },
    ],
  },
  git: {
    description: "settings.git.description",
    items: [
      {
        title: "settings.git.repository",
        detail: "settings.git.repositoryDetail",
      },
      {
        title: "settings.git.worktrees",
        detail: "settings.git.worktreesDetail",
      },
    ],
  },
  advanced: {
    description: "settings.advanced.description",
    items: [
      {
        title: "settings.advanced.experimental",
        detail: "settings.advanced.experimentalDetail",
      },
      {
        title: "settings.advanced.import",
        detail: "settings.advanced.importDetail",
      },
      {
        title: "settings.advanced.diagnostics",
        detail: "settings.advanced.diagnosticsDetail",
      },
    ],
  },
};

function effortLabel(effort: string, t: (key: MessageKey) => string) {
  return (
    (
      {
        none: t("settings.effort.minimal"),
        minimal: t("settings.effort.minimal"),
        low: t("settings.effort.low"),
        medium: t("settings.effort.medium"),
        high: t("settings.effort.high"),
        xhigh: t("settings.effort.xhigh"),
        ultra: t("settings.effort.ultra"),
      } as Record<string, string>
    )[effort] ?? effort
  );
}

function permissionLabel(id: string, t: (key: MessageKey) => string) {
  if (id === ":read-only") return t("settings.permissions.readOnly");
  if (id === ":workspace") return t("settings.permissions.workspace");
  if (id === ":danger-full-access") return t("settings.permissions.fullAccess");
  return id;
}
