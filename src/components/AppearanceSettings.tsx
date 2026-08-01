import { useI18n } from "../i18n/I18nProvider";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { IconSubheader } from "./IconSubheader";
import {
  useAppearance,
  type FontSizePreference,
  type ThemePreference,
} from "../lib/AppearanceProvider";
import type { ReasoningSummaryMode } from "../lib/protocol";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import { Alert } from "./Alert";
import {
  MAX_VISIBLE_ACTIONS,
  MIN_VISIBLE_ACTIONS,
  type ChatPresentationSettingsController,
} from "../lib/useChatPresentationSettings";

const reasoningSummaryModes: ReasoningSummaryMode[] = [
  "auto",
  "concise",
  "detailed",
  "none",
];

export function AppearanceSettings({
  globalSettings,
  presentation,
}: {
  globalSettings: Pick<
    CodexGlobalSettingsController,
    "loading" | "reasoningSummary" | "setReasoningSummary"
  >;
  presentation: ChatPresentationSettingsController;
}) {
  const { t } = useI18n();
  const appearance = useAppearance();

  return (
    <section className="settings-page">
      <SettingsPageHeader description={t("settings.appearance.description")} />
      <IconSubheader
        title={t("settings.appearance.interface.title")}
        subtitle={t("settings.appearance.interface.description")}
      />
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.appearance.theme")}</strong>
            <small>{t("settings.appearance.themeDetail")}</small>
          </span>
          <select
            aria-label={t("settings.appearance.theme")}
            value={appearance.theme}
            onChange={(event) =>
              appearance.setTheme(event.target.value as ThemePreference)
            }
          >
            <option value="system">{t("settings.appearance.system")}</option>
            <option value="dark">{t("settings.appearance.dark")}</option>
            <option value="light">{t("settings.appearance.light")}</option>
          </select>
        </label>
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.appearance.fontSize")}</strong>
            <small>{t("settings.appearance.fontSizeDetail")}</small>
          </span>
          <select
            aria-label={t("settings.appearance.fontSize")}
            value={appearance.fontSize}
            onChange={(event) =>
              appearance.setFontSize(
                event.target.value as FontSizePreference,
              )
            }
          >
            <option value="small">{t("settings.appearance.small")}</option>
            <option value="default">{t("settings.appearance.default")}</option>
            <option value="large">{t("settings.appearance.large")}</option>
          </select>
        </label>
      </div>
      <IconSubheader
        title={t("settings.appearance.conversation.title")}
        subtitle={t("settings.appearance.conversation.description")}
      />
      <div className="settings-card settings-fields">
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.reasoningSummary.title")}</strong>
            <small>{t("settings.reasoningSummary.detail")}</small>
          </span>
          <select
            aria-label={t("settings.reasoningSummary.title")}
            disabled={globalSettings.loading}
            value={globalSettings.reasoningSummary}
            onChange={(event) =>
              void globalSettings.setReasoningSummary(
                event.target.value as ReasoningSummaryMode,
              )
            }
          >
            {reasoningSummaryModes.map((mode) => (
              <option key={mode} value={mode}>
                {t(`settings.reasoningSummary.${mode}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="settings-field-description">
            <strong>{t("settings.appearance.visibleActions.title")}</strong>
            <small>{t("settings.appearance.visibleActions.detail")}</small>
          </span>
          <select
            aria-label={t("settings.appearance.visibleActions.title")}
            disabled={presentation.loading || presentation.saving}
            value={presentation.maxVisibleActions}
            onChange={(event) =>
              void presentation.setMaxVisibleActions(
                Number(event.target.value),
              )
            }
          >
            {Array.from(
              {
                length:
                  MAX_VISIBLE_ACTIONS - MIN_VISIBLE_ACTIONS + 1,
              },
              (_, index) => MIN_VISIBLE_ACTIONS + index,
            ).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      </div>
      {appearance.persistenceError && (
        <Alert tone="error">
          {t("settings.persistence.error")} {appearance.persistenceError}
        </Alert>
      )}
      {presentation.error && (
        <Alert tone="error">
          {t("settings.appearance.visibleActions.error")} {presentation.error}
        </Alert>
      )}
    </section>
  );
}
