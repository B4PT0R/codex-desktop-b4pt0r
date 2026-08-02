import { RotateCcw, TicketCheck } from "lucide-react";
import { useState } from "react";
import type { RateLimitsController } from "../lib/useRateLimits";
import { useI18n } from "../i18n/I18nProvider";
import { IconCard } from "./IconCard";
import { CardStack } from "./CardStack";
import { IconButton } from "./IconButton";
import { Alert } from "./Alert";

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
    <CardStack className="reset-credit-card">
      <IconCard
        icon={<TicketCheck />}
        title={t("reset.title")}
        subtitle={
          <>
          {available > 0
            ? t(
                available === 1 ? "reset.availableOne" : "reset.availableMany",
                {
                  count: available,
                },
              )
            : t("reset.none")}
          </>
        }
        trailing={confirming ? (
          <div
            className="reset-credit-confirm"
            role="group"
            aria-label={t("reset.confirmationLabel")}
          >
            <span>{t("reset.question")}</span>
            <IconButton label={t("common.cancel")} onClick={() => setConfirming(false)} size="medium" variant="secondary" />
            <IconButton
              disabled={controller.consuming}
              icon={RotateCcw}
              label={controller.consuming ? t("reset.running") : t("common.confirm")}
              onClick={() => {
                setConfirming(false);
                void controller.consumeReset(credit?.id);
              }}
              size="medium"
              variant="primary"
            />
          </div>
        ) : (
          <IconButton
            disabled={available < 1 || controller.consuming}
            icon={RotateCcw}
            iconClassName={controller.consuming ? "spin" : undefined}
            label={controller.consuming ? t("reset.running") : t("reset.action")}
            onClick={() => setConfirming(true)}
            size="medium"
            variant="secondary"
          />
        )}
      >
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
          <Alert tone="error">
            {controller.error}
          </Alert>
        )}
      </IconCard>
    </CardStack>
  );
}

function formatDate(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp * 1000);
}
