import { FolderOpen, MessagesSquare } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";

type NewChatDialogProps = {
  onCancel: () => void;
  onDiscussion: () => void;
  onProject: () => void;
};

export function NewChatDialog({
  onCancel,
  onDiscussion,
  onProject,
}: NewChatDialogProps) {
  const { t } = useI18n();
  const { dialogRef, onDialogKeyDown } = useDialogFocus({
    initialFocusSelector: "[data-dialog-initial-focus]",
    onEscape: onCancel,
  });
  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="modal new-chat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        aria-describedby="new-chat-description"
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <div>
          <h2 id="new-chat-title">{t("newChat.title")}</h2>
          <p id="new-chat-description">{t("newChat.description")}</p>
        </div>
        <div className="new-chat-choices">
          <button data-dialog-initial-focus onClick={onDiscussion}>
            <MessagesSquare />
            <span>
              <strong>{t("newChat.discussion")}</strong>
              <small>{t("newChat.discussionDetail")}</small>
            </span>
          </button>
          <button onClick={onProject}>
            <FolderOpen />
            <span>
              <strong>{t("newChat.project")}</strong>
              <small>{t("newChat.projectDetail")}</small>
            </span>
          </button>
        </div>
        <button className="new-chat-cancel" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
