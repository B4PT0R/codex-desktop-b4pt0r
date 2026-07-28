import { Archive, ChevronRight, Folder, Trash2 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { ThreadSummary } from "../types";
import { RoundIconButton } from "./RoundIcon";

type SidebarThreadGroupProps = {
  expanded: boolean;
  group: string;
  lockedOpen: boolean;
  selectedThreadId?: string;
  threads: ThreadSummary[];
  onArchive: (thread: ThreadSummary) => void;
  onDelete: (thread: ThreadSummary) => void;
  onResume: (threadId: string) => void;
  onToggle: () => void;
};

export function SidebarThreadGroup({
  expanded,
  group,
  lockedOpen,
  onArchive,
  onDelete,
  onResume,
  onToggle,
  selectedThreadId,
  threads,
}: SidebarThreadGroupProps) {
  const { t } = useI18n();
  const name = projectName(group);

  return (
    <section className={`thread-group${expanded ? " expanded" : ""}`}>
      <button
        aria-label={name}
        aria-expanded={expanded}
        className="thread-group-title"
        disabled={lockedOpen}
        onClick={onToggle}
        title={group}
        type="button"
      >
        <ChevronRight className="thread-group-chevron" />
        <Folder />
        <span>{name}</span>
        <small>{threads.length}</small>
      </button>
      <div className="thread-group-items" hidden={!expanded}>
        {threads.map((thread) => {
          const label =
            thread.name || thread.preview || t("sidebar.untitled");
          return (
            <div className="thread-row" key={thread.id}>
              <button
                className={selectedThreadId === thread.id ? "selected" : ""}
                onClick={() => onResume(thread.id)}
              >
                <span className="thread-copy">
                  <span>{label}</span>
                  {thread.searchSnippet && (
                    <small>{thread.searchSnippet}</small>
                  )}
                </span>
                {thread.status === "active" && (
                  <i
                    className="thread-running"
                    aria-label={t("sidebar.running")}
                  />
                )}
                {thread.status === "systemError" && (
                  <i
                    className="thread-error"
                    aria-label={t("sidebar.error")}
                  />
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
        })}
      </div>
    </section>
  );
}

function projectName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
