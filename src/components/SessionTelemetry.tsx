import { Route } from "lucide-react";
import {
  rerouteReason,
  type ModelReroute,
} from "../lib/sessionTelemetry";
import { useI18n } from "../i18n/I18nProvider";

export function SessionTelemetry({
  reroute,
}: {
  reroute?: ModelReroute;
}) {
  const { t } = useI18n();
  if (!reroute) return null;
  return (
    <div className="session-telemetry" aria-label={t("telemetry.label")}>
      <span
        className="model-reroute"
        title={`${reroute.fromModel} → ${reroute.toModel} · ${rerouteReason(reroute.reason, t)}`}
      >
        <Route />
        {t("telemetry.rerouted", { model: reroute.toModel })}
      </span>
    </div>
  );
}
