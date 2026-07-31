import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { isDesktopApp } from "../lib/nativeBridge";
import type { CodexGlobalSettingsController } from "../lib/useCodexGlobalSettings";
import { ConfigDocumentEditor } from "./ConfigDocumentEditor";

export function DeveloperInstructionsSettings({
  controller,
}: {
  controller: CodexGlobalSettingsController;
}) {
  const { t } = useI18n();
  const value = controller.advanced.developerInstructions ?? "";
  const lastValue = useRef(value);
  const [baseline, setBaseline] = useState(value);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (lastValue.current === value) return;
    lastValue.current = value;
    setBaseline(value);
    setDraft(value);
  }, [value]);

  async function reload() {
    setSaved(false);
    setBaseline(value);
    setDraft(value);
    await controller.refresh();
  }

  async function save() {
    if (saving || draft === baseline) return;
    setSaving(true);
    setSaved(false);
    const nextValue = draft.trim() ? draft : null;
    try {
      if (
        await controller.setAdvanced("developer_instructions", nextValue)
      ) {
        const normalized = nextValue ?? "";
        lastValue.current = normalized;
        setBaseline(normalized);
        setDraft(normalized);
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ConfigDocumentEditor
      title={t("settings.developerInstructions.title")}
      description={t("settings.developerInstructions.description")}
      fileName="developer_instructions"
      filePath="~/.codex/config.toml"
      editorLabel={t("settings.developerInstructions.editor")}
      draft={draft}
      dirty={draft !== baseline}
      error={controller.error}
      errorTitle={t("settings.developerInstructions.error")}
      loading={controller.loading}
      native={isDesktopApp()}
      onChange={(next) => {
        setDraft(next);
        setSaved(false);
      }}
      onReload={reload}
      onSave={save}
      placeholder={t("settings.developerInstructions.placeholder")}
      restartNote={t("settings.developerInstructions.restart")}
      saved={saved}
      savedMessage={t("settings.developerInstructions.saved")}
      saving={saving}
    />
  );
}
