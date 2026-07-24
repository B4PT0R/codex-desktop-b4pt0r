import {
  AlertTriangle,
  Bot,
  Brain,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Combine,
  LoaderCircle,
  ScanSearch,
} from "lucide-react";
import type { AgentSignal } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import { memo } from "react";
const icons = {
  reasoning: Brain,
  plan: ClipboardList,
  compaction: Combine,
  review: ScanSearch,
  agent: Bot,
  warning: AlertTriangle,
};
export const SignalCards = memo(function SignalCards({
  signals,
}: {
  signals: AgentSignal[];
}) {
  const { t } = useI18n();
  const visibleSignals = signals.filter(
    (signal) => signal.kind !== "reasoning" || Boolean(signal.detail?.trim()),
  );
  if (visibleSignals.length === 0) return null;
  return (
    <div className="signal-stack">
      {visibleSignals.map((signal) => {
        const Icon = icons[signal.kind];
        const running = signal.status === "running";
        return (
          <details
            className={`signal-card ${signal.kind}`}
            key={signal.id}
            open={signal.kind === "plan" || signal.kind === "warning"}
          >
            <summary>
              <Icon />
              <span>{signal.title}</span>
              {running ? (
                <LoaderCircle className="spin signal-state" />
              ) : signal.status === "error" ? (
                <CircleAlert
                  aria-label={t("signal.error")}
                  className="signal-state"
                />
              ) : (
                <Check aria-label={t("signal.done")} className="signal-state" />
              )}
              {(signal.detail || signal.steps) && (
                <ChevronDown className="signal-chevron" />
              )}
            </summary>
            {(signal.detail || signal.steps) && (
              <div className="signal-body">
                {signal.detail && <p>{signal.detail}</p>}
                {signal.steps && (
                  <ol>
                    {signal.steps.map((step, i) => (
                      <li className={step.status} key={i}>
                        <i />
                        {step.step}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
});
