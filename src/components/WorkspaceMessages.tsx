import { Mail, Megaphone } from "lucide-react";
import type { GetWorkspaceMessagesResponse } from "../lib/appServerTypes";
import {
  nudgeCreditType,
  type RateLimitsController,
} from "../lib/useRateLimits";
import { useI18n } from "../i18n/I18nProvider";

export function WorkspaceMessages({
  messages,
  rateLimits,
}: {
  messages: GetWorkspaceMessagesResponse | null;
  rateLimits: RateLimitsController;
}) {
  const { locale, t } = useI18n();
  const creditType = nudgeCreditType(rateLimits.reachedType);
  const visible = messages?.featureEnabled ? messages.messages : [];
  if (visible.length === 0 && !creditType) return null;

  return (
    <section
      className="workspace-messages"
      aria-label={t("workspaceMessages.label")}
    >
      {creditType && (
        <div className="settings-card owner-nudge">
          <Mail />
          <span>
            <strong>
              {creditType === "credits"
                ? t("workspaceMessages.credits")
                : t("workspaceMessages.limit")}
            </strong>
            <small>{t("workspaceMessages.nudgeDetail")}</small>
            {rateLimits.nudgeMessage && (
              <small className="owner-nudge-result" role="status">
                {rateLimits.nudgeMessage}
              </small>
            )}
          </span>
          <button
            disabled={rateLimits.nudging}
            onClick={() => void rateLimits.sendOwnerNudge()}
          >
            {rateLimits.nudging
              ? t("workspaceMessages.sending")
              : t("workspaceMessages.nudge")}
          </button>
        </div>
      )}
      {visible.length > 0 && (
        <div className="settings-card workspace-message-list">
          {visible.map((message) => (
            <article key={message.messageId}>
              <Megaphone />
              <span>
                <strong>
                  {message.messageType === "headline"
                    ? t("workspaceMessages.headline")
                    : t("workspaceMessages.announcement")}
                </strong>
                <p>{message.messageBody}</p>
                {message.createdAt && (
                  <small>{formatDate(message.createdAt, locale)}</small>
                )}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(timestamp: number, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    timestamp * 1000,
  );
}
