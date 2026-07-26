import type { ApprovalPolicy, Permission } from "../lib/protocol";
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
import type { AppServerSkill } from "../lib/appServerTypes";
import { QuotaQuickPicker } from "./QuotaQuickPicker";
import { ContextGauge } from "./ContextGauge";
import { ApprovalQuickPicker } from "./ApprovalQuickPicker";

type ChatFooterProps = {
  apps: AppsController;
  skills: AppServerSkill[];
  skillsError?: string;
  skillsLoading: boolean;
  busy: boolean;
  canSteer: boolean;
  cwd: string;
  model: string;
  effort: string;
  models: Model[];
  permission: Permission;
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
  telemetry?: ThreadTelemetry;
  onChangeEffort: (effort: string) => void;
  onChangeModel: (model: string) => void;
  onCompact: () => void;
  onNeedApps: () => void;
  onNeedSkills: () => void;
  onOpenMcpSettings: () => void;
  onChangePermission: (permission: Permission) => Promise<boolean>;
  onChangeApprovalPolicy: (policy: ApprovalPolicy) => Promise<boolean>;
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
  effort,
  models,
  permission,
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
  telemetry,
  onChangeEffort,
  onChangeModel,
  onCompact,
  onNeedApps,
  onNeedSkills,
  onOpenMcpSettings,
  onChangePermission,
  onChangeApprovalPolicy,
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
          recording={recording}
          dictating={dictating}
          dictationProcessing={dictationProcessing}
          dictationInsertion={dictationInsertion}
          onNeedApps={onNeedApps}
          onNeedSkills={onNeedSkills}
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
        <ApprovalQuickPicker
          allowed={allowedApprovalPolicies}
          onChange={onChangeApprovalPolicy}
          policy={approvalPolicy}
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
