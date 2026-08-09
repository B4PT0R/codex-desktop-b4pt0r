import { Heart } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export function AdultModeIndicator({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  if (!enabled) return null;
  const label = t("telemetry.adultModeEnabled");
  return (
    <span aria-label={label} className="adult-mode-indicator" role="status" title={t("telemetry.adultModeEnabledDetail")}>
      <Heart aria-hidden="true" fill="currentColor" />
    </span>
  );
}
