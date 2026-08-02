import { Trash2 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";

type ThreadDeleteDialogProps = {
  deleting: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ThreadDeleteDialog({
  deleting,
  title,
  onCancel,
  onConfirm,
}: ThreadDeleteDialogProps) {
  const { t } = useI18n();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: deleting ? undefined : onCancel,
  });

  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="modal thread-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="thread-delete-title"
        aria-describedby="thread-delete-description"
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <RoundIcon
          className="thread-delete-icon"
          icon={Trash2}
          size="large"
          variant="primary"
        />
        <div>
          <h2 id="thread-delete-title">{t("thread.delete.title")}</h2>
          <p id="thread-delete-description">
            {t("thread.delete.description", { title })}
          </p>
          <p className="thread-delete-warning">{t("thread.delete.warning")}</p>
        </div>
        <div className="modal-actions">
          <IconButton
            data-dialog-initial-focus
            disabled={deleting}
            label={t("common.cancel")}
            onClick={onCancel}
            variant="secondary"
          />
          <IconButton
            className="danger"
            disabled={deleting}
            icon={Trash2}
            label={deleting
              ? t("thread.delete.deleting")
              : t("thread.delete.confirm")}
            onClick={onConfirm}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
