import {
  ArrowLeft,
  Bot,
  Brain,
  Boxes,
  FlaskConical,
  FileCog,
  Globe2,
  Mic,
  MessageSquare,
  Palette,
  Plug,
  RadioTower,
  RefreshCw,
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
import type {
  FileOpener,
  ModelVerbosity,
  PlanReasoningEffort,
  ReasoningSummaryMode,
  WebSearchMode,
} from "../lib/protocol";
import {
  filteredSettingsSections,
  settingsSectionLabel,
  type SettingsSectionId,
} from "../lib/settingsSections";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/locales/fr";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
import type { Model, Personality } from "../types";
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
import { RoundIconButton } from "./RoundIcon";

export type SettingsViewProps = {
  account: AccountController;
  apps: AppsController;
  capabilities: CapabilityCatalog;
  configRequirements?: ConfigRequirements & {
    error?: string;
    loading?: boolean;
  };
  externalAgentImport: ExternalAgentImportController;
  integrations: IntegrationsController;
  models: Model[];
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
  onClose: () => void;
  onSelectSection: (section: SettingsSectionId) => void;
};

const icons: Record<SettingsSectionId, ComponentType> = {
  general: Settings,
  browser: Globe2,
  chat: MessageSquare,
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
  const sections = filteredSettingsSections(query, t);
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
        <RoundIconButton
          className="settings-back"
          icon={ArrowLeft}
          label={t("settings.back")}
          onClick={props.onClose}
          variant="tertiary"
        />
        <label className="settings-search">
          <Search />
          <input
            value={query}
            placeholder={t("settings.search")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <nav>
          {sections.map((item) => (
            <RoundIconButton
              key={item.id}
              aria-current={props.section === item.id ? "page" : undefined}
              gap="large"
              icon={icons[item.id]}
              label={
                <>
                  <span>{item.label}</span>
                  {!item.available && <small>{t("settings.planned")}</small>}
                </>
              }
              onClick={() => props.onSelectSection(item.id)}
              size="large"
              variant="tertiary"
            />
          ))}
          {sections.length === 0 && <p>{t("settings.noResults")}</p>}
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
  if (props.section === "browser")
    return (
      <BrowserSettings
        integrations={props.integrations}
        webSearch={props.webSearch}
      />
    );
  if (props.section === "chat")
    return <ChatSettings webSearch={props.webSearch} />;
  if (props.section === "memory")
    return <MemorySettings controller={props.memory} />;
  if (props.section === "remoteControl")
    return <RemoteControlSettings controller={props.remoteControl} />;
  if (props.section === "agent") return <AgentSettings {...props} />;
  if (props.section === "appearance") return <AppearanceSettings />;
  if (props.section === "voice")
    return <VoiceSettings controller={props.realtime} />;
  if (props.section === "permissions") return <PermissionSettings {...props} />;
  if (props.section === "config")
    return <CodexConfigSettings globalSettings={props.webSearch} />;
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
    </section>
  );
}

function BrowserSettings({
  integrations,
  webSearch,
}: {
  integrations: IntegrationsController;
  webSearch: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  const chromium = useChromium();
  const [confirmInstall, setConfirmInstall] = useState(false);

  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.browser.description")}</p>
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
      </div>
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.browser.enabledTitle")}</strong>
            <small>{t("settings.browser.enabledDetail")}</small>
          </span>
          <span className="startup-toggle">
            <input
              type="checkbox"
              checked={chromium.status?.enabled === true}
              disabled={
                !chromium.native ||
                chromium.loading ||
                chromium.status?.installing === true
              }
              aria-label={t("settings.browser.enabledTitle")}
              onChange={(event) => {
                if (event.target.checked) setConfirmInstall(true);
                else void chromium.disable(integrations.reloadMcp);
              }}
            />
            {t(
              chromium.status?.enabled
                ? "settings.browser.enabled"
                : "settings.browser.disabled",
            )}
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
            ) : chromium.status?.enabled &&
              chromium.status.available &&
              chromium.status.running ? (
              <>
                <strong>{t("settings.chromium.ready")}</strong>
                <small>
                  {[chromium.status.version, chromium.status.mcpVersion
                    ? `MCP ${chromium.status.mcpVersion}`
                    : undefined]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                <button
                  className="secondary-button"
                  disabled={chromium.loading}
                  onClick={() => void chromium.install(integrations.reloadMcp)}
                >
                  {t("settings.chromium.repair")}
                </button>
              </>
            ) : chromium.status?.enabled && chromium.status.available ? (
              <>
                <strong>{t("settings.chromium.needsRepair")}</strong>
                <button
                  className="secondary-button"
                  disabled={chromium.loading}
                  onClick={() => void chromium.install(integrations.reloadMcp)}
                >
                  {t("settings.chromium.repair")}
                </button>
              </>
            ) : chromium.status?.installing ? (
              <button onClick={() => void chromium.cancelInstall()}>
                {t("settings.chromium.cancel")}
              </button>
            ) : confirmInstall ? (
              <div className="settings-browser-confirm" role="group">
                <small>{t("settings.chromium.confirm")}</small>
                <span>
                  <button
                    className="secondary-button"
                    onClick={() => setConfirmInstall(false)}
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    disabled={!chromium.status?.installSupported}
                    onClick={() => {
                      setConfirmInstall(false);
                      void chromium.install(integrations.reloadMcp);
                    }}
                  >
                    {t("common.confirm")}
                  </button>
                </span>
              </div>
            ) : (
              <small>
                {chromium.status?.available
                  ? t("settings.browser.installedInactive")
                  : t("settings.browser.downloadOnEnable")}
              </small>
            )}
          </div>
        </div>
      </div>
      <div className="settings-card">
        <div className="settings-explanation">
          <span>
            <strong>{t("settings.browser.routingTitle")}</strong>
            <small>{t("settings.browser.routingDetail")}</small>
          </span>
        </div>
      </div>
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
      {webSearch.error && (
        <div className="inventory-message error" role="alert">
          {t("webSearch.error")} {webSearch.error}
        </div>
      )}
    </section>
  );
}

function ChatSettings({
  webSearch,
}: {
  webSearch: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.chat.description")}</p>
      </header>
      <div className="settings-card settings-fields">
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
  const defaults = props.webSearch.advanced;
  const selectedModel = props.models.find(
    (candidate) => candidate.id === defaults.model,
  );
  const efforts =
    selectedModel?.supportedReasoningEfforts?.map(
      (option) => option.reasoningEffort,
    ) ?? planReasoningEfforts.filter((effort) => effort !== "none");
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.agent.description")}</p>
        <span className="scope-badge">{t("settings.config.global")}</span>
      </header>
      <div className="settings-card settings-fields">
        <SettingSelect
          label={t("settings.agent.model")}
          value={defaults.model ?? ""}
          disabled={props.webSearch.loading}
          onChange={(value) =>
            void props.webSearch.setAdvanced("model", value || null)
          }
        >
          <option value="">{t("settings.global.automatic")}</option>
          {props.models.map((model) => (
            <option value={model.id} key={model.id}>
              {model.label}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("settings.agent.effort")}
          value={defaults.modelReasoningEffort ?? ""}
          disabled={props.webSearch.loading}
          onChange={(value) =>
            void props.webSearch.setAdvanced(
              "model_reasoning_effort",
              value || null,
            )
          }
        >
          <option value="">{t("settings.global.automatic")}</option>
          {efforts.map((effort) => (
            <option value={effort} key={effort}>
              {reasoningEffortLabel(effort, t)}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("settings.agent.personality")}
          value={defaults.personality ?? ""}
          disabled={props.webSearch.loading}
          onChange={(value) =>
            void props.webSearch.setAdvanced(
              "personality",
              value || null,
            )
          }
        >
          <option value="">{t("settings.global.automatic")}</option>
          <option value="pragmatic">{t("settings.agent.pragmatic")}</option>
          <option value="friendly">{t("settings.agent.friendly")}</option>
          <option value="none">{t("settings.agent.neutral")}</option>
        </SettingSelect>
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
      {props.webSearch.error && (
        <div className="inventory-message error" role="alert">
          {props.webSearch.error}
        </div>
      )}
    </section>
  );
}

function PermissionSettings(props: SettingsViewProps) {
  const { t } = useI18n();
  const defaults = props.webSearch.advanced;
  const knownPermission = props.capabilities.permissionProfiles.data.some(
    (profile) => profile.id === defaults.defaultPermissions,
  );
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.permissions.description")}</p>
        <span className="scope-badge">{t("settings.config.global")}</span>
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
          value={defaults.defaultPermissions}
          onChange={(value) =>
            void props.webSearch.setAdvanced("default_permissions", value)
          }
        >
          {!knownPermission && (
            <option value={defaults.defaultPermissions}>
              {t("settings.config.value.custom")} — {defaults.defaultPermissions}
            </option>
          )}
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
          value={defaults.approvalPolicy}
          onChange={(value) =>
            void props.webSearch.setAdvanced("approval_policy", value)
          }
        >
          {defaults.approvalPolicy === "custom" && (
            <option value="custom">{t("settings.config.value.custom")}</option>
          )}
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
    | "browser"
    | "chat"
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
