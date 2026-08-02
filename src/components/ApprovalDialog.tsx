import { ShieldCheck } from "lucide-react";
import type { Approval } from "../types";
import { useDialogFocus } from "../lib/useDialogFocus";
import { useI18n } from "../i18n/I18nProvider";
import { RoundIcon } from "./RoundIcon";
import { IconButton } from "./IconButton";

type ApprovalDecision = "accept" | "session" | "decline";

type ApprovalDialogProps = {
  approval: Approval;
  onDecide: (decision: ApprovalDecision) => void;
};

export function ApprovalDialog({ approval, onDecide }: ApprovalDialogProps) {
  const { t } = useI18n();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
  });
  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="modal approval-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <RoundIcon
          className="approval-icon"
          icon={ShieldCheck}
          size="large"
          variant="primary"
        />
        <h2 id="approval-title">{approval.title}</h2>
        <p>{approval.description}</p>
        {approval.command && <code>{approval.command}</code>}
        <div className="modal-actions">
          <IconButton data-dialog-initial-focus label={t("approval.decline")} onClick={() => onDecide("decline")} variant="secondary" />
          {approval.allowSession && (
            <IconButton label={t("approval.session")} onClick={() => onDecide("session")} variant="secondary" />
          )}
          <IconButton label={t("approval.once")} onClick={() => onDecide("accept")} variant="primary" />
        </div>
      </div>
    </div>
  );
}
