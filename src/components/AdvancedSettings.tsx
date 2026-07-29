import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/locales/fr";
import type { ExternalAgentImportController } from "../lib/useExternalAgentImport";
import { ExternalAgentImportSettings } from "./ExternalAgentImportSettings";

const plannedItems: Array<{ title: MessageKey; detail: MessageKey }> = [
  {
    title: "settings.advanced.experimental",
    detail: "settings.advanced.experimentalDetail",
  },
  {
    title: "settings.advanced.diagnostics",
    detail: "settings.advanced.diagnosticsDetail",
  },
];

export function AdvancedSettings({
  controller,
}: {
  controller: ExternalAgentImportController;
}) {
  const { t } = useI18n();
  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.advanced.description")}</p>
      </header>
      <ExternalAgentImportSettings controller={controller} />
      <div className="settings-card planned-settings">
        {plannedItems.map((item) => (
          <div key={item.title}>
            <span>
              <strong>{t(item.title)}</strong>
              <small>{t(item.detail)}</small>
            </span>
            <em>{t("settings.toConnect")}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
