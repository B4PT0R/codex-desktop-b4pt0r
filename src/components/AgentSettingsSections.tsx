import {
  Gauge,
  ShieldCheck,
  ShieldQuestion,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { ModelVerbosity, PlanReasoningEffort } from "../lib/protocol";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
import type { CapabilityCatalog } from "../lib/useCapabilityCatalog";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import type { ConfigRequirements } from "../lib/useConfigRequirements";
import type { Model } from "../types";
import { GlobalAgentsSettings } from "./GlobalAgentsSettings";
import {
  normalizePermission,
  permissionDetail,
  permissionIcon,
  permissionLabel,
} from "./permissionPresentation";
import { SettingsChoiceOption } from "./SettingsChoiceOption";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { SubagentSettings } from "./SubagentSettings";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { IconSubheader } from "./IconSubheader";

const modelVerbosities: ModelVerbosity[] = ["low", "medium", "high"];
const planReasoningEfforts: PlanReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];
const approvalPolicies = ["untrusted", "on-request", "never"] as const;

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
    <section className="settings-page agent-settings-page">
      <SettingsPageHeader
        badge={t("settings.config.global")}
        description={t("settings.agent.description")}
      />
      <IconSubheader
        title={t("settings.agent.globalDefaults")}
        subtitle={t("settings.agent.globalDefaultsDetail")}
      />
      <CardStack className="settings-fields agent-primary-settings">
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
      </CardStack>
      <ServiceTierSettings
        globalSettings={globalSettings}
        models={models}
      />
      <SubagentSettings globalSettings={globalSettings} models={models} />
      <GlobalAgentsSettings />
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
  const [updating, setUpdating] = useState<string>();
  const knownPermission = capabilities.permissionProfiles.data.some(
    (profile) =>
      normalizePermission(profile.id) ===
      normalizePermission(defaults.defaultPermissions),
  );
  const busy = globalSettings.loading || updating !== undefined;

  return (
    <section className="settings-page">
      <SettingsPageHeader
        badge={t("settings.config.global")}
        description={t("settings.permissions.description")}
      />
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
      <IconSubheader
        title={t("settings.permissions.profile")}
        subtitle={t("settings.permissions.profileDetail")}
      />
      <CardStack
        aria-label={t("settings.permissions.profile")}
        className="settings-option-list"
        role="listbox"
      >
        {!knownPermission && (
          <SettingsChoiceOption
            description={t("settings.config.value.custom")}
            icon={permissionIcon(defaults.defaultPermissions)}
            label={defaults.defaultPermissions}
            onClick={() => undefined}
            selected
          />
        )}
        {capabilities.permissionProfiles.data.map((profile) => {
          const selected =
            normalizePermission(profile.id) ===
            normalizePermission(defaults.defaultPermissions);
          const allowed =
            profile.allowed &&
            configRequirements?.allowedPermissionProfiles?.[profile.id] !==
              false;
          const key = `permission:${profile.id}`;
          return (
            <SettingsChoiceOption
              description={
                profile.description || permissionDetail(profile.id, t)
              }
              disabled={!allowed || busy}
              icon={permissionIcon(profile.id)}
              key={profile.id}
              label={permissionLabel(profile.id, t)}
              onClick={async () => {
                setUpdating(key);
                await globalSettings.setAdvanced(
                  "default_permissions",
                  profile.id,
                );
                setUpdating(undefined);
              }}
              selected={selected}
              unavailable={!allowed}
              updating={updating === key}
            />
          );
        })}
      </CardStack>
      <IconSubheader
        title={t("approvalPolicy.title")}
        subtitle={t("approvalPolicy.detail")}
      />
      <CardStack
        aria-label={t("approvalPolicy.title")}
        className="settings-option-list"
        role="listbox"
      >
        {defaults.approvalPolicy === "custom" && (
          <SettingsChoiceOption
            description={t("settings.config.value.custom")}
            icon={ShieldQuestion}
            label={t("settings.config.value.custom")}
            onClick={() => undefined}
            selected
          />
        )}
        {approvalPolicies.map((policy) => {
          const allowed =
            configRequirements?.allowedApprovalPolicies === undefined ||
            configRequirements.allowedApprovalPolicies.includes(policy);
          const key = `approval:${policy}`;
          return (
            <SettingsChoiceOption
              description={t(`approvalPolicy.${policy}.detail`)}
              disabled={!allowed || busy}
              icon={ShieldQuestion}
              key={policy}
              label={t(`approvalPolicy.${policy}`)}
              onClick={async () => {
                setUpdating(key);
                await globalSettings.setAdvanced("approval_policy", policy);
                setUpdating(undefined);
              }}
              selected={defaults.approvalPolicy === policy}
              unavailable={!allowed}
              updating={updating === key}
            />
          );
        })}
      </CardStack>
      <IconSubheader
        title={t("approvalsReviewer.title")}
        subtitle={t("approvalsReviewer.detail")}
      />
      <CardStack
        aria-label={t("approvalsReviewer.title")}
        className="settings-option-list"
        role="listbox"
      >
        {defaults.approvalsReviewer === "custom" && (
          <SettingsChoiceOption
            description={t("settings.config.value.custom")}
            icon={ShieldQuestion}
            label={t("settings.config.value.custom")}
            onClick={() => undefined}
            selected
          />
        )}
        {(["user", "auto_review"] as const).map((reviewer) => {
          const allowed =
            configRequirements?.allowedApprovalsReviewers === undefined ||
            configRequirements.allowedApprovalsReviewers.includes(reviewer);
          const key = `reviewer:${reviewer}`;
          return (
            <SettingsChoiceOption
              description={t(`approvalsReviewer.${reviewer}.detail`)}
              disabled={!allowed || busy}
              icon={
                reviewer === "user" ? UserRoundCheck : ShieldCheck
              }
              key={reviewer}
              label={t(`approvalsReviewer.${reviewer}`)}
              onClick={async () => {
                setUpdating(key);
                await globalSettings.setAdvanced(
                  "approvals_reviewer",
                  reviewer,
                );
                setUpdating(undefined);
              }}
              selected={defaults.approvalsReviewer === reviewer}
              unavailable={!allowed}
              updating={updating === key}
            />
          );
        })}
      </CardStack>
    </section>
  );
}

function ServiceTierSettings({
  globalSettings,
  models,
}: {
  globalSettings: CodexGlobalSettingsController;
  models: Model[];
}) {
  const { t } = useI18n();
  const [updating, setUpdating] = useState<string>();
  const selectedModel =
    models.find(
      (candidate) => candidate.id === globalSettings.advanced.model,
    ) ??
    models.find((candidate) => candidate.isDefault) ??
    models[0];
  const tiers = selectedModel?.serviceTiers ?? [];
  const configuredTier = globalSettings.advanced.serviceTier;
  const knownTier =
    configuredTier === null ||
    tiers.some((tier) => tier.id === configuredTier);

  if (tiers.length === 0 && configuredTier === null) return null;

  return (
    <>
      <IconSubheader
        icon={<Zap />}
        title={t("settings.agent.serviceTier")}
        subtitle={t("settings.agent.serviceTierDetail", {
          model: selectedModel?.label ?? t("settings.agent.model"),
        })}
      />
      <CardStack
        aria-label={t("settings.agent.serviceTier")}
        className="settings-option-list"
        role="listbox"
      >
        <SettingsChoiceOption
          description={t("settings.agent.serviceTierAutomaticDetail")}
          disabled={globalSettings.loading || updating !== undefined}
          icon={Gauge}
          label={t("settings.global.automatic")}
          onClick={async () => {
            setUpdating("automatic");
            await globalSettings.setAdvanced("service_tier", null);
            setUpdating(undefined);
          }}
          selected={configuredTier === null}
          updating={updating === "automatic"}
        />
        {!knownTier && configuredTier && (
          <SettingsChoiceOption
            description={t("settings.config.value.custom")}
            icon={Zap}
            label={configuredTier}
            onClick={() => undefined}
            selected
          />
        )}
        {tiers.map((tier) => (
          <SettingsChoiceOption
            description={tier.description}
            disabled={globalSettings.loading || updating !== undefined}
            icon={Zap}
            key={tier.id}
            label={tier.name}
            onClick={async () => {
              setUpdating(tier.id);
              await globalSettings.setAdvanced("service_tier", tier.id);
              setUpdating(undefined);
            }}
            selected={configuredTier === tier.id}
            updating={updating === tier.id}
          />
        ))}
      </CardStack>
    </>
  );
}

function SettingSelect({
  detail,
  label,
  value,
  disabled = false,
  onChange,
  children,
}: {
  detail?: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <IconCard
      as="label"
      title={label}
      subtitle={detail}
      trailing={<select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>}
    />
  );
}
