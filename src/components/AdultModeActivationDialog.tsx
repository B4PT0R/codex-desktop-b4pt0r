import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIcon } from "./RoundIcon";
import { Alert } from "./Alert";
import { IconToggle } from "./IconToggle";
import { CardStack } from "./CardStack";

export function AdultModeActivationDialog({
  existingCredential,
  onCancel,
  onSubmit,
}: {
  existingCredential: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [adult, setAdult] = useState(existingCredential);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [validationError, setValidationError] = useState<
    "age" | "mismatch" | "short" | undefined
  >();
  const [saving, setSaving] = useState(false);
  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLFormElement>({
    onEscape: onCancel,
  });
  const mismatch = !existingCredential && confirmation !== password;

  return (
    <div className="overlay">
      <form
        ref={dialogRef}
        className="modal settings-form-dialog adult-mode-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adult-mode-dialog-title"
        onKeyDown={onDialogKeyDown}
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length < 8) {
            setValidationError("short");
            return;
          }
          if (mismatch) {
            setValidationError("mismatch");
            return;
          }
          if (!adult) {
            setValidationError("age");
            return;
          }
          setSaving(true);
          setInvalid(false);
          setValidationError(undefined);
          void onSubmit(password)
            .then((success) => setInvalid(!success))
            .finally(() => setSaving(false));
        }}
      >
        <div className="settings-form-dialog-heading adult-mode-dialog-heading">
          <RoundIcon icon={ShieldCheck} size="large" variant="primary" />
          <div>
            <h2 id="adult-mode-dialog-title">
              {t("settings.config.adultMode.dialogTitle")}
            </h2>
            <small>{t("settings.config.adultMode.dialogSubtitle")}</small>
          </div>
        </div>
        <div className="settings-form-dialog-body">
          <Alert tone="neutral">{t("settings.config.adultMode.dialogDetail")}</Alert>
          <div className="settings-form-fields">
            <label>
              <span>{t("settings.config.adultMode.password")}</span>
              <input autoFocus type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {!existingCredential && <label>
              <span>{t("settings.config.adultMode.confirmPassword")}</span>
              <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>}
            {!existingCredential && <CardStack className="settings-fields">
              <div className="settings-toggle-row">
                <span className="settings-field-description">
                  <strong>{t("settings.config.adultMode.ageConfirmation")}</strong>
                  <small>{t("settings.config.adultMode.ageConfirmationDetail")}</small>
                </span>
                <IconToggle checked={adult} label={t("settings.config.adultMode.ageConfirmation")} onCheckedChange={setAdult} />
              </div>
            </CardStack>}
            {(invalid || validationError) && <small className="field-error" role="alert">
              {t(invalid
                ? "settings.config.adultMode.invalidPassword"
                : validationError === "short"
                  ? "settings.config.adultMode.passwordTooShort"
                  : validationError === "mismatch"
                    ? "settings.config.adultMode.passwordMismatch"
                    : "settings.config.adultMode.ageRequired")}
            </small>}
          </div>
        </div>
        <div className="modal-actions"><button type="button" onClick={onCancel}>{t("common.cancel")}</button><button className="primary" disabled={saving} type="submit">{t(saving ? "settings.config.adultMode.activating" : "settings.config.adultMode.activate")}</button></div>
      </form>
    </div>
  );
}
