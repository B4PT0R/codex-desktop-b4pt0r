import { TerminalSquare } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { ShellCommandController } from "../lib/useShellCommand";
import { useDialogFocus } from "../lib/useDialogFocus";
import { IconButton } from "./IconButton";

export function ShellCommandDialog({
  controller,
}: {
  controller: ShellCommandController;
}) {
  const { t } = useI18n();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: controller.executing ? undefined : controller.cancel,
  });
  if (!controller.pending) return null;
  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="modal shell-command-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="shell-command-title"
        aria-describedby="shell-command-description"
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <span className="shell-command-icon">
          <TerminalSquare />
        </span>
        <div>
          <h2 id="shell-command-title">{t("shellCommand.title")}</h2>
          <p id="shell-command-description">{t("shellCommand.description")}</p>
          <p className="shell-command-warning">{t("shellCommand.warning")}</p>
          <code>{controller.pending}</code>
        </div>
        <div className="modal-actions">
          <IconButton
            data-dialog-initial-focus
            disabled={controller.executing}
            label={t("common.cancel")}
            onClick={controller.cancel}
            variant="secondary"
          />
          <IconButton
            className="danger"
            disabled={controller.executing}
            icon={TerminalSquare}
            label={controller.executing
              ? t("shellCommand.starting")
              : t("shellCommand.confirm")}
            onClick={() => void controller.confirm()}
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
