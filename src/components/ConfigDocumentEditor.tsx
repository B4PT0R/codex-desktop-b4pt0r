import { FilePenLine, RotateCcw, Save, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useDialogFocus } from "../lib/useDialogFocus";
import { RoundIconButton } from "./RoundIcon";

type ConfigDocumentEditorProps = {
  description: string;
  dirty: boolean;
  draft: string;
  editorLabel: string;
  error?: string;
  errorTitle: string;
  fileName: string;
  filePath: string;
  loading: boolean;
  native: boolean;
  notice?: ReactNode;
  onChange: (value: string) => void;
  onReload: () => Promise<void>;
  onSave: () => Promise<unknown>;
  placeholder?: string;
  restartNote: string;
  saved: boolean;
  savedMessage: string;
  saving: boolean;
  title: string;
};

export function ConfigDocumentEditor({
  description,
  dirty,
  draft,
  editorLabel,
  error,
  errorTitle,
  fileName,
  filePath,
  loading,
  native,
  notice,
  onChange,
  onReload,
  onSave,
  placeholder,
  restartNote,
  saved,
  savedMessage,
  saving,
  title,
}: ConfigDocumentEditorProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLElement>({
    active: open,
    initialFocusSelector: "[data-config-editor]",
    onEscape: requestClose,
  });

  function requestClose() {
    if (dirty) {
      setConfirmingClose(true);
      return;
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open || loading) return;
    editor.current?.focus();
  }, [loading, open]);

  useEffect(() => {
    if (open) return;
    setConfirmingClose(false);
  }, [open]);

  return (
    <section className="config-document-section">
      <header>
        <span>
          <h2>{title}</h2>
          <p>{description}</p>
        </span>
        <span className="scope-badge">{t("settings.config.global")}</span>
      </header>
      <button
        className="settings-card config-document-card"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="config-document-icon">
          <FilePenLine />
        </span>
        <span className="config-document-summary">
          <strong>{fileName}</strong>
          <small>{filePath}</small>
        </span>
        {!native && <em>{t("settings.config.preview")}</em>}
        <span className="config-document-edit">
          {t("settings.config.edit")}
        </span>
      </button>
      {open && (
        <div
          className="config-editor-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) requestClose();
          }}
        >
          <section
            ref={dialogRef}
            className="config-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onKeyDown={(event) => {
              onDialogKeyDown(event);
              if (event.defaultPrevented) {
                event.stopPropagation();
                return;
              }
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "s"
              ) {
                event.preventDefault();
                void onSave();
              }
            }}
          >
            <header>
              <span>
                <strong>{title}</strong>
                <small>{filePath}</small>
              </span>
              {!native && <em>{t("settings.config.preview")}</em>}
              <RoundIconButton
                aria-label={t("settings.config.closeEditor")}
                icon={X}
                onClick={requestClose}
                variant="tertiary"
              />
            </header>
            <p>{description}</p>
            <div className="config-editor-surface">
              {loading ? (
                <div className="config-editor-loading" role="status">
                  <span className="settings-loader-spinner" />
                  {t("settings.config.loading")}
                </div>
              ) : (
                <textarea
                  ref={editor}
                  data-config-editor
                  aria-label={editorLabel}
                  value={draft}
                  disabled={saving}
                  placeholder={placeholder}
                  spellCheck={false}
                  onChange={(event) => onChange(event.target.value)}
                />
              )}
            </div>
            {notice}
            {error && (
              <div className="inventory-message error" role="alert">
                <strong>{errorTitle}</strong>
                <small>{error}</small>
              </div>
            )}
            {saved && (
              <div className="inventory-message success" role="status">
                {savedMessage}
              </div>
            )}
            <p className="config-restart-note">{restartNote}</p>
            <footer>
              {confirmingClose ? (
                <span className="config-editor-discard">
                  <small>{t("settings.config.discardConfirm")}</small>
                  <button onClick={() => setConfirmingClose(false)}>
                    {t("common.cancel")}
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setConfirmingClose(false);
                      setOpen(false);
                      void onReload();
                    }}
                  >
                    {t("settings.config.discard")}
                  </button>
                </span>
              ) : (
                <>
                  <RoundIconButton
                    disabled={loading || saving}
                    icon={RotateCcw}
                    label={t("settings.config.reload")}
                    onClick={() => void onReload()}
                    variant="secondary"
                  />
                  <RoundIconButton
                    disabled={!dirty || loading || saving}
                    icon={Save}
                    label={
                      saving
                        ? t("settings.config.saving")
                        : t("settings.config.save")
                    }
                    onClick={() => void onSave()}
                    variant="primary"
                  />
                </>
              )}
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
