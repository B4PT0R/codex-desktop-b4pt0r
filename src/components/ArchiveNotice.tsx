import { useEffect, useRef } from "react";
import type { ThreadSummary } from "../types";
import { useI18n } from "../i18n/I18nProvider";

type ArchiveNoticeProps = {
  thread: ThreadSummary;
  onDismiss: () => void;
  onUndo: () => void;
};

export function ArchiveNotice({
  thread,
  onDismiss,
  onUndo,
}: ArchiveNoticeProps) {
  const { t } = useI18n();
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const timeout = window.setTimeout(() => dismissRef.current(), 8_000);
    return () => window.clearTimeout(timeout);
  }, [thread.id]);

  return (
    <div className="archive-notice" role="status" aria-live="polite">
      <span>
        <strong>{t("archive.title")}</strong>
        <small>{thread.name || thread.preview || t("sidebar.untitled")}</small>
      </span>
      <button onClick={onUndo}>{t("common.cancel")}</button>
    </div>
  );
}
