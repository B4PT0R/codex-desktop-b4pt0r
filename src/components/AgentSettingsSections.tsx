import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/locales/fr";
import type { ModelVerbosity, PlanReasoningEffort } from "../lib/protocol";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
import type { CapabilityCatalog } from "../lib/useCapabilityCatalog";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import type { ConfigRequirements } from "../lib/useConfigRequirements";
import type { Model } from "../types";

const modelVerbosities: ModelVerbosity[] = ["low", "medium", "high"];
const planReasoningEfforts: PlanReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export function AgentSettings({
  globalSettings,
  models,
}: {
  globalSettings: CodexGlobalSettingsController;
  models: Model[];
}) {
  const { t } = useI18n();
  const defaults = globalSettings.advanced;
  const selectedModel = models.find(
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
          disabled={globalSettings.loading}
          onChange={(value) =>
            void globalSettings.setAdvanced("model", value || null)
          }
        >
          <option value="">{t("settings.global.automatic")}</option>
          {models.map((model) => (
            <option value={model.id} key={model.id}>
              {model.label}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("settings.agent.effort")}
          value={defaults.modelReasoningEffort ?? ""}
          disabled={globalSettings.loading}
          onChange={(value) =>
            void globalSettings.setAdvanced(
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
          disabled={globalSettings.loading}
          onChange={(value) =>
            void globalSettings.setAdvanced("personality", value || null)
          }
        >
          <option value="">{t("settings.global.automatic")}</option>
          <option value="pragmatic">{t("settings.agent.pragmatic")}</option>
          <option value="friendly">{t("settings.agent.friendly")}</option>
          <option value="none">{t("settings.agent.neutral")}</option>
        </SettingSelect>
        <SettingSelect
          label={t("settings.agent.verbosity")}
          value={globalSettings.modelVerbosity}
          disabled={globalSettings.loading}
          onChange={(value) =>
            void globalSettings.setModelVerbosity(value as ModelVerbosity)
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
          value={globalSettings.planReasoningEffort}
          disabled={globalSettings.loading}
          onChange={(value) =>
            void globalSettings.setPlanReasoningEffort(
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
      {globalSettings.error && (
        <div className="inventory-message error" role="alert">
          {globalSettings.error}
        </div>
      )}
    </section>
  );
}

export function PermissionSettings({
  capabilities,
  configRequirements,
  globalSettings,
}: {
  capabilities: CapabilityCatalog;
  configRequirements?: ConfigRequirements & {
    error?: string;
    loading?: boolean;
  };
  globalSettings: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  const defaults = globalSettings.advanced;
  const knownPermission = capabilities.permissionProfiles.data.some(
    (profile) => profile.id === defaults.defaultPermissions,
  );

  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.permissions.description")}</p>
        <span className="scope-badge">{t("settings.config.global")}</span>
      </header>
      {capabilities.permissionProfiles.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.permissions.catalogUnavailable")}
        </div>
      )}
      {configRequirements?.managed && (
        <div className="inventory-message neutral" role="status">
          {t("settings.requirements.permissions")}
          {configRequirements.defaultPermission
            ? ` ${t("settings.requirements.default", {
                profile: permissionLabel(
                  configRequirements.defaultPermission,
                  t,
                ),
              })}`
            : ""}
        </div>
      )}
      {configRequirements?.error && (
        <div className="inventory-message error" role="alert">
          {t("settings.requirements.error")}
        </div>
      )}
      <div className="settings-card settings-fields">
        <SettingSelect
          label={t("settings.permissions.profile")}
          value={defaults.defaultPermissions}
          onChange={(value) =>
            void globalSettings.setAdvanced("default_permissions", value)
          }
        >
          {!knownPermission && (
            <option value={defaults.defaultPermissions}>
              {t("settings.config.value.custom")} —{" "}
              {defaults.defaultPermissions}
            </option>
          )}
          {capabilities.permissionProfiles.data.map((profile) => (
            <option
              value={profile.id}
              key={profile.id}
              disabled={
                !profile.allowed ||
                configRequirements?.allowedPermissionProfiles?.[profile.id] ===
                  false
              }
            >
              {permissionLabel(profile.id, t)}
              {!profile.allowed ||
              configRequirements?.allowedPermissionProfiles?.[profile.id] ===
                false
                ? ` — ${t("settings.permissions.notAllowed")}`
                : ""}
            </option>
          ))}
        </SettingSelect>
        <SettingSelect
          label={t("approvalPolicy.title")}
          value={defaults.approvalPolicy}
          onChange={(value) =>
            void globalSettings.setAdvanced("approval_policy", value)
          }
        >
          {defaults.approvalPolicy === "custom" && (
            <option value="custom">{t("settings.config.value.custom")}</option>
          )}
          {(["untrusted", "on-request", "never"] as const).map((policy) => (
            <option
              disabled={
                configRequirements?.allowedApprovalPolicies !== undefined &&
                !configRequirements.allowedApprovalPolicies.includes(policy)
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
  onChange,
  children,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function permissionLabel(id: string, t: (key: MessageKey) => string) {
  if (id === ":read-only") return t("settings.permissions.readOnly");
  if (id === ":workspace") return t("settings.permissions.workspace");
  if (id === ":danger-full-access") return t("settings.permissions.fullAccess");
  return id;
}
