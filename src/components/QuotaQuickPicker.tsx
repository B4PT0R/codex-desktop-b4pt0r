import { Clock3, RotateCcw, TicketCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { RateLimitResetCreditsSummary } from "../lib/appServerTypes";
import { quotaWindowLabel } from "../lib/quotaPresentation";
import type { Quota } from "../types";

type QuotaQuickPickerProps = {
  consuming: boolean;
  error?: string;
  onConsumeReset: (creditId?: string) => Promise<void>;
  quotas: Quota[];
  resetCredits: RateLimitResetCreditsSummary | null;
  resetMessage?: string;
};

export function QuotaQuickPicker({
  consuming,
  error,
  onConsumeReset,
  quotas,
  resetCredits,
  resetMessage,
}: QuotaQuickPickerProps) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const available = resetCredits?.availableCount ?? 0;
  const credit = resetCredits?.credits?.find(
    (candidate) => candidate.status === "available",
  );

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (shell.current?.contains(event.target as Node)) return;
      setOpen(false);
      setConfirming(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function closePicker() {
    setOpen(false);
    setConfirming(false);
    trigger.current?.focus();
  }

  return (
    <div
      className="quota-quick-picker-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open && !consuming) {
          event.preventDefault();
          closePicker();
        }
      }}
      ref={shell}
    >
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="quota"
        onClick={() => {
          setOpen((current) => !current);
          setConfirming(false);
        }}
        ref={trigger}
        type="button"
      >
        {quotas.map((quota, index) => (
          <span key={index}>
            <i style={{ width: `${quota.used}%` }} />
            {quotaWindowLabel(quota.durationMinutes, index)}&nbsp;{" "}
            {100 - quota.used} %
          </span>
        ))}
      </button>
      {open && (
        <div
          aria-label={t("quotaPicker.title")}
          aria-modal="false"
          className="quota-quick-picker"
          role="dialog"
        >
          <div className="quota-quick-picker-heading">
            <Clock3 />
            <div>
              <strong>{t("quotaPicker.title")}</strong>
              <small>{t("quotaPicker.detail")}</small>
            </div>
          </div>
          <div className="quota-quick-picker-windows">
            {quotas.map((quota, index) => (
              <div className="quota-quick-picker-window" key={index}>
                <div>
                  <strong>
                    {quotaWindowLabel(quota.durationMinutes, index)}
                  </strong>
                  <span>{100 - quota.used} %</span>
                </div>
                <div className="quota-quick-picker-track">
                  <i style={{ width: `${quota.used}%` }} />
                </div>
                <small>
                  {quota.resetsAt
                    ? t("quotaPicker.resetsAt", {
                        date: formatDate(quota.resetsAt, locale),
                      })
                    : t("quotaPicker.resetUnknown")}
                </small>
              </div>
            ))}
          </div>
          <div className="quota-quick-picker-reset">
            <div>
              <TicketCheck />
              <span>
                {available === 1
                  ? t("reset.availableOne")
                  : available > 1
                    ? t("reset.availableMany", { count: available })
                    : t("reset.none")}
              </span>
            </div>
            {credit?.expiresAt && (
              <small>
                {t("reset.expires", {
                  date: formatDate(credit.expiresAt, locale),
                })}
              </small>
            )}
            {resetMessage && <p role="status">{resetMessage}</p>}
            {error && <p className="quota-quick-picker-error" role="alert">{error}</p>}
            {confirming ? (
              <div
                aria-label={t("reset.confirmationLabel")}
                className="quota-quick-picker-confirm"
                role="group"
              >
                <span>{t("reset.question")}</span>
                <button onClick={() => setConfirming(false)} type="button">
                  {t("common.cancel")}
                </button>
                <button
                  className="primary"
                  disabled={consuming}
                  onClick={() => {
                    setConfirming(false);
                    void onConsumeReset(credit?.id);
                  }}
                  type="button"
                >
                  {consuming ? t("reset.running") : t("common.confirm")}
                </button>
              </div>
            ) : (
              <button
                disabled={available < 1 || consuming}
                onClick={() => setConfirming(true)}
                type="button"
              >
                <RotateCcw className={consuming ? "spin" : undefined} />
                {consuming ? t("reset.running") : t("reset.action")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp * 1000);
}
