import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  GitFork,
  FolderOpen,
  FileText,
  Menu,
  LoaderCircle,
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
import { IconButton } from "./IconButton";
import type { BackgroundTerminalsController } from "../lib/useBackgroundTerminals";
import type { HeaderCommandRequest } from "../lib/commands";

type ChatHeaderProps = {
  backgroundTerminals?: BackgroundTerminalsController;
  busy: boolean;
  connected: boolean;
  cwd?: string;
  defaultThread?: boolean;
  nativeApp: boolean;
  reconnecting: boolean;
  sidebarOpen: boolean;
  threadId?: string;
  title: string;
  update?: {
    installing: boolean;
    latestVersion: string;
    onActivate: () => void;
  };
  codexUpdate?: {
    installing: boolean;
    latestVersion: string;
    onActivate: () => void;
  };
  demoPlayback?: {
    hasPlayed: boolean;
    running: boolean;
    onPlay: () => void;
    loadingThread?: boolean;
    onPreviewThreadLoading?: () => void;
    onStop: () => void;
  };
  commandRequest?: HeaderCommandRequest;
  onCompact: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onFork: () => Promise<boolean>;
  onOpenSidebar: () => void;
  onReconnect: () => void;
  onReload: () => Promise<boolean>;
  onRename: (name: string) => Promise<boolean>;
  onSelectDirectory?: () => Promise<void>;
  onSetDefaultThread?: () => Promise<boolean>;
};

export function ChatHeader({
  backgroundTerminals,
  busy,
  connected,
  cwd = "",
  defaultThread = false,
  nativeApp,
  reconnecting,
  sidebarOpen,
  threadId,
  title,
  update,
  codexUpdate,
  demoPlayback,
  commandRequest,
  onCompact,
  onDelete,
  onFork,
  onOpenSidebar,
  onReconnect,
  onReload,
  onRename,
  onSelectDirectory,
  onSetDefaultThread,
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
    if (!commandRequest) return;
    setMenuOpen(false);
    if (commandRequest.target === "agents") setAgentsOpen(true);
    else setGoalOpen(true);
  }, [commandRequest]);
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

  async function setAsDefaultThread() {
    if (!onSetDefaultThread || defaultThread || saving) return;
    setSaving(true);
    if (await onSetDefaultThread()) setMenuOpen(false);
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
          <IconButton
            aria-label={t("chat.sidebar.show")}
            icon={Menu}
            onClick={onOpenSidebar}
            variant="tertiary"
          />
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
                      <IconButton
                        aria-label={t("common.cancel")}
                        icon={X}
                        onClick={() => {
                          setName(title);
                          setEditingName(false);
                        }}
                        variant="tertiary"
                      />
                      <IconButton
                        aria-label={t("chat.actions.saveName")}
                        disabled={!name.trim() || name.trim() === title || saving}
                        icon={Check}
                        onClick={rename}
                        variant="tertiary"
                      />
                    </span>
                  </label>
                ) : (
                  <div className="thread-menu-name">
                    <small>{t("chat.actions.name")}</small>
                    <span>
                      <strong title={title}>{title}</strong>
                      <IconButton
                        aria-label={t("chat.actions.editName")}
                        icon={Pencil}
                        onClick={() => setEditingName(true)}
                        variant="tertiary"
                      />
                    </span>
                  </div>
                )}
                {onSelectDirectory && <button
                  className="thread-menu-action"
                  disabled={busy || saving}
                  onClick={() => {
                    setMenuOpen(false);
                    void onSelectDirectory();
                  }}
                >
                  <FolderOpen />
                  <span>
                    <strong>{t("chat.actions.changeFolder")}</strong>
                    <small>{cwd || t("chat.actions.changeFolderDetail")}</small>
                  </span>
                </button>}
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
                {onSetDefaultThread && (
                  <button
                    className="thread-menu-action"
                    disabled={defaultThread || saving}
                    onClick={setAsDefaultThread}
                  >
                    <Check />
                    <span>
                      <strong>{t("chat.actions.setDefault")}</strong>
                      <small>{t("chat.actions.setDefaultDetail")}</small>
                    </span>
                  </button>
                )}
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
          {update && (
            <IconButton
              aria-label={
                update.installing
                  ? t("updates.topbar.installing")
                  : t("updates.topbar.available", {
                      version: update.latestVersion,
                    })
              }
              className="header-update-button"
              disabled={update.installing}
              icon={update.installing ? LoaderCircle : ArrowDownToLine}
              iconClassName={update.installing ? "spin" : undefined}
              label={
                update.installing
                  ? t("updates.topbar.installing")
                  : t("updates.topbar.label", {
                      version: update.latestVersion,
                    })
              }
              onClick={update.onActivate}
              gap="small"
              size="small"
              variant="secondary"
            />
          )}
          {codexUpdate && (
            <IconButton
              aria-label={
                codexUpdate.installing
                  ? t("updates.topbar.codexInstalling")
                  : t("updates.topbar.codexAvailable", {
                      version: codexUpdate.latestVersion,
                    })
              }
              className="header-update-button"
              disabled={codexUpdate.installing}
              icon={codexUpdate.installing ? LoaderCircle : ArrowDownToLine}
              iconClassName={codexUpdate.installing ? "spin" : undefined}
              label={
                codexUpdate.installing
                  ? t("updates.topbar.codexInstalling")
                  : t("updates.topbar.codexLabel", {
                      version: codexUpdate.latestVersion,
                    })
              }
              onClick={codexUpdate.onActivate}
              gap="small"
              size="small"
              variant="secondary"
            />
          )}
          {demoPlayback && (
            <>
              {demoPlayback.onPreviewThreadLoading && (
                <IconButton
                  className="demo-playback-button"
                  disabled={demoPlayback.loadingThread || demoPlayback.running}
                  icon={LoaderCircle}
                  iconClassName={
                    demoPlayback.loadingThread ? "spin" : undefined
                  }
                  label={
                    demoPlayback.loadingThread
                      ? t("demoPlayback.loading")
                      : t("demoPlayback.testLoading")
                  }
                  onClick={demoPlayback.onPreviewThreadLoading}
                  size="medium"
                  variant="secondary"
                />
              )}
              <IconButton
                className="demo-playback-button"
                disabled={demoPlayback.loadingThread}
                icon={
                  demoPlayback.running
                    ? Square
                    : demoPlayback.hasPlayed
                      ? RotateCcw
                      : Play
                }
                label={
                  demoPlayback.running
                    ? t("demoPlayback.stop")
                    : demoPlayback.hasPlayed
                      ? t("demoPlayback.replay")
                      : t("demoPlayback.play")
                }
                onClick={
                  demoPlayback.running
                    ? demoPlayback.onStop
                    : demoPlayback.onPlay
                }
                size="medium"
                variant="secondary"
              />
            </>
          )}
          {backgroundTerminals && (
            <BackgroundTerminalsLoader
              controller={backgroundTerminals}
              threadId={threadId}
            />
          )}
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
