import { Check, ClipboardList, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AgentSignal } from "../types";
import { RoundIcon } from "./RoundIcon";

type PlanPhase = "active" | "complete" | "exiting";

export function PlanProgressWidget({
  plan,
}: {
  plan: AgentSignal | undefined;
}) {
  const { t } = useI18n();
  const activePlanId = useRef<string | undefined>(undefined);
  const [displayedPlan, setDisplayedPlan] = useState<AgentSignal>();
  const [phase, setPhase] = useState<PlanPhase>("active");

  useEffect(() => {
    const timers: number[] = [];
    if (!plan) {
      activePlanId.current = undefined;
      setDisplayedPlan(undefined);
      return;
    }
    if (plan.status !== "done") {
      activePlanId.current = plan.id;
      setDisplayedPlan(plan);
      setPhase("active");
      return;
    }
    if (activePlanId.current !== plan.id) {
      setDisplayedPlan(undefined);
      return;
    }

    setDisplayedPlan(plan);
    setPhase("complete");
    timers.push(
      window.setTimeout(() => setPhase("exiting"), 1_400),
      window.setTimeout(() => {
        activePlanId.current = undefined;
        setDisplayedPlan(undefined);
      }, 1_850),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [plan]);

  if (!displayedPlan) return null;
  const steps = displayedPlan.steps ?? [];
  const completed = steps.filter((step) => step.status === "completed").length;
  const complete = displayedPlan.status === "done";

  return (
    <aside
      aria-atomic="true"
      aria-label={t("planProgress.label")}
      aria-live="polite"
      className={`plan-progress-widget ${phase}${complete ? " plan-done" : ""}`}
    >
      <div className="plan-progress-heading">
        <RoundIcon
          className="plan-progress-icon"
          icon={complete ? Check : ClipboardList}
          size="small"
          variant="secondary"
        />
        <div>
          <strong>
            {complete ? t("planProgress.complete") : displayedPlan.title}
          </strong>
          {steps.length > 0 && (
            <small>
              {t("planProgress.progress", {
                completed,
                total: steps.length,
              })}
            </small>
          )}
        </div>
        {!complete && <LoaderCircle className="spin" />}
      </div>
      {!complete && displayedPlan.detail && (
        <p className="plan-progress-detail">{displayedPlan.detail}</p>
      )}
      {!complete && steps.length > 0 && (
        <ol>
          {steps.map((step, index) => {
            const done = step.status === "completed";
            const running = step.status === "inProgress";
            return (
              <li className={step.status} key={`${index}-${step.step}`}>
                <span>
                  {done ? (
                    <Check />
                  ) : running ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <i />
                  )}
                </span>
                {step.step}
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
