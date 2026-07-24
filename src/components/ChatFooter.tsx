import { AudioWaveform } from "lucide-react";
import type { Permission } from "../lib/protocol";
import type { Model, Quota } from "../types";
import type { ThreadTelemetry } from "../lib/sessionTelemetry";
import { Composer } from "./Composer";
import { SessionTelemetry } from "./SessionTelemetry";
import type { AppsController } from "../lib/useApps";
import type { TurnContextItem } from "../lib/protocol";
import { useI18n } from "../i18n/I18nProvider";
import { ModelQuickPicker } from "./ModelQuickPicker";
import { PermissionQuickPicker } from "./PermissionQuickPicker";
import type { PermissionProfileSummary } from "../lib/appServerTypes";
import type { RateLimitResetCreditsSummary } from "../lib/appServerTypes";
import { QuotaQuickPicker } from "./QuotaQuickPicker";

type ChatFooterProps = {
  apps: AppsController;
  busy: boolean;
  canSteer: boolean;
  cwd: string;
  model: string;
  effort: string;
  models: Model[];
  permission: Permission;
  permissionProfiles: PermissionProfileSummary[];
  quotas: Quota[];
  quotaConsuming: boolean;
  quotaError?: string;
  quotaResetCredits: RateLimitResetCreditsSummary | null;
  quotaResetMessage?: string;
  recording: boolean;
  dictating: boolean;
  dictationProcessing: boolean;
  dictationInsertion?: { id: number; text: string };
  hasThread: boolean;
  telemetry?: ThreadTelemetry;
  voiceTranscript: string;
  onChangeEffort: (effort: string) => void;
  onChangeModel: (model: string) => void;
  onCompact: () => void;
  onNeedApps: () => void;
  onOpenMcpSettings: () => void;
  onChangePermission: (permission: Permission) => Promise<boolean>;
  onConsumeQuotaReset: (creditId?: string) => Promise<void>;
  onOpenPluginSettings: () => void;
  onSend: (text: string, context: TurnContextItem[]) => void;
  onStop: () => void;
  onToggleVoice: () => void;
  onToggleDictation: () => void;
};

export function ChatFooter({
  apps,
  busy,
  canSteer,
  cwd,
  model,
  effort,
  models,
  permission,
  permissionProfiles,
  quotas,
  quotaConsuming,
  quotaError,
  quotaResetCredits,
  quotaResetMessage,
  recording,
  dictating,
  dictationProcessing,
  dictationInsertion,
  hasThread,
  telemetry,
  voiceTranscript,
  onChangeEffort,
  onChangeModel,
  onCompact,
  onNeedApps,
  onOpenMcpSettings,
  onChangePermission,
  onConsumeQuotaReset,
  onOpenPluginSettings,
  onSend,
  onStop,
  onToggleVoice,
  onToggleDictation,
}: ChatFooterProps) {
  const { t } = useI18n();
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
        dictating={dictating}
        dictationProcessing={dictationProcessing}
        dictationInsertion={dictationInsertion}
        onNeedApps={onNeedApps}
        onCompact={onCompact}
        onOpenMcp={onOpenMcpSettings}
        onOpenPlugins={onOpenPluginSettings}
        onSend={onSend}
        onStop={onStop}
        onToggleVoice={onToggleVoice}
        onToggleDictation={onToggleDictation}
      />
      <div className="footer-settings">
        <ModelQuickPicker
          effort={effort}
          model={model}
          models={models}
          onChangeEffort={onChangeEffort}
          onChangeModel={onChangeModel}
        />
        <PermissionQuickPicker
          onChange={onChangePermission}
          permission={permission}
          profiles={permissionProfiles}
        />
        <SessionTelemetry reroute={telemetry?.reroute} />
        <QuotaQuickPicker
          consuming={quotaConsuming}
          error={quotaError}
          onConsumeReset={onConsumeQuotaReset}
          quotas={quotas}
          resetCredits={quotaResetCredits}
          resetMessage={quotaResetMessage}
        />
      </div>
    </footer>
  );
}
