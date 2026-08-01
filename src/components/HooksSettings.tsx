import { AlertTriangle, ChevronDown, RefreshCw, Webhook } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { SettingsPageHeader } from "./SettingsPageHeader";
import {
  SettingsControlsBar,
  SettingsControlsBarButton,
} from "./SettingsControlsBar";
import type { MessageKey } from "../i18n/locales/fr";
import type { AppServerHook } from "../lib/appServerTypes";
import type { IntegrationsController } from "../lib/useIntegrations";
import { IconCard } from "./IconCard";
import { CardStack } from "./CardStack";

export function HooksSettings({
  integrations,
  managedOnly = false,
}: {
  integrations: IntegrationsController;
  managedOnly?: boolean;
}) {
  const { t } = useI18n();
  const { hooks } = integrations;
  return (
    <section className="settings-page integrations-page hooks-page">
      <SettingsPageHeader description={t("settings.hooks.description")} />
      {hooks.error && (
        <div className="inventory-message error" role="alert">
          {hooks.error}
        </div>
      )}
      {managedOnly && (
        <div className="inventory-message neutral" role="status">
          {t("settings.requirements.hooks")}
        </div>
      )}
      {hooks.warnings.map((warning, index) => (
        <div className="inventory-message warning" key={index} role="status">
          <AlertTriangle /> {warning}
        </div>
      ))}
      <CardStack
        className="hook-list"
        controlBar={<SettingsControlsBar
          actions={
          <SettingsControlsBarButton
            disabled={hooks.loading}
            icon={RefreshCw}
            iconClassName={hooks.loading ? "spin" : undefined}
            onClick={() => void integrations.refreshHooks()}
          >
            {t("integrations.refresh")}
          </SettingsControlsBarButton>
          }
          status={t(
            hooks.data.length === 1
              ? "integrations.countOne"
              : "integrations.countMany",
            { count: hooks.data.length },
          )}
        />}
      >
        {hooks.loading && hooks.data.length === 0 ? (
          <p className="inventory-empty">{t("integrations.hooks.loading")}</p>
        ) : hooks.data.length === 0 ? (
          <p className="inventory-empty">{t("integrations.hooks.empty")}</p>
        ) : (
          hooks.data.map((hook) => <HookRow hook={hook} key={hook.key} />)
        )}
      </CardStack>
    </section>
  );
}

function HookRow({ hook }: { hook: AppServerHook }) {
  const { t } = useI18n();
  return (
    <IconCard
      icon={<Webhook />}
      subtitle={
        <>
          {t(hookEventKey(hook.eventName))} · {t(handlerKey(hook.handlerType))}
          {hook.matcher ? ` · ${hook.matcher}` : ""}
        </>
      }
      title={hook.statusMessage || hook.key}
      trailing={<div className="hook-badges">
        <span className={hook.enabled ? "enabled" : "disabled"}>
          {t(hook.enabled ? "integrations.enabled" : "integrations.disabled")}
        </span>
        <span className={trustClass(hook.trustStatus)}>
          {t(trustKey(hook.trustStatus))}
        </span>
        <small>{t(sourceKey(hook.source))}</small>
      </div>}
    >
      <div className="hook-copy">
        <details>
          <summary>
            {t("integrations.hooks.details")} <ChevronDown />
          </summary>
          {hook.command && <code>{hook.command}</code>}
          <code title={hook.sourcePath}>{hook.sourcePath}</code>
        </details>
      </div>
    </IconCard>
  );
}

function hookEventKey(event: string): MessageKey {
  const key = `integrations.hooks.event.${event}` as MessageKey;
  return knownHookEvents.has(event) ? key : "integrations.hooks.event.unknown";
}

function handlerKey(handler: string): MessageKey {
  if (handler === "command") return "integrations.hooks.handler.command";
  if (handler === "prompt") return "integrations.hooks.handler.prompt";
  if (handler === "agent") return "integrations.hooks.handler.agent";
  return "integrations.hooks.handler.unknown";
}

function trustKey(trust: string): MessageKey {
  if (trust === "trusted") return "integrations.hooks.trust.trusted";
  if (trust === "managed") return "integrations.hooks.trust.managed";
  if (trust === "modified") return "integrations.hooks.trust.modified";
  return "integrations.hooks.trust.untrusted";
}

function trustClass(trust: string) {
  return trust === "trusted" || trust === "managed" ? "trusted" : "warning";
}

function sourceKey(source: string): MessageKey {
  if (source === "project") return "integrations.hooks.source.project";
  if (source === "user") return "integrations.hooks.source.user";
  if (source === "plugin") return "integrations.hooks.source.plugin";
  if (source === "system") return "integrations.hooks.source.system";
  return "integrations.hooks.source.managed";
}

const knownHookEvents = new Set([
  "preToolUse",
  "permissionRequest",
  "postToolUse",
  "preCompact",
  "postCompact",
  "sessionStart",
  "sessionEnd",
  "userPromptSubmit",
  "subagentStart",
  "subagentStop",
  "stop",
]);
