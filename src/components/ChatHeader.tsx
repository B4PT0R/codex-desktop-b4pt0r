import {
  Check,
  ChevronDown,
  GitFork,
  Menu,
  Play,
  RefreshCw,
  RotateCcw,
  Shrink,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { ThreadDeleteDialog } from "./ThreadDeleteDialog";
import { BackgroundTerminalsLoader } from "./BackgroundTerminalsLoader";
import { ThreadGoalButton } from "./ThreadGoalButton";

type ChatHeaderProps = {
  busy: boolean;
  connected: boolean;
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
  onRename: (name: string) => Promise<boolean>;
};

export function ChatHeader({
  busy,
  connected,
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
  onRename,
}: ChatHeaderProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(title);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => setName(title), [title]);
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
    popover.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => menuButton.current?.focus();
  }, [menuOpen]);

  async function rename() {
    const nextName = name.trim();
    if (!nextName || nextName === title || saving) return;
    setSaving(true);
    if (await onRename(nextName)) setMenuOpen(false);
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
                <label>
                  {t("chat.actions.name")}
                  <span>
                    <input
                      value={name}
                      maxLength={120}
                      onChange={(event) => setName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void rename();
                        if (event.key === "Escape") setMenuOpen(false);
                      }}
                    />
                    <button
                      aria-label={t("chat.actions.saveName")}
                      disabled={!name.trim() || name.trim() === title || saving}
                      onClick={rename}
                    >
                      <Check />
                    </button>
                  </span>
                </label>
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
                <button
                  className="thread-menu-close"
                  aria-label={t("chat.actions.close")}
                  onClick={() => setMenuOpen(false)}
                >
                  <X />
                </button>
              </div>
            )}
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
          <ThreadGoalButton connected={connected} threadId={threadId} />
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
