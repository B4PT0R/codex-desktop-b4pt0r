import { ChevronRight, Folder } from "lucide-react";
import type { ThreadSummary } from "../types";
import { SidebarThreadRow } from "./SidebarThreadRow";

type SidebarThreadGroupProps = {
  expanded: boolean;
  group: string;
  lockedOpen: boolean;
  selectedThreadId?: string;
  threads: ThreadSummary[];
  onArchive: (thread: ThreadSummary) => void;
  onDelete: (thread: ThreadSummary) => void;
  onPin: (thread: ThreadSummary, isPinned: boolean) => void;
  onResume: (threadId: string) => void;
  onToggle: () => void;
};

export function SidebarThreadGroup({
  expanded,
  group,
  lockedOpen,
  onArchive,
  onDelete,
  onPin,
  onResume,
  onToggle,
  selectedThreadId,
  threads,
}: SidebarThreadGroupProps) {
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
        {threads.map((thread) => (
          <SidebarThreadRow
            key={thread.id}
            onArchive={onArchive}
            onDelete={onDelete}
            onPin={onPin}
            onResume={onResume}
            selected={selectedThreadId === thread.id}
            thread={thread}
          />
        ))}
      </div>
    </section>
  );
}

function projectName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
