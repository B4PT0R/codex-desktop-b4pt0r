import type { MessageKey } from "../i18n/locales/fr";

export function reasoningEffortLabel(
  effort: string,
  t: (key: MessageKey) => string,
) {
  return (
    (
      {
        none: t("settings.effort.minimal"),
        minimal: t("settings.effort.minimal"),
        low: t("settings.effort.low"),
        medium: t("settings.effort.medium"),
        high: t("settings.effort.high"),
        xhigh: t("settings.effort.xhigh"),
        ultra: t("settings.effort.ultra"),
      } as Record<string, string>
    )[effort] ?? effort
  );
}
