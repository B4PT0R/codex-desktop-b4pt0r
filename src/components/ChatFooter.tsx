import type { ApprovalPolicy, Permission } from "../lib/protocol";
import type { CollaborationMode, Model, Quota } from "../types";
import type { ThreadTelemetry } from "../lib/sessionTelemetry";
import { Composer } from "./Composer";
import { SessionTelemetry } from "./SessionTelemetry";
import type { AppsController } from "../lib/useApps";
import type { TurnContextItem } from "../lib/protocol";
import { ModelQuickPicker } from "./ModelQuickPicker";
import type { PermissionProfileSummary } from "../lib/appServerTypes";
import type { RateLimitResetCreditsSummary } from "../lib/appServerTypes";
import type { AppServerSkill } from "../lib/appServerTypes";
import { QuotaQuickPicker } from "./QuotaQuickPicker";
import { ContextGauge } from "./ContextGauge";
import { SecurityQuickPicker } from "./SecurityQuickPicker";

type ChatFooterProps = {
  apps: AppsController;
  skills: AppServerSkill[];
  skillsError?: string;
  skillsLoading: boolean;
  busy: boolean;
  canSteer: boolean;
  cwd: string;
  model: string;
  collaborationMode: CollaborationMode;
  effort: string;
  models: Model[];
  permission: Permission;
  serviceTier: string | null;
  approvalPolicy: ApprovalPolicy;
  allowedApprovalPolicies?: ApprovalPolicy[];
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
  loadingThread: boolean;
  telemetry?: ThreadTelemetry;
  onChangeEffort: (effort: string) => void;
  onChangeModel: (model: string) => void;
  onChangeCollaborationMode: (mode: CollaborationMode) => Promise<boolean>;
  onCompact: () => void;
  onNeedApps: () => void;
  onNeedSkills: () => void;
  onConsumeDictationInsertion: (id: number) => void;
  onOpenMcpSettings: () => void;
  onChangePermission: (permission: Permission) => Promise<boolean>;
  onChangeApprovalPolicy: (policy: ApprovalPolicy) => Promise<boolean>;
  onChangeServiceTier: (tier: string | null) => Promise<boolean>;
  onConsumeQuotaReset: (creditId?: string) => Promise<void>;
  onOpenPluginSettings: () => void;
  onSend: (text: string, context: TurnContextItem[]) => void;
  onStop: () => void;
  onToggleVoice: () => void;
  onToggleDictation: () => void;
};

export function ChatFooter({
  apps,
  skills,
  skillsError,
  skillsLoading,
  busy,
  canSteer,
  cwd,
  model,
  collaborationMode,
  effort,
  models,
  permission,
  serviceTier,
  approvalPolicy,
  allowedApprovalPolicies,
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
  loadingThread,
  telemetry,
  onChangeEffort,
  onChangeModel,
  onChangeCollaborationMode,
  onCompact,
  onNeedApps,
  onNeedSkills,
  onConsumeDictationInsertion,
  onOpenMcpSettings,
  onChangePermission,
  onChangeApprovalPolicy,
  onChangeServiceTier,
  onConsumeQuotaReset,
  onOpenPluginSettings,
  onSend,
  onStop,
  onToggleVoice,
  onToggleDictation,
}: ChatFooterProps) {
  return (
    <footer>
      <div className="composer-stack">
        <Composer
          apps={apps.apps}
          appsError={apps.error}
          appsLoading={apps.loading}
          skills={skills}
          skillsError={skillsError}
          skillsLoading={skillsLoading}
          busy={busy}
          canSteer={canSteer}
          cwd={cwd}
          hasThread={hasThread}
          loadingThread={loadingThread}
          recording={recording}
          dictating={dictating}
          dictationProcessing={dictationProcessing}
          dictationInsertion={dictationInsertion}
          onNeedApps={onNeedApps}
          onNeedSkills={onNeedSkills}
          onConsumeDictationInsertion={onConsumeDictationInsertion}
          onOpenMcp={onOpenMcpSettings}
          onOpenPlugins={onOpenPluginSettings}
          onSend={onSend}
          onStop={onStop}
          onToggleVoice={onToggleVoice}
          onToggleDictation={onToggleDictation}
        />
      </div>
      <div className="footer-settings">
        <ModelQuickPicker
          collaborationMode={collaborationMode}
          effort={effort}
          model={model}
          models={models}
          serviceTier={serviceTier}
          onChangeEffort={onChangeEffort}
          onChangeCollaborationMode={onChangeCollaborationMode}
          onChangeModel={onChangeModel}
          onChangeServiceTier={onChangeServiceTier}
        />
        <SecurityQuickPicker
          allowedApprovalPolicies={allowedApprovalPolicies}
          approvalPolicy={approvalPolicy}
          onChangeApprovalPolicy={onChangeApprovalPolicy}
          onChangePermission={onChangePermission}
          permission={permission}
          permissionProfiles={permissionProfiles}
        />
        <SessionTelemetry reroute={telemetry?.reroute} />
        <div className="footer-metrics">
          <ContextGauge
            context={telemetry?.context}
            disabled={busy || !hasThread}
            onCompact={onCompact}
          />
          <QuotaQuickPicker
            consuming={quotaConsuming}
            error={quotaError}
            onConsumeReset={onConsumeQuotaReset}
            quotas={quotas}
            resetCredits={quotaResetCredits}
            resetMessage={quotaResetMessage}
          />
        </div>
      </div>
    </footer>
  );
}
