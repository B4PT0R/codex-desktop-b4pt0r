import { Trash2 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { SchedulerDeleteConfirmation } from "../lib/useSchedulerTools";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";

export function SchedulerToolConfirmationDialog({
  confirmation,
  submitting,
  onCancel,
  onConfirm,
}: {
  confirmation: SchedulerDeleteConfirmation;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: submitting ? undefined : onCancel,
  });
  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="modal thread-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="scheduler-tool-delete-title"
        aria-describedby="scheduler-tool-delete-description"
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
          <h2 id="scheduler-tool-delete-title">
            {t("schedulerTool.delete.title")}
          </h2>
          <p id="scheduler-tool-delete-description">
            {t("schedulerTool.delete.description", {
              name: confirmation.task.name,
            })}
          </p>
          <p className="thread-delete-warning">
            {t("schedulerTool.delete.warning")}
          </p>
        </div>
        <div className="modal-actions">
          <IconButton
            data-dialog-initial-focus
            disabled={submitting}
            label={t("common.cancel")}
            onClick={onCancel}
            variant="secondary"
          />
          <IconButton
            className="danger"
            disabled={submitting}
            icon={Trash2}
            label={submitting
              ? t("schedulerTool.delete.deleting")
              : t("schedulerTool.delete.confirm")}
            onClick={onConfirm}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
