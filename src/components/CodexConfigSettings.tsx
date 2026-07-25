import { RotateCcw, Save } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useCodexConfig } from "../lib/useCodexConfig";

export function CodexConfigSettings() {
  const { t } = useI18n();
  const config = useCodexConfig();
  return (
    <section className="settings-page config-settings">
      <header>
        <p>{t("settings.config.description")}</p>
        <span className="scope-badge">{t("settings.config.global")}</span>
      </header>
      <div className="settings-card config-editor-card">
        <div className="config-editor-heading">
          <span>
            <strong>{t("settings.config.file")}</strong>
            <small>
              {config.document?.filePath ?? "~/.codex/config.toml"}
            </small>
          </span>
          {!config.native && (
            <em>{t("settings.config.preview")}</em>
          )}
        </div>
        {config.loading ? (
          <div className="config-editor-loading" role="status">
            <span className="settings-loader-spinner" />
            {t("settings.config.loading")}
          </div>
        ) : (
          <textarea
            aria-label={t("settings.config.editor")}
            value={config.draft}
            disabled={!config.document || config.saving}
            spellCheck={false}
            onChange={(event) => config.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "s") {
                event.preventDefault();
                void config.save();
              }
            }}
          />
        )}
      </div>
      {config.error && (
        <div className="inventory-message error" role="alert">
          <strong>{t("settings.config.error")}</strong>
          <small>{config.error}</small>
        </div>
      )}
      {config.saved && (
        <div className="inventory-message success" role="status">
          {t("settings.config.saved")}
        </div>
      )}
      <p className="config-restart-note">
        {t("settings.config.restart")}
      </p>
      <div className="config-editor-actions">
        <button
          className="secondary-button"
          disabled={config.loading || config.saving}
          onClick={() => void config.load()}
        >
          <RotateCcw /> {t("settings.config.reload")}
        </button>
        <button
          disabled={!config.dirty || config.loading || config.saving}
          onClick={() => void config.save()}
        >
          <Save />
          {config.saving
            ? t("settings.config.saving")
            : t("settings.config.save")}
        </button>
      </div>
    </section>
  );
}
