import { ShieldCheck } from "lucide-react";
import type { Approval } from "../types";
import { useDialogFocus } from "../lib/useDialogFocus";
import { useI18n } from "../i18n/I18nProvider";

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
        <span className="approval-icon">
          <ShieldCheck />
        </span>
        <h2 id="approval-title">{approval.title}</h2>
        <p>{approval.description}</p>
        {approval.command && <code>{approval.command}</code>}
        <div className="modal-actions">
          <button data-dialog-initial-focus onClick={() => onDecide("decline")}>
            {t("approval.decline")}
          </button>
          {approval.allowSession && (
            <button onClick={() => onDecide("session")}>
              {t("approval.session")}
            </button>
          )}
          <button className="primary" onClick={() => onDecide("accept")}>
            {t("approval.once")}
          </button>
        </div>
      </div>
    </div>
  );
}
