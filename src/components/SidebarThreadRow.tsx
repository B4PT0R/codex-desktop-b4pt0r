import { Archive, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { ThreadSummary } from "../types";
import { RoundIconButton } from "./RoundIcon";

type SidebarThreadRowProps = {
  selected: boolean;
  thread: ThreadSummary;
  onArchive: (thread: ThreadSummary) => void;
  onDelete: (thread: ThreadSummary) => void;
  onResume: (threadId: string) => void;
};

export function SidebarThreadRow({
  onArchive,
  onDelete,
  onResume,
  selected,
  thread,
}: SidebarThreadRowProps) {
  const { t } = useI18n();
  const label = thread.name || thread.preview || t("sidebar.untitled");

  return (
    <div className="thread-row">
      <button
        className={selected ? "selected" : ""}
        onClick={() => onResume(thread.id)}
      >
        <span className="thread-copy">
          <span>{label}</span>
          {thread.searchSnippet && <small>{thread.searchSnippet}</small>}
        </span>
        {thread.status === "active" && (
          <i className="thread-running" aria-label={t("sidebar.running")} />
        )}
        {thread.status === "systemError" && (
          <i className="thread-error" aria-label={t("sidebar.error")} />
        )}
      </button>
      <RoundIconButton
        className="thread-archive"
        aria-label={`${t("sidebar.archive")} ${label}`}
        icon={Archive}
        title={t("sidebar.archiveTitle")}
        onClick={() => onArchive(thread)}
        variant="tertiary"
      />
      <RoundIconButton
        className="thread-delete"
        aria-label={`${t("sidebar.delete")} ${label}`}
        icon={Trash2}
        title={t("sidebar.deleteTitle")}
        onClick={() => onDelete(thread)}
        variant="tertiary"
      />
    </div>
  );
}
