import { FileText, RotateCcw, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";
import { useWorkspaceAgents } from "../lib/useWorkspaceAgents";
import "../workspace-agents.css";
import { IconButton } from "./IconButton";

export function WorkspaceAgentsButton({
  cwd,
  nativeApp,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  cwd: string;
  nativeApp: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { t } = useI18n();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [confirmingClose, setConfirmingClose] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const agents = useWorkspaceAgents({
    enabled: open,
    nativeApp,
    workspace: cwd,
  });

  function requestClose() {
    if (agents.dirty) {
      setConfirmingClose(true);
      return;
    }
    setOpen(false);
  }

  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLElement>({
    active: open,
    onEscape: requestClose,
  });

  useEffect(() => {
    if (!open || agents.loading || !agents.document) return;
    editor.current?.focus();
  }, [agents.document, agents.loading, open]);

  useEffect(() => {
    setOpen(false);
    setConfirmingClose(false);
  }, [cwd]);

  if (!cwd) return null;

  return (
    <>
      {!hideTrigger && (
        <IconButton
          className="workspace-agents-trigger"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t("agents.open")}
          icon={FileText}
          label="AGENTS.md"
          title={t("agents.open")}
          onClick={() => setOpen(true)}
          variant="tertiary"
        />
      )}
      {open && (
        <div
          className="workspace-agents-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) requestClose();
          }}
        >
          <section
            ref={dialogRef}
            className="workspace-agents-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("agents.title")}
            onKeyDown={(event) => {
              onDialogKeyDown(event);
              if (event.defaultPrevented) return;
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "s"
              ) {
                event.preventDefault();
                void agents.save();
              }
            }}
          >
            <header>
              <span>
                <strong>{t("agents.title")}</strong>
                <small>
                  {agents.document?.filePath ?? `${cwd}/AGENTS.md`}
                </small>
              </span>
              {!nativeApp && <em>{t("agents.preview")}</em>}
              <IconButton
                aria-label={t("agents.close")}
                icon={X}
                onClick={requestClose}
                variant="tertiary"
              />
            </header>
            <p>{t("agents.description")}</p>
            <div className="workspace-agents-editor">
              {agents.loading ? (
                <div role="status">
                  <span className="settings-loader-spinner" />
                  {t("agents.loading")}
                </div>
              ) : (
                <textarea
                  ref={editor}
                  data-workspace-agents-editor
                  aria-label={t("agents.editor")}
                  disabled={!agents.document || agents.saving}
                  placeholder={t("agents.placeholder")}
                  spellCheck={false}
                  value={agents.draft}
                  onChange={(event) => agents.setDraft(event.target.value)}
                />
              )}
            </div>
            {agents.error && (
              <div className="workspace-agents-message error" role="alert">
                <strong>{t("agents.error")}</strong>
                <small>{agents.error}</small>
              </div>
            )}
            {agents.saved && (
              <div className="workspace-agents-message success" role="status">
                {t("agents.saved")}
              </div>
            )}
            <footer>
              {confirmingClose ? (
                <span className="workspace-agents-discard">
                  <small>{t("agents.discardConfirm")}</small>
                  <button onClick={() => setConfirmingClose(false)}>
                    {t("common.cancel")}
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setConfirmingClose(false);
                      setOpen(false);
                    }}
                  >
                    {t("agents.discard")}
                  </button>
                </span>
              ) : (
                <>
                  <button
                    className="secondary-button"
                    disabled={agents.loading || agents.saving}
                    onClick={() => void agents.load()}
                  >
                    <RotateCcw />
                    {t("agents.reload")}
                  </button>
                  <button
                    disabled={
                      !agents.dirty || agents.loading || agents.saving
                    }
                    onClick={() => void agents.save()}
                  >
                    <Save />
                    {agents.saving
                      ? t("agents.saving")
                      : t("agents.save")}
                  </button>
                </>
              )}
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
