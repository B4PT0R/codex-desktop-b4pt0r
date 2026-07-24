import { Pause, Play, Target, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/locales/fr";
import { useThreadGoal } from "../lib/useThreadGoal";
import "../thread-goal.css";

export function ThreadGoalButton({
  connected,
  threadId,
}: {
  connected: boolean;
  threadId?: string;
}) {
  const { locale, t } = useI18n();
  const controller = useThreadGoal(connected, threadId);
  const [open, setOpen] = useState(false);
  const [objective, setObjective] = useState("");
  const [budget, setBudget] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setConfirmingClear(false);
  }, [threadId]);
  useEffect(() => {
    setObjective(controller.goal?.objective ?? "");
    setBudget(
      controller.goal?.tokenBudget
        ? String(controller.goal.tokenBudget)
        : "",
    );
  }, [
    controller.goal?.objective,
    controller.goal?.threadId,
    controller.goal?.tokenBudget,
  ]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("textarea, button")?.focus();
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      opener.current?.focus();
    };
  }, [open]);

  if (!threadId) return null;
  const parsedBudget = budget === "" ? null : Number(budget);
  const budgetValid =
    parsedBudget === null ||
    (Number.isSafeInteger(parsedBudget) && parsedBudget > 0);
  const canSave =
    objective.trim().length > 0 &&
    objective.trim().length <= 10_000 &&
    budgetValid &&
    !controller.saving;
  const progress = controller.goal?.tokenBudget
    ? Math.min(
        100,
        Math.round(
          (controller.goal.tokensUsed / controller.goal.tokenBudget) * 100,
        ),
      )
    : null;

  return (
    <div className="thread-goal" ref={root}>
      <button
        ref={opener}
        className={controller.goal ? "thread-goal-trigger active" : "thread-goal-trigger"}
        aria-expanded={open}
        aria-label={t(controller.goal ? "goal.open" : "goal.create")}
        title={t(controller.goal ? "goal.open" : "goal.create")}
        onClick={() => setOpen((value) => !value)}
      >
        <Target />
        {controller.goal && <span>{t(statusKey(controller.goal.status))}</span>}
      </button>
      {open && (
        <div
          ref={panel}
          className="thread-goal-popover"
          role="dialog"
          aria-label={t("goal.title")}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
        >
          <header>
            <span>
              <strong>{t("goal.title")}</strong>
              <small>{t("goal.description")}</small>
            </span>
            {controller.goal && (
              <em className={`goal-status ${controller.goal.status}`}>
                {t(statusKey(controller.goal.status))}
              </em>
            )}
          </header>
          <label>
            {t("goal.objective")}
            <textarea
              maxLength={10_000}
              rows={4}
              value={objective}
              placeholder={t("goal.objectivePlaceholder")}
              onChange={(event) => setObjective(event.target.value)}
            />
          </label>
          <label>
            {t("goal.tokenBudget")}
            <input
              inputMode="numeric"
              min="1"
              step="1"
              type="number"
              value={budget}
              placeholder={t("goal.noLimit")}
              onChange={(event) => setBudget(event.target.value)}
            />
          </label>
          {!budgetValid && <small className="goal-validation">{t("goal.invalidBudget")}</small>}
          {controller.goal && (
            <div className="goal-usage">
              <span>
                {t("goal.tokensUsed", {
                  count: controller.goal.tokensUsed.toLocaleString(locale),
                })}
                {controller.goal.tokenBudget &&
                  ` / ${controller.goal.tokenBudget.toLocaleString(locale)}`}
              </span>
              <span>{formatDuration(controller.goal.timeUsedSeconds, locale)}</span>
              {progress !== null && <progress max="100" value={progress} />}
            </div>
          )}
          {controller.error && <p className="thread-goal-error" role="alert">{controller.error}</p>}
          <footer>
            {controller.goal && !confirmingClear && (
              <button
                className="goal-secondary"
                disabled={controller.saving}
                onClick={() => void controller.setPaused(controller.goal?.status === "active")}
              >
                {controller.goal.status === "active" ? <Pause /> : <Play />}
                {t(controller.goal.status === "active" ? "goal.pause" : "goal.resume")}
              </button>
            )}
            {confirmingClear ? (
              <span className="goal-clear-confirm">
                <small>{t("goal.clearConfirm")}</small>
                <button onClick={() => setConfirmingClear(false)}>{t("common.cancel")}</button>
                <button className="danger" onClick={() => void controller.clear().then((cleared) => cleared && setConfirmingClear(false))}>
                  {t("goal.clear")}
                </button>
              </span>
            ) : controller.goal ? (
              <button className="goal-clear" aria-label={t("goal.clear")} onClick={() => setConfirmingClear(true)}>
                <Trash2 />
              </button>
            ) : null}
            <button
              className="goal-save"
              disabled={!canSave}
              onClick={() => void controller.save(objective.trim(), parsedBudget)}
            >
              {controller.saving ? t("goal.saving") : t(controller.goal ? "goal.save" : "goal.createAction")}
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}

function statusKey(status: string): MessageKey {
  return `goal.status.${status}` as MessageKey;
}

function formatDuration(seconds: number, locale: string) {
  if (seconds < 60) return new Intl.NumberFormat(locale, { style: "unit", unit: "second", unitDisplay: "short" }).format(seconds);
  const minutes = Math.round(seconds / 60);
  return new Intl.NumberFormat(locale, { style: "unit", unit: minutes < 60 ? "minute" : "hour", unitDisplay: "short" }).format(minutes < 60 ? minutes : Math.round(minutes / 60));
}
