import {
  Archive,
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

type SidebarProps = {
  cwd: string;
  open: boolean;
  selectedThreadId?: string;
  threads: ThreadSummary[];
  search: ThreadSearchController;
  onClose: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onArchive: (thread: ThreadSummary) => void;
  onResume: (threadId: string) => void;
  onSelectDirectory: () => void;
};

export function Sidebar({
  cwd,
  open,
  selectedThreadId,
  threads,
  search,
  onClose,
  onNewChat,
  onOpenSettings,
  onArchive,
  onResume,
  onSelectDirectory,
}: SidebarProps) {
  const { t } = useI18n();
  const searchInput = useRef<HTMLInputElement>(null);
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
          <section className="thread-group" key={group}>
            <div className="thread-group-title" title={group}>
              <Folder /> <span>{projectName(group)}</span>
            </div>
            {groupThreads.map((thread) => {
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
                  <button
                    className="thread-archive"
                    aria-label={`${t("sidebar.archive")} ${label}`}
                    title={t("sidebar.archiveTitle")}
                    onClick={() => onArchive(thread)}
                  >
                    <Archive />
                  </button>
                </div>
              );
            })}
          </section>
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
    </aside>
  );
}

function projectName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
