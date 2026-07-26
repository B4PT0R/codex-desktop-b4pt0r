import { useI18n } from "../i18n/I18nProvider";
import { useGlobalAgents } from "../lib/useGlobalAgents";
import { ConfigDocumentEditor } from "./ConfigDocumentEditor";

export function GlobalAgentsSettings() {
  const { t } = useI18n();
  const agents = useGlobalAgents();

  const overrideNotice = agents.document?.overrideActive ? (
    <div className="inventory-message warning" role="status">
      <strong>{t("settings.globalAgents.overrideTitle")}</strong>
      <small>
        {t("settings.globalAgents.overrideDetail", {
          path: agents.document.overrideFilePath,
        })}
      </small>
    </div>
  ) : undefined;

  return (
    <ConfigDocumentEditor
      title={t("settings.globalAgents.title")}
      description={t("settings.globalAgents.description")}
      fileName="AGENTS.md"
      filePath={agents.document?.filePath ?? "~/.codex/AGENTS.md"}
      editorLabel={t("settings.globalAgents.editor")}
      draft={agents.draft}
      dirty={agents.dirty}
      error={agents.error}
      errorTitle={t("settings.globalAgents.error")}
      loading={agents.loading}
      native={agents.native}
      notice={overrideNotice}
      onChange={agents.setDraft}
      onReload={agents.load}
      onSave={agents.save}
      placeholder={t("settings.globalAgents.placeholder")}
      restartNote={t("settings.globalAgents.restart")}
      saved={agents.saved}
      savedMessage={t("settings.globalAgents.saved")}
      saving={agents.saving}
    />
  );
}
