import {
  Folder,
  MessageSquarePlus,
  PanelLeft,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { ThreadSummary } from "../types";
import type { ThreadSearchController } from "../lib/useThreadSearch";
import { ThreadDeleteDialog } from "./ThreadDeleteDialog";
import { SidebarThreadGroup } from "./SidebarThreadGroup";

type SidebarProps = {
  cwd: string;
  open: boolean;
  width: number;
  selectedThreadId?: string;
  threads: ThreadSummary[];
  search: ThreadSearchController;
  onClose: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onArchive: (thread: ThreadSummary) => void;
  onDelete: (thread: ThreadSummary) => Promise<boolean>;
  onResume: (threadId: string) => void;
  onSelectDirectory: () => void;
  onWidthChange: (width: number) => void;
  onWidthCommit: (width: number) => void;
};

export function Sidebar({
  cwd,
  open,
  width,
  selectedThreadId,
  threads,
  search,
  onClose,
  onNewChat,
  onOpenSettings,
  onArchive,
  onDelete,
  onResume,
  onSelectDirectory,
  onWidthChange,
  onWidthCommit,
}: SidebarProps) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ThreadSummary>();
  const [expandedGroup, setExpandedGroup] = useState<string>();
  const searchInput = useRef<HTMLInputElement>(null);
  const resizeStart = useRef<{
    pointerId: number;
    pointerX: number;
    width: number;
  } | undefined>(undefined);
  const visibleThreads = useMemo(() => {
    const normalizedQuery = search.query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return threads;
    const local = threads.filter((thread) =>
      [thread.name, thread.preview, thread.cwd].some((value) =>
        value?.toLocaleLowerCase().includes(normalizedQuery),
      ),
    );
    const ids = new Set(search.results.map((thread) => thread.id));
    return [...search.results, ...local.filter((thread) => !ids.has(thread.id))];
  }, [search.query, search.results, threads]);
  const threadGroups = useMemo(() => {
    const groups = new Map<string, ThreadSummary[]>();
    for (const thread of visibleThreads) {
      const key = thread.cwd || t("sidebar.otherThreads");
      groups.set(key, [...(groups.get(key) ?? []), thread]);
    }
    return [...groups.entries()];
  }, [t, visibleThreads]);
  const searching = Boolean(search.query.trim());
  const selectedThread = threads.find(
    (thread) => thread.id === selectedThreadId,
  );
  const selectedGroup = selectedThread
    ? selectedThread.cwd || t("sidebar.otherThreads")
    : undefined;
  const currentWorkspace = threadGroups.some(([group]) => group === cwd)
    ? cwd
    : undefined;
  const groupKeySignature = threadGroups.map(([group]) => group).join("\u0000");

  useEffect(() => {
    if (searching) return;
    const preferredGroup = selectedGroup || currentWorkspace;
    setExpandedGroup((current) => {
      if (preferredGroup) return preferredGroup;
      return current && groupKeySignature.split("\u0000").includes(current)
        ? current
        : undefined;
    });
  }, [currentWorkspace, groupKeySignature, searching, selectedGroup]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.key.toLocaleLowerCase() === "n") {
        event.preventDefault();
        onNewChat();
      }
      if (event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onNewChat]);

  return (
    <aside
      className={open ? "sidebar" : "sidebar collapsed"}
      aria-label={t("sidebar.navigation")}
      style={open ? { width } : undefined}
    >
      <div className="brand">
        <span className="logo">
          <Sparkles />
        </span>
        <strong>Codex</strong>
        <button onClick={onClose} aria-label={t("sidebar.hide")}>
          <PanelLeft />
        </button>
      </div>
      <button className="new-chat" onClick={onNewChat}>
        <MessageSquarePlus /> {t("sidebar.newChat")} <kbd>Ctrl N</kbd>
      </button>
      <label className="search">
        <Search />
        <input
          ref={searchInput}
          type="search"
          value={search.query}
          placeholder={t("sidebar.search")}
          aria-label={t("sidebar.searchLabel")}
          onChange={(event) => search.setQuery(event.target.value)}
        />
        <kbd>Ctrl K</kbd>
      </label>
      <div className="section-title">
        {search.query.trim()
          ? t("sidebar.searchResults")
          : t("sidebar.recentProjects")}
      </div>
      <nav aria-label={t("sidebar.recentThreads")}>
        {threadGroups.map(([group, groupThreads]) => (
          <SidebarThreadGroup
            expanded={searching || expandedGroup === group}
            group={group}
            key={group}
            lockedOpen={searching}
            onArchive={onArchive}
            onDelete={setDeleteCandidate}
            onResume={onResume}
            onToggle={() =>
              setExpandedGroup((current) =>
                current === group ? undefined : group,
              )
            }
            selectedThreadId={selectedThreadId}
            threads={groupThreads}
          />
        ))}
        {threads.length === 0 && (
          <p className="thread-list-empty">{t("sidebar.empty")}</p>
        )}
        {search.loading && search.query.trim() && (
          <p className="thread-list-empty" role="status">
            {t("sidebar.searching")}
          </p>
        )}
        {search.error && search.query.trim() && (
          <p className="thread-list-empty thread-search-error" role="alert">
            {search.error}
          </p>
        )}
        {threads.length > 0 &&
          visibleThreads.length === 0 &&
          !search.loading && (
          <p className="thread-list-empty">{t("sidebar.noResults")}</p>
        )}
        {search.hasMore && !search.loading && (
          <button className="thread-search-more" onClick={search.loadMore}>
            {t("sidebar.loadMore")}
          </button>
        )}
      </nav>
      <div className="sidebar-bottom">
        <button onClick={onSelectDirectory} title={t("sidebar.changeFolder")}>
          <Folder />{" "}
          <span className="cwd-label">{cwd || t("sidebar.chooseFolder")}</span>
        </button>
        <button onClick={onOpenSettings}>
          <Settings2 /> {t("sidebar.settings")}
        </button>
      </div>
      {deleteCandidate && (
        <ThreadDeleteDialog
          deleting={deleting}
          title={
            deleteCandidate.name ||
            deleteCandidate.preview ||
            t("sidebar.untitled")
          }
          onCancel={() => setDeleteCandidate(undefined)}
          onConfirm={() => {
            setDeleting(true);
            void onDelete(deleteCandidate).then((deleted) => {
              setDeleting(false);
              if (deleted) setDeleteCandidate(undefined);
            });
          }}
        />
      )}
      <div
        aria-label={t("sidebar.resize")}
        aria-orientation="vertical"
        aria-valuemax={420}
        aria-valuemin={220}
        aria-valuenow={width}
        className="sidebar-resize-handle"
        onDoubleClick={() => {
          onWidthChange(260);
          onWidthCommit(260);
        }}
        onKeyDown={(event) => {
          let next = width;
          if (event.key === "ArrowLeft") next -= 16;
          else if (event.key === "ArrowRight") next += 16;
          else if (event.key === "Home") next = 220;
          else if (event.key === "End") next = 420;
          else return;
          event.preventDefault();
          const clamped = clampSidebarWidth(next);
          onWidthChange(clamped);
          onWidthCommit(clamped);
        }}
        onPointerDown={(event) => {
          resizeStart.current = {
            pointerId: event.pointerId,
            pointerX: event.clientX,
            width,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          document.documentElement.classList.add("resizing-sidebar");
        }}
        onPointerMove={(event) => {
          const start = resizeStart.current;
          if (!start || start.pointerId !== event.pointerId) return;
          onWidthChange(
            clampSidebarWidth(start.width + event.clientX - start.pointerX),
          );
        }}
        onPointerCancel={() => {
          resizeStart.current = undefined;
          document.documentElement.classList.remove("resizing-sidebar");
        }}
        onPointerUp={(event) => {
          if (resizeStart.current?.pointerId !== event.pointerId) return;
          const start = resizeStart.current;
          const next = clampSidebarWidth(
            start.width + event.clientX - start.pointerX,
          );
          resizeStart.current = undefined;
          document.documentElement.classList.remove("resizing-sidebar");
          event.currentTarget.releasePointerCapture(event.pointerId);
          onWidthChange(next);
          onWidthCommit(next);
        }}
        role="separator"
        tabIndex={0}
      />
    </aside>
  );
}

function clampSidebarWidth(width: number) {
  return Math.round(Math.min(420, Math.max(220, width)));
}
