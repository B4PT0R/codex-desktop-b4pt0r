import { useI18n } from "../i18n/I18nProvider";
import {
  useAppearance,
  type FontSizePreference,
  type ThemePreference,
} from "../lib/AppearanceProvider";

export function AppearanceSettings() {
  const { t } = useI18n();
  const appearance = useAppearance();

  return (
    <section className="settings-page">
      <header>
        <p>{t("settings.appearance.description")}</p>
      </header>
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
      {appearance.persistenceError && (
        <p className="settings-inline-error" role="alert">
          {t("settings.persistence.error")} {appearance.persistenceError}
        </p>
      )}
    </section>
  );
}
