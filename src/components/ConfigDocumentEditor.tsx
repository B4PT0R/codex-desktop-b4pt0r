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
import { CardStack } from "./CardStack";
import { IconCard } from "./IconCard";
import { Alert } from "./Alert";

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
      <CardStack className="config-document-card">
        <IconCard
          contentButtonProps={{
            "aria-label": `${fileName} ${t("settings.config.edit")}`,
            "aria-expanded": open,
            "aria-haspopup": "dialog",
          }}
          icon={<FilePenLine />}
          onContentClick={() => setOpen(true)}
          title={fileName}
          subtitle={filePath}
          trailing={<>
            {!native && <em>{t("settings.config.preview")}</em>}
            <RoundIconButton
              icon={FilePenLine}
              label={t("settings.config.edit")}
              onClick={() => setOpen(true)}
              variant="tertiary"
            />
          </>}
        />
      </CardStack>
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
              <Alert tone="error">
                <strong>{errorTitle}</strong>
                <small>{error}</small>
              </Alert>
            )}
            {saved && (
              <Alert tone="success">
                {savedMessage}
              </Alert>
            )}
            <p className="config-restart-note">{restartNote}</p>
            <footer>
              {confirmingClose ? (
                <span className="config-editor-discard">
                  <small>{t("settings.config.discardConfirm")}</small>
                  <RoundIconButton
                    label={t("common.cancel")}
                    onClick={() => setConfirmingClose(false)}
                    variant="secondary"
                  />
                  <RoundIconButton
                    className="danger"
                    label={t("settings.config.discard")}
                    onClick={() => {
                      setConfirmingClose(false);
                      setOpen(false);
                      void onReload();
                    }}
                    variant="secondary"
                  />
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
