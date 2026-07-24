import { RotateCcw, TicketCheck } from "lucide-react";
import { useState } from "react";
import type { RateLimitsController } from "../lib/useRateLimits";
import { useI18n } from "../i18n/I18nProvider";

export function RateLimitResetCard({
  controller,
}: {
  controller: RateLimitsController;
}) {
  const { locale, t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const summary = controller.resetCredits;
  if (!summary) return null;
  const available = summary.availableCount;
  const credit = summary.credits?.find((item) => item.status === "available");

  return (
    <section className="settings-card reset-credit-card">
      <TicketCheck />
      <div>
        <strong>{t("reset.title")}</strong>
        <small>
          {available > 0
            ? t(
                available === 1 ? "reset.availableOne" : "reset.availableMany",
                {
                  count: available,
                },
              )
            : t("reset.none")}
        </small>
        {credit?.expiresAt && (
          <small>
            {t("reset.expires", {
              date: formatDate(credit.expiresAt, locale),
            })}
          </small>
        )}
        {controller.resetMessage && (
          <p className="reset-credit-result" role="status">
            {controller.resetMessage}
          </p>
        )}
        {controller.error && (
          <p className="reset-credit-error" role="alert">
            {controller.error}
          </p>
        )}
      </div>
      {confirming ? (
        <div
          className="reset-credit-confirm"
          role="group"
          aria-label={t("reset.confirmationLabel")}
        >
          <span>{t("reset.question")}</span>
          <button onClick={() => setConfirming(false)}>
            {t("common.cancel")}
          </button>
          <button
            className="primary"
            disabled={controller.consuming}
            onClick={() => {
              setConfirming(false);
              void controller.consumeReset(credit?.id);
            }}
          >
            {controller.consuming ? t("reset.running") : t("common.confirm")}
          </button>
        </div>
      ) : (
        <button
          disabled={available < 1 || controller.consuming}
          onClick={() => setConfirming(true)}
        >
          <RotateCcw className={controller.consuming ? "spin" : undefined} />
          {controller.consuming ? t("reset.running") : t("reset.action")}
        </button>
      )}
    </section>
  );
}

function formatDate(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp * 1000);
}
