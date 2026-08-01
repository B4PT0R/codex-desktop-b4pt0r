import { RefreshCw, UserRound } from "lucide-react";
import type { AccountController } from "../lib/useAccount";
import type { RateLimitsController } from "../lib/useRateLimits";
import { RateLimitResetCard } from "./RateLimitResetCard";
import { WorkspaceMessages } from "./WorkspaceMessages";
import { AccountAuthActions } from "./AccountAuthActions";
import { useI18n } from "../i18n/I18nProvider";
import { SettingsPageHeader } from "./SettingsPageHeader";
import {
  SettingsControlsBar,
  SettingsControlsBarButton,
} from "./SettingsControlsBar";
import type { MessageKey } from "../i18n/locales/fr";
import { IconCard } from "./IconCard";
import { CardStack } from "./CardStack";
import { Alert } from "./Alert";

export function AccountSettings({
  controller,
  rateLimits,
}: {
  controller: AccountController;
  rateLimits: RateLimitsController;
}) {
  const { locale, t } = useI18n();
  const identity = accountIdentity(controller, t);
  const summary = controller.usage?.summary;
  const buckets = controller.usage?.dailyUsageBuckets ?? [];
  const visibleBuckets = buckets.slice(-30);
  const maxTokens = Math.max(
    ...visibleBuckets.map((bucket) => bucket.tokens),
    1,
  );
  return (
    <section className="settings-page account-page">
      <SettingsPageHeader description={t("account.description")} />
      {controller.error && (
        <Alert tone="error">
          {controller.error}
        </Alert>
      )}
      {rateLimits.error && !rateLimits.resetCredits && (
        <Alert tone="error">
          {t("account.rateLimitsError")} {rateLimits.error}
        </Alert>
      )}
      <CardStack
        controlBar={<SettingsControlsBar
          actions={
          <SettingsControlsBarButton
            disabled={controller.loading || rateLimits.loading}
            icon={RefreshCw}
            iconClassName={
              controller.loading || rateLimits.loading ? "spin" : undefined
            }
            onClick={() =>
              void Promise.all([controller.refresh(), rateLimits.refresh()])
            }
          >
            {t("account.refresh")}
          </SettingsControlsBarButton>
          }
          label={t("account.data")}
        />}
      >
          <IconCard
            icon={<UserRound />}
            subtitle={identity.detail}
            title={identity.title}
            trailing={<em className="account-plan-badge">{identity.plan}</em>}
          />
      </CardStack>
      <AccountAuthActions controller={controller} />
      <RateLimitResetCard controller={rateLimits} />
      <WorkspaceMessages
        messages={controller.workspaceMessages}
        rateLimits={rateLimits}
      />
      {summary && (
        <div className="account-metrics">
          <Metric
            label={t("account.metric.lifetimeTokens")}
            value={compactNumber(summary.lifetimeTokens, locale)}
          />
          <Metric
            label={t("account.metric.peakDailyTokens")}
            value={compactNumber(summary.peakDailyTokens, locale)}
          />
          <Metric
            label={t("account.metric.currentStreak")}
            value={days(summary.currentStreakDays, t)}
          />
          <Metric
            label={t("account.metric.longestStreak")}
            value={days(summary.longestStreakDays, t)}
          />
        </div>
      )}
      {buckets.length > 0 && (
        <section
          className="settings-card usage-chart"
          aria-label={t("account.usage.label")}
        >
          <header>
            <strong>{t("account.usage.recent")}</strong>
            <small>
              {visibleBuckets.length} {t("account.usage.recentDays")}
            </small>
          </header>
          <div>
            {visibleBuckets.map((bucket) => (
              <span
                key={bucket.startDate}
                title={`${bucket.startDate} · ${bucket.tokens.toLocaleString(locale)} ${t("account.usage.tokens")}`}
              >
                <i
                  style={{
                    height: `${Math.max(4, (bucket.tokens / maxTokens) * 100)}%`,
                  }}
                />
              </span>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function accountIdentity(
  controller: AccountController,
  t: (key: MessageKey) => string,
) {
  const account = controller.account?.account;
  if (!account) {
    return {
      title: controller.loading
        ? t("account.identity.loading")
        : t("account.identity.none"),
      detail: controller.account?.requiresOpenaiAuth
        ? t("account.identity.required")
        : t("account.identity.anonymous"),
      plan: t("account.identity.disconnected"),
    };
  }
  if (account.type === "chatgpt") {
    return {
      title: account.email
        ? maskEmail(account.email, t("account.identity.chatgpt"))
        : t("account.identity.chatgpt"),
      detail: t("account.identity.codexManaged"),
      plan: planLabel(account.planType),
    };
  }
  if (account.type === "amazonBedrock") {
    return {
      title: "Amazon Bedrock",
      detail: account.usesCodexManagedCredentials
        ? t("account.identity.bedrockManaged")
        : t("account.identity.environmentManaged"),
      plan: "Bedrock",
    };
  }
  return {
    title: t("account.identity.apiKey"),
    detail: t("account.identity.apiKeyDetail"),
    plan: "API",
  };
}

function planLabel(plan: string) {
  return plan === "prolite"
    ? "Pro"
    : plan.charAt(0).toLocaleUpperCase() + plan.slice(1);
}

function maskEmail(email: string, fallback: string) {
  const separator = email.lastIndexOf("@");
  if (separator <= 0) return fallback;
  return `${email.charAt(0)}•••${email.slice(separator)}`;
}

function compactNumber(value: number | null, locale: string) {
  return value == null
    ? "—"
    : new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
}

function days(value: number | null, t: (key: MessageKey) => string) {
  return value == null ? "—" : `${value} ${t("account.usage.daySuffix")}`;
}
