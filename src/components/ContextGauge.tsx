import type { CSSProperties } from "react";
import type { ContextUsage } from "../lib/sessionTelemetry";
import { compactTokenCount } from "../lib/sessionTelemetry";
import { useI18n } from "../i18n/I18nProvider";

export function ContextGauge({
  context,
  disabled,
  onCompact,
}: {
  context?: ContextUsage;
  disabled: boolean;
  onCompact: () => void;
}) {
  const { t } = useI18n();
  if (!context) return null;
  const level =
    context.percentUsed >= 90
      ? "critical"
      : context.percentUsed >= 70
        ? "warning"
        : "healthy";
  const title = t("telemetry.contextTitle", {
    used: compactTokenCount(context.usedTokens),
    window: compactTokenCount(context.windowTokens),
    total: compactTokenCount(context.totalTokens),
    output: compactTokenCount(context.lastOutputTokens),
  });

  return (
    <button
      aria-label={t("telemetry.compact", { percent: context.percentUsed })}
      className={`context-gauge ${level}`}
      disabled={disabled}
      onClick={onCompact}
      title={`${title} · ${t("chat.actions.compact")}`}
    >
      <span
        aria-hidden="true"
        className="context-gauge-ring"
        style={
          { "--context-used": `${context.percentUsed}%` } as CSSProperties
        }
      >
        <b>{context.percentUsed}</b>
      </span>
    </button>
  );
}
