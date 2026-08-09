import { useState } from "react";
import { AudioLines } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";

export function VoiceInstructionsDialog({
  initialValue,
  saving,
  onCancel,
  onSave,
}: {
  initialValue: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLFormElement>({
    onEscape: onCancel,
  });
  return (
    <div className="overlay">
      <form
        aria-labelledby="voice-instructions-title"
        aria-modal="true"
        className="modal settings-form-dialog voice-instructions-dialog"
        onKeyDown={onDialogKeyDown}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(value).then((saved) => saved && onCancel());
        }}
        ref={dialogRef}
        role="dialog"
      >
        <div className="settings-form-dialog-heading">
          <RoundIcon icon={AudioLines} size="large" variant="primary" />
          <div>
            <h2 id="voice-instructions-title">
              {t("settings.voice.instructionsDialogTitle")}
            </h2>
            <small>{t("settings.voice.instructionsDialogDetail")}</small>
          </div>
        </div>
        <div className="settings-form-dialog-body">
          <label className="settings-field">
            <span>{t("settings.voice.instructionsEditor")}</span>
            <textarea
              autoFocus
              disabled={saving}
              maxLength={32_768}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t("settings.voice.instructionsPlaceholder")}
              rows={7}
              value={value}
            />
          </label>
          <small className="settings-field-detail">
            {t("settings.voice.instructionsEmptyDetail")}
          </small>
        </div>
        <div className="modal-actions">
          <IconButton
            disabled={saving}
            label={t("common.cancel")}
            onClick={onCancel}
            variant="secondary"
          />
          <IconButton
            className="primary"
            disabled={saving}
            label={t(saving ? "common.saving" : "common.save")}
            type="submit"
            variant="secondary"
          />
        </div>
      </form>
    </div>
  );
}
