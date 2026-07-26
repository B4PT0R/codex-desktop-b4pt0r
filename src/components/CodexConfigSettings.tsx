import { useI18n } from "../i18n/I18nProvider";
import { useCodexConfig } from "../lib/useCodexConfig";
import { ConfigDocumentEditor } from "./ConfigDocumentEditor";
import { GlobalAgentsSettings } from "./GlobalAgentsSettings";

export function CodexConfigSettings() {
  const { t } = useI18n();
  const config = useCodexConfig();
  return (
    <section className="settings-page config-settings">
      <ConfigDocumentEditor
        title={t("settings.config.file")}
        description={t("settings.config.description")}
        fileName={t("settings.config.file")}
        filePath={config.document?.filePath ?? "~/.codex/config.toml"}
        editorLabel={t("settings.config.editor")}
        draft={config.draft}
        dirty={config.dirty}
        error={config.error}
        errorTitle={t("settings.config.error")}
        loading={config.loading}
        native={config.native}
        onChange={config.setDraft}
        onReload={config.load}
        onSave={config.save}
        restartNote={t("settings.config.restart")}
        saved={config.saved}
        savedMessage={t("settings.config.saved")}
        saving={config.saving}
      />
      <GlobalAgentsSettings />
    </section>
  );
}
