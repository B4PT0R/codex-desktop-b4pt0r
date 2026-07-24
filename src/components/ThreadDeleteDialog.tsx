import { Trash2 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";

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
        <span className="thread-delete-icon">
          <Trash2 />
        </span>
        <div>
          <h2 id="thread-delete-title">{t("thread.delete.title")}</h2>
          <p id="thread-delete-description">
            {t("thread.delete.description", { title })}
          </p>
          <p className="thread-delete-warning">{t("thread.delete.warning")}</p>
        </div>
        <div className="modal-actions">
          <button
            data-dialog-initial-focus
            disabled={deleting}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button className="danger" disabled={deleting} onClick={onConfirm}>
            {deleting
              ? t("thread.delete.deleting")
              : t("thread.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
