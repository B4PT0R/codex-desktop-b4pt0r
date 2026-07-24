import { AudioWaveform, ChevronDown, ShieldCheck } from "lucide-react";
import type { Permission } from "../lib/protocol";
import { quotaWindowLabel } from "../lib/quotaPresentation";
import type { Model, Quota } from "../types";
import type { ThreadTelemetry } from "../lib/sessionTelemetry";
import { Composer } from "./Composer";
import { SessionTelemetry } from "./SessionTelemetry";
import type { AppsController } from "../lib/useApps";
import type { TurnContextItem } from "../lib/protocol";
import { useI18n } from "../i18n/I18nProvider";

type ChatFooterProps = {
  apps: AppsController;
  busy: boolean;
  canSteer: boolean;
  cwd: string;
  model: string;
  models: Model[];
  permission: Permission;
  quotas: Quota[];
  recording: boolean;
  hasThread: boolean;
  telemetry?: ThreadTelemetry;
  voiceTranscript: string;
  onOpenModelSettings: () => void;
  onCompact: () => void;
  onNeedApps: () => void;
  onOpenMcpSettings: () => void;
  onOpenPermissionSettings: () => void;
  onOpenPluginSettings: () => void;
  onSend: (text: string, context: TurnContextItem[]) => void;
  onStop: () => void;
  onToggleVoice: () => void;
};

export function ChatFooter({
  apps,
  busy,
  canSteer,
  cwd,
  model,
  models,
  permission,
  quotas,
  recording,
  hasThread,
  telemetry,
  voiceTranscript,
  onOpenModelSettings,
  onCompact,
  onNeedApps,
  onOpenMcpSettings,
  onOpenPermissionSettings,
  onOpenPluginSettings,
  onSend,
  onStop,
  onToggleVoice,
}: ChatFooterProps) {
  const { locale, t } = useI18n();
  return (
    <footer>
      {voiceTranscript && (
        <div className="voice-transcript">
          <AudioWaveform /> {voiceTranscript}
        </div>
      )}
      <Composer
        apps={apps.apps}
        appsError={apps.error}
        appsLoading={apps.loading}
        busy={busy}
        canSteer={canSteer}
        contextUsage={telemetry?.context}
        cwd={cwd}
        hasThread={hasThread}
        recording={recording}
        onNeedApps={onNeedApps}
        onCompact={onCompact}
        onOpenMcp={onOpenMcpSettings}
        onOpenPlugins={onOpenPluginSettings}
        onSend={onSend}
        onStop={onStop}
        onToggleVoice={onToggleVoice}
      />
      <div className="footer-settings">
        <button className="model-select" onClick={onOpenModelSettings}>
          {models.find((candidate) => candidate.id === model)?.label}
          <ChevronDown />
        </button>
        <button onClick={onOpenPermissionSettings}>
          <ShieldCheck />
          {permission === "workspace-write" || permission === ":workspace"
            ? t("chat.permission.workspace")
            : permission === "read-only" || permission === ":read-only"
              ? t("chat.permission.readOnly")
              : t("chat.permission.fullAccess")}
        </button>
        <SessionTelemetry reroute={telemetry?.reroute} />
        <div className="quota">
          {quotas.map((quota, index) => (
            <span
              key={index}
              title={
                quota.resetsAt
                  ? `${t("chat.quota.resets")} ${new Date(
                      quota.resetsAt * 1000,
                    ).toLocaleString(locale)}`
                  : undefined
              }
            >
              <i style={{ width: `${quota.used}%` }} />
              {quotaWindowLabel(quota.durationMinutes, index)}&nbsp;{" "}
              {100 - quota.used} %
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
