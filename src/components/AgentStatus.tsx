import { activityLabelKeys, type AgentActivity } from "../lib/activity";
import { useI18n } from "../i18n/I18nProvider";
export function AgentStatus({ activity }: { activity: AgentActivity }) {
  const { t } = useI18n();
  if (!activity) return null;
  return (
    <div
      className={`agent-status ${activity}`}
      role="status"
      aria-live="polite"
    >
      <span className="status-spinner">
        <i />
        <i />
        <i />
      </span>
      <span>{t(activityLabelKeys[activity])}</span>
    </div>
  );
}
