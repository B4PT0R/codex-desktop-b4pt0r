import { Trash2 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";

export function McpServerRemoveDialog({
  name,
  removing,
  onCancel,
  onConfirm,
}: {
  name: string;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: removing ? undefined : onCancel,
  });

  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="modal thread-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mcp-remove-title"
        aria-describedby="mcp-remove-description"
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <RoundIcon className="thread-delete-icon" icon={Trash2} size="large" variant="primary" />
        <div>
          <h2 id="mcp-remove-title">{t("integrations.mcp.removeTitle")}</h2>
          <p id="mcp-remove-description">{t("integrations.mcp.removeDetail", { name })}</p>
          <p className="thread-delete-warning">{t("integrations.mcp.removeWarning")}</p>
        </div>
        <div className="modal-actions">
          <IconButton data-dialog-initial-focus disabled={removing} label={t("common.cancel")} onClick={onCancel} variant="secondary" />
          <IconButton className="danger" disabled={removing} icon={Trash2} label={removing ? t("integrations.mcp.removing") : t("integrations.mcp.removeConfirm")} onClick={onConfirm} variant="secondary" />
        </div>
      </div>
    </div>
  );
}
