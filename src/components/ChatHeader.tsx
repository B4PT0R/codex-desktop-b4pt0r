import {
  Check,
  ChevronDown,
  GitFork,
  FileText,
  Menu,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Shrink,
  Square,
  Trash2,
  Target,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { ThreadDeleteDialog } from "./ThreadDeleteDialog";
import { BackgroundTerminalsLoader } from "./BackgroundTerminalsLoader";
import { ThreadGoalButton } from "./ThreadGoalButton";
import { WorkspaceAgentsButton } from "./WorkspaceAgentsButton";

type ChatHeaderProps = {
  busy: boolean;
  connected: boolean;
  cwd?: string;
  nativeApp: boolean;
  reconnecting: boolean;
  sidebarOpen: boolean;
  threadId?: string;
  title: string;
  demoPlayback?: {
    hasPlayed: boolean;
    running: boolean;
    onPlay: () => void;
    onStop: () => void;
  };
  onCompact: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onFork: () => Promise<boolean>;
  onOpenSidebar: () => void;
  onReconnect: () => void;
  onReload: () => Promise<boolean>;
  onRename: (name: string) => Promise<boolean>;
};

export function ChatHeader({
  busy,
  connected,
  cwd = "",
  nativeApp,
  reconnecting,
  sidebarOpen,
  threadId,
  title,
  demoPlayback,
  onCompact,
  onDelete,
  onFork,
  onOpenSidebar,
  onReconnect,
  onReload,
  onRename,
}: ChatHeaderProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(title);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(title);
    setEditingName(false);
  }, [title]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    return () => menuButton.current?.focus();
  }, [menuOpen]);

  async function rename() {
    const nextName = name.trim();
    if (!nextName || nextName === title || saving) return;
    setSaving(true);
    if (await onRename(nextName)) setEditingName(false);
    setSaving(false);
  }

  async function compact() {
    if (saving || busy) return;
    setSaving(true);
    if (await onCompact()) setMenuOpen(false);
    setSaving(false);
  }

  async function fork() {
    if (saving || busy) return;
    setSaving(true);
    if (await onFork()) setMenuOpen(false);
    setSaving(false);
  }

  async function reload() {
    if (saving || busy || !connected) return;
    setSaving(true);
    if (await onReload()) setMenuOpen(false);
    setSaving(false);
  }

  async function deleteThread() {
    if (deleting || busy) return;
    setDeleting(true);
    if (await onDelete()) setConfirmingDelete(false);
    setDeleting(false);
  }

  return (
    <>
      <header>
        {!sidebarOpen && (
          <button onClick={onOpenSidebar} aria-label={t("chat.sidebar.show")}>
            <Menu />
          </button>
        )}
        {threadId ? (
          <div className="thread-menu" ref={menu}>
            <button
              ref={menuButton}
              className="thread-title"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={() => setMenuOpen((open) => !open)}
              title={title}
            >
              <span>{title}</span> <ChevronDown />
            </button>
            {menuOpen && (
              <div
                ref={popover}
                className="thread-menu-popover"
                role="dialog"
                aria-label={t("chat.actions.label")}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setMenuOpen(false);
                  }
                }}
              >
                {editingName ? (
                  <label>
                    {t("chat.actions.name")}
                    <span>
                      <input
                        autoFocus
                        value={name}
                        maxLength={120}
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void rename();
                          if (event.key === "Escape") {
                            event.stopPropagation();
                            setName(title);
                            setEditingName(false);
                          }
                        }}
                      />
                      <button
                        aria-label={t("common.cancel")}
                        onClick={() => {
                          setName(title);
                          setEditingName(false);
                        }}
                      >
                        <X />
                      </button>
                      <button
                        aria-label={t("chat.actions.saveName")}
                        disabled={!name.trim() || name.trim() === title || saving}
                        onClick={rename}
                      >
                        <Check />
                      </button>
                    </span>
                  </label>
                ) : (
                  <div className="thread-menu-name">
                    <small>{t("chat.actions.name")}</small>
                    <span>
                      <strong title={title}>{title}</strong>
                      <button
                        aria-label={t("chat.actions.editName")}
                        onClick={() => setEditingName(true)}
                      >
                        <Pencil />
                      </button>
                    </span>
                  </div>
                )}
                <button
                  className="thread-menu-action"
                  disabled={busy || saving || !connected}
                  onClick={reload}
                >
                  <RotateCcw className={saving ? "spin" : ""} />
                  <span>
                    <strong>{t("chat.actions.reload")}</strong>
                    <small>{t("chat.actions.reloadDetail")}</small>
                  </span>
                </button>
                <button
                  className="thread-menu-action"
                  disabled={!connected}
                  onClick={() => {
                    setMenuOpen(false);
                    setGoalOpen(true);
                  }}
                >
                  <Target />
                  <span>
                    <strong>{t("goal.title")}</strong>
                    <small>{t("goal.description")}</small>
                  </span>
                </button>
                <button
                  className="thread-menu-action"
                  disabled={!cwd}
                  onClick={() => {
                    setMenuOpen(false);
                    setAgentsOpen(true);
                  }}
                >
                  <FileText />
                  <span>
                    <strong>AGENTS.md</strong>
                    <small>{t("agents.description")}</small>
                  </span>
                </button>
                <button
                  className="thread-menu-action"
                  disabled={busy || saving}
                  onClick={compact}
                >
                  <Shrink />
                  <span>
                    <strong>{t("chat.actions.compact")}</strong>
                    <small>{t("chat.actions.compactDetail")}</small>
                  </span>
                </button>
                <button
                  className="thread-menu-action"
                  disabled={busy || saving}
                  onClick={fork}
                >
                  <GitFork />
                  <span>
                    <strong>{t("chat.actions.fork")}</strong>
                    <small>{t("chat.actions.forkDetail")}</small>
                  </span>
                </button>
                <button
                  className="thread-menu-action danger"
                  disabled={busy || saving}
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmingDelete(true);
                  }}
                >
                  <Trash2 />
                  <span>
                    <strong>{t("chat.actions.delete")}</strong>
                    <small>{t("chat.actions.deleteDetail")}</small>
                  </span>
                </button>
              </div>
            )}
            <ThreadGoalButton
              connected={connected}
              threadId={threadId}
              hideTrigger
              open={goalOpen}
              onOpenChange={setGoalOpen}
            />
            <WorkspaceAgentsButton
              cwd={cwd}
              nativeApp={nativeApp}
              hideTrigger
              open={agentsOpen}
              onOpenChange={setAgentsOpen}
            />
          </div>
        ) : (
          <div className="thread-title">{title}</div>
        )}
        <div className="header-actions">
          {demoPlayback && (
            <button
              className="demo-playback-button"
              onClick={
                demoPlayback.running ? demoPlayback.onStop : demoPlayback.onPlay
              }
            >
              {demoPlayback.running ? (
                <>
                  <Square /> {t("demoPlayback.stop")}
                </>
              ) : demoPlayback.hasPlayed ? (
                <>
                  <RotateCcw /> {t("demoPlayback.replay")}
                </>
              ) : (
                <>
                  <Play /> {t("demoPlayback.play")}
                </>
              )}
            </button>
          )}
          <BackgroundTerminalsLoader
            busy={busy}
            connected={connected}
            threadId={threadId}
          />
          <span className={connected ? "status online" : "status"}>
            {connected
              ? t("chat.connection.connected")
              : nativeApp
                ? t("chat.connection.disconnected")
                : t("chat.connection.preview")}
          </span>
          {!connected && nativeApp && (
            <button
              className="connection-retry"
              onClick={onReconnect}
              disabled={reconnecting}
            >
              <RefreshCw className={reconnecting ? "spin" : ""} />
              {reconnecting
                ? t("chat.connection.connecting")
                : t("chat.connection.reconnect")}
            </button>
          )}
        </div>
      </header>
      {confirmingDelete && (
        <ThreadDeleteDialog
          deleting={deleting}
          title={title}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void deleteThread()}
        />
      )}
    </>
  );
}
