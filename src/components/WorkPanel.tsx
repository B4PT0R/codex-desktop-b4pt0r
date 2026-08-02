import { FilePenLine, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";
import type { ToolCall } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import { IconButton } from "./IconButton";

type WorkPanelProps = {
  tool: ToolCall;
  onClose: () => void;
};

const DiffViewer = lazy(() => import("./DiffViewer"));

export function WorkPanel({ tool, onClose }: WorkPanelProps) {
  const { t } = useI18n();
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector('[aria-modal="true"]')
      )
        close.current();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, []);

  return (
    <aside className="work-panel" aria-label={t("work.label")}>
      <header>
        <span>
          <FilePenLine />
          <strong>{t("work.changes")}</strong>
        </span>
        <IconButton
          ref={closeButton}
          aria-label={t("work.close")}
          icon={X}
          onClick={onClose}
          variant="tertiary"
        />
      </header>
      <div className="work-panel-body">
        <div className="work-panel-summary">
          <strong>{tool.title}</strong>
          <span>{tool.detail}</span>
        </div>
        <section>
          <h2>{t("work.diff")}</h2>
          <Suspense
            fallback={
              <div className="diff-viewer-loading">
                <span className="settings-loader-spinner" />
                {t("work.diff.loading")}
              </div>
            }
          >
            <DiffViewer diff={tool.diff ?? ""} />
          </Suspense>
        </section>
      </div>
    </aside>
  );
}
