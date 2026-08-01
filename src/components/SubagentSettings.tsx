import { useI18n } from "../i18n/I18nProvider";
import { reasoningEffortLabel } from "../lib/reasoningEffort";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import type { Model } from "../types";
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { IconSubheader } from "./IconSubheader";

const reasoningEfforts = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "ultra",
];
const concurrencyOptions = [1, 2, 3, 4, 8];

export function SubagentSettings({
  globalSettings,
  models,
}: {
  globalSettings: CodexGlobalSettingsController;
  models: Model[];
}) {
  const { t } = useI18n();
  const config = globalSettings.advanced;
  const disabled = globalSettings.loading || !config.agentsEnabled;
  const concurrencyValues =
    config.subagentMaxConcurrentThreads !== null &&
    !concurrencyOptions.includes(config.subagentMaxConcurrentThreads)
      ? [config.subagentMaxConcurrentThreads, ...concurrencyOptions]
      : concurrencyOptions;

  return (
    <>
      <IconSubheader
        title={t("settings.agent.subagents.title")}
        subtitle={t("settings.agent.subagents.detail")}
      />
      <CardStack className="settings-fields">
        <IconCard
          as="label"
          title={t("settings.agent.subagents.enabled")}
          subtitle={t("settings.agent.subagents.enabledDetail")}
          trailing={<span className="startup-toggle">
            <input
              aria-label={t("settings.agent.subagents.enabled")}
              checked={config.agentsEnabled}
              disabled={globalSettings.loading}
              onChange={(event) =>
                void globalSettings.setAdvanced(
                  "agents.enabled",
                  event.target.checked,
                )
              }
              type="checkbox"
            />
            {config.agentsEnabled
              ? t("settings.agent.subagents.active")
              : t("settings.agent.subagents.inactive")}
          </span>}
        />
        <IconCard
          as="label"
          title={t("settings.agent.subagents.model")}
          subtitle={t("settings.agent.subagents.modelDetail")}
          trailing={<select
            aria-label={t("settings.agent.subagents.model")}
            disabled={disabled}
            value={config.subagentModel ?? ""}
            onChange={(event) =>
              void globalSettings.setAdvanced(
                "agents.default_subagent_model",
                event.target.value || null,
              )
            }
          >
            <option value="">{t("settings.global.automatic")}</option>
            {config.subagentModel &&
              !models.some((model) => model.id === config.subagentModel) && (
                <option value={config.subagentModel}>
                  {t("settings.config.value.custom")} — {config.subagentModel}
                </option>
              )}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>}
        />
        <IconCard
          as="label"
          title={t("settings.agent.subagents.effort")}
          subtitle={t("settings.agent.subagents.effortDetail")}
          trailing={<select
            aria-label={t("settings.agent.subagents.effort")}
            disabled={disabled}
            value={config.subagentReasoningEffort ?? ""}
            onChange={(event) =>
              void globalSettings.setAdvanced(
                "agents.default_subagent_reasoning_effort",
                event.target.value || null,
              )
            }
          >
            <option value="">{t("settings.global.automatic")}</option>
            {config.subagentReasoningEffort &&
              !reasoningEfforts.includes(
                config.subagentReasoningEffort,
              ) && (
                <option value={config.subagentReasoningEffort}>
                  {t("settings.config.value.custom")} —{" "}
                  {config.subagentReasoningEffort}
                </option>
              )}
            {reasoningEfforts.map((effort) => (
              <option key={effort} value={effort}>
                {reasoningEffortLabel(effort, t)}
              </option>
            ))}
          </select>}
        />
        <IconCard
          as="label"
          title={t("settings.agent.subagents.concurrency")}
          subtitle={t("settings.agent.subagents.concurrencyDetail")}
          trailing={<select
            aria-label={t("settings.agent.subagents.concurrency")}
            disabled={disabled}
            value={config.subagentMaxConcurrentThreads ?? ""}
            onChange={(event) =>
              void globalSettings.setAdvanced(
                "agents.max_concurrent_threads_per_session",
                event.target.value ? Number(event.target.value) : null,
              )
            }
          >
            <option value="">{t("settings.global.automatic")}</option>
            {concurrencyValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>}
        />
        <IconCard
          as="label"
          title={t("settings.agent.subagents.interrupt")}
          subtitle={t("settings.agent.subagents.interruptDetail")}
          trailing={<span className="startup-toggle">
            <input
              aria-label={t("settings.agent.subagents.interrupt")}
              checked={config.subagentInterruptMessage}
              disabled={disabled}
              onChange={(event) =>
                void globalSettings.setAdvanced(
                  "agents.interrupt_message",
                  event.target.checked,
                )
              }
              type="checkbox"
            />
            {config.subagentInterruptMessage
              ? t("settings.agent.subagents.recorded")
              : t("settings.agent.subagents.silent")}
          </span>}
        />
      </CardStack>
    </>
  );
}
