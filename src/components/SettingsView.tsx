import {
  ArrowLeft,
  Bot,
  Brain,
  Boxes,
  FlaskConical,
  FileCog,
  GitBranch,
  Mic,
  Palette,
  Plug,
  RadioTower,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
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
import type {
  ApprovalPolicy,
  FileOpener,
  ModelVerbosity,
  PlanReasoningEffort,
  Permission,
  ReasoningSummaryMode,
  WebSearchMode,
} from "../lib/protocol";
import {
  filteredSettingsGroups,
  settingsSectionLabel,
  type SettingsSectionId,
} from "../lib/settingsSections";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/locales/fr";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
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
import { ExternalAgentImportSettings } from "./ExternalAgentImportSettings";
import type { ExternalAgentImportController } from "../lib/useExternalAgentImport";
import type { RealtimeSettingsController } from "../lib/useRealtimeSettings";
import { VoiceSettings } from "./VoiceSettings";
import { CodexConfigSettings } from "./CodexConfigSettings";
import type { ConfigRequirements } from "../lib/useConfigRequirements";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import type { MemorySettingsController } from "../lib/useMemorySettings";
import { MemorySettings } from "./MemorySettings";
import type { RemoteControlController } from "../lib/useRemoteControl";
import { RemoteControlSettings } from "./RemoteControlSettings";

export type SettingsViewProps = {
  account: AccountController;
  apps: AppsController;
  capabilities: CapabilityCatalog;
  collaborationMode: CollaborationMode;
  configRequirements?: ConfigRequirements & {
    error?: string;
    loading?: boolean;
  };
  effort: string;
  externalAgentImport: ExternalAgentImportController;
  integrations: IntegrationsController;
  model: string;
  models: Model[];
  permission: Permission;
  approvalPolicy: ApprovalPolicy;
  personality: Personality;
  rateLimits: RateLimitsController;
  realtime: RealtimeSettingsController;
  memory: MemorySettingsController;
  remoteControl: RemoteControlController;
  webSearch: CodexGlobalSettingsController;
  appServerRestart: {
    available: boolean;
    error?: string;
    restart: () => Promise<boolean>;
    restarting: boolean;
  };
  section: SettingsSectionId;
  onChangeCollaborationMode: (mode: CollaborationMode) => void;
  onChangeEffort: (effort: string) => void;
  onChangeModel: (model: string) => void;
  onChangePermission: (permission: Permission) => void;
  onChangeApprovalPolicy: (policy: ApprovalPolicy) => void;
  onChangePersonality: (personality: Personality) => void;
  onClose: () => void;
  onSave: () => void;
  onSelectSection: (section: SettingsSectionId) => void;
};

const icons: Record<SettingsSectionId, ComponentType> = {
  general: Settings,
  options: SlidersHorizontal,
  memory: Brain,
  remoteControl: RadioTower,
  agent: Bot,
  appearance: Palette,
  voice: Mic,
  account: UserRound,
  plugins: Boxes,
  mcp: Plug,
  permissions: ShieldCheck,
  config: FileCog,
  git: GitBranch,
  hooks: Webhook,
  advanced: FlaskConical,
};

const webSearchModes: WebSearchMode[] = [
  "cached",
  "indexed",
  "live",
  "disabled",
];
const reasoningSummaryModes: ReasoningSummaryMode[] = [
  "auto",
  "concise",
  "detailed",
  "none",
];
const fileOpeners: FileOpener[] = [
  "vscode",
  "vscode-insiders",
  "cursor",
  "windsurf",
  "none",
];
const modelVerbosities: ModelVerbosity[] = ["low", "medium", "high"];
const planReasoningEfforts: PlanReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

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
  if (props.section === "general")
    return (
      <GeneralSettings
        appServerRestart={props.appServerRestart}
        webSearch={props.webSearch}
      />
    );
  if (props.section === "options")
    return <OptionsSettings webSearch={props.webSearch} />;
  if (props.section === "memory")
    return <MemorySettings controller={props.memory} />;
  if (props.section === "remoteControl")
    return <RemoteControlSettings controller={props.remoteControl} />;
  if (props.section === "agent") return <AgentSettings {...props} />;
  if (props.section === "appearance") return <AppearanceSettings />;
  if (props.section === "voice")
    return <VoiceSettings controller={props.realtime} />;
  if (props.section === "permissions") return <PermissionSettings {...props} />;
  if (props.section === "config") return <CodexConfigSettings />;
  if (props.section === "plugins")
    return (
      <SkillsSettings apps={props.apps} integrations={props.integrations} />
    );
  if (props.section === "mcp")
    return <McpSettings integrations={props.integrations} />;
  if (props.section === "hooks")
    return (
      <HooksSettings
        integrations={props.integrations}
        managedOnly={props.configRequirements?.managedHooksOnly}
      />
    );
  if (props.section === "account")
    return (
      <AccountSettings
        controller={props.account}
        rateLimits={props.rateLimits}
      />
    );
  if (props.section === "advanced")
    return <AdvancedSettings controller={props.externalAgentImport} />;
  return <PlannedSettings section={props.section} />;
}

function AdvancedSettings({
  controller,
}: {
  controller: ExternalAgentImportController;
}) {
  const { t } = useI18n();
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.advanced.description")}</p>
      </header>
      <ExternalAgentImportSettings controller={controller} />
      <div className="settings-card planned-settings">
        {plannedSections.advanced.items.map((item) => (
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

function GeneralSettings({
  appServerRestart,
  webSearch,
}: {
  appServerRestart: SettingsViewProps["appServerRestart"];
  webSearch: CodexGlobalSettingsController;
}) {
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
            <strong>{t("settings.fileOpener.title")}</strong>
            <small>{t("settings.fileOpener.detail")}</small>
          </span>
          <select
            aria-label={t("settings.fileOpener.title")}
            disabled={webSearch.loading}
            value={webSearch.fileOpener}
            onChange={(event) =>
              void webSearch.setFileOpener(event.target.value as FileOpener)
            }
          >
            {fileOpeners.map((opener) => (
              <option key={opener} value={opener}>
                {t(`settings.fileOpener.${opener}`)}
              </option>
            ))}
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
        <div className="settings-browser-row">
          <span className="settings-field-description">
            <strong>{t("settings.appServerRestart.title")}</strong>
            <small>{t("settings.appServerRestart.detail")}</small>
          </span>
          <div className="settings-browser-status">
            <button
              className="app-server-restart-button secondary-button"
              disabled={
                !appServerRestart.available || appServerRestart.restarting
              }
              onClick={() => void appServerRestart.restart()}
            >
              <RefreshCw
                className={appServerRestart.restarting ? "spin" : ""}
              />
              {t(
                appServerRestart.restarting
                  ? "settings.appServerRestart.running"
                  : "settings.appServerRestart.action",
              )}
            </button>
          </div>
        </div>
      </div>
      {persistenceError && (
        <div className="inventory-message error" role="alert">
          {t("settings.persistence.error")} {persistenceError}
        </div>
      )}
      {appServerRestart.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.appServerRestart.error")} {appServerRestart.error}
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

function OptionsSettings({
  webSearch,
}: {
  webSearch: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.options.description")}</p>
      </header>
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("webSearch.title")}</strong>
            <small>{t("webSearch.globalDetail")}</small>
          </span>
          <select
            aria-label={t("webSearch.title")}
            disabled={webSearch.loading || Boolean(webSearch.updating)}
            value={webSearch.mode}
            onChange={(event) =>
              void webSearch.setMode(event.target.value as WebSearchMode)
            }
          >
            {webSearchModes.map((mode) => (
              <option
                disabled={
                  webSearch.allowed !== undefined &&
                  !webSearch.allowed.includes(mode)
                }
                key={mode}
                value={mode}
              >
                {t(`webSearch.${mode}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.reasoningSummary.title")}</strong>
            <small>{t("settings.reasoningSummary.detail")}</small>
          </span>
          <select
            aria-label={t("settings.reasoningSummary.title")}
            disabled={webSearch.loading}
            value={webSearch.reasoningSummary}
            onChange={(event) =>
              void webSearch.setReasoningSummary(
                event.target.value as ReasoningSummaryMode,
              )
            }
          >
            {reasoningSummaryModes.map((mode) => (
              <option key={mode} value={mode}>
                {t(`settings.reasoningSummary.${mode}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {webSearch.error && (
        <div className="inventory-message error" role="alert">
          {t("webSearch.error")} {webSearch.error}
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
              {reasoningEffortLabel(option.reasoningEffort, t)}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("settings.agent.personality")}
          value={props.personality}
          disabled={selectedModel?.supportsPersonality === false}
          disabledReason={t("settings.agent.personalityUnavailable")}
          onChange={(value) =>
            props.onChangePersonality(value as Personality)
          }
        >
          <option value="pragmatic">{t("settings.agent.pragmatic")}</option>
          <option value="friendly">{t("settings.agent.friendly")}</option>
          <option value="none">{t("settings.agent.neutral")}</option>
        </SettingSelect>
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
      <div className="settings-subsection-heading">
        <strong>{t("settings.agent.globalDefaults")}</strong>
        <small>{t("settings.agent.globalDefaultsDetail")}</small>
      </div>
      <div className="settings-card settings-fields">
        <SettingSelect
          label={t("settings.agent.verbosity")}
          value={props.webSearch.modelVerbosity}
          disabled={props.webSearch.loading}
          onChange={(value) =>
            void props.webSearch.setModelVerbosity(value as ModelVerbosity)
          }
        >
          {modelVerbosities.map((verbosity) => (
            <option value={verbosity} key={verbosity}>
              {t(`settings.agent.verbosity.${verbosity}`)}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("settings.agent.planEffort")}
          value={props.webSearch.planReasoningEffort}
          disabled={props.webSearch.loading}
          onChange={(value) =>
            void props.webSearch.setPlanReasoningEffort(
              value as PlanReasoningEffort,
            )
          }
        >
          {planReasoningEfforts.map((effort) => (
            <option value={effort} key={effort}>
              {reasoningEffortLabel(effort, t)}
            </option>
          ))}
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
      {props.configRequirements?.managed && (
        <div className="inventory-message neutral" role="status">
          {t("settings.requirements.permissions")}
          {props.configRequirements.defaultPermission
            ? ` ${t("settings.requirements.default", {
                profile: permissionLabel(
                  props.configRequirements.defaultPermission,
                  t,
                ),
              })}`
            : ""}
        </div>
      )}
      {props.configRequirements?.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.requirements.error")}
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
              disabled={
                !profile.allowed ||
                props.configRequirements?.allowedPermissionProfiles?.[
                  profile.id
                ] === false
              }
            >
              {permissionLabel(profile.id, t)}
              {!profile.allowed ||
              props.configRequirements?.allowedPermissionProfiles?.[
                profile.id
              ] === false
                ? ` — ${t("settings.permissions.notAllowed")}`
                : ""}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("approvalPolicy.title")}
          value={props.approvalPolicy}
          onChange={(value) =>
            props.onChangeApprovalPolicy(value as ApprovalPolicy)
          }
        >
          {(["untrusted", "on-request", "never"] as const).map((policy) => (
            <option
              disabled={
                props.configRequirements?.allowedApprovalPolicies !==
                  undefined &&
                !props.configRequirements.allowedApprovalPolicies.includes(
                  policy,
                )
              }
              key={policy}
              value={policy}
            >
              {t(`approvalPolicy.${policy}`)}
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
  disabled = false,
  disabledReason,
  onChange,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

const plannedSections: Record<
  Exclude<
    SettingsSectionId,
    | "general"
    | "options"
    | "memory"
    | "remoteControl"
    | "agent"
    | "appearance"
    | "voice"
    | "permissions"
    | "config"
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
        title: "settings.advanced.diagnostics",
        detail: "settings.advanced.diagnosticsDetail",
      },
    ],
  },
};

function permissionLabel(id: string, t: (key: MessageKey) => string) {
  if (id === ":read-only") return t("settings.permissions.readOnly");
  if (id === ":workspace") return t("settings.permissions.workspace");
  if (id === ":danger-full-access") return t("settings.permissions.fullAccess");
  return id;
}
