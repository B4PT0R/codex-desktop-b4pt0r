import { ArrowLeft, Blocks, FileSearch, ImagePlus, Plug, Server, TerminalSquare } from "lucide-react";
import { filteredComposerCommands } from "../lib/commands";
import type { AppInfo } from "../lib/appServerTypes";
import { useI18n } from "../i18n/I18nProvider";
import type { KeyboardEventHandler, Ref } from "react";

export type ComposerMenuSurfaceProps = {
  menuRef: Ref<HTMLDivElement>;
  onMenuKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

type CommandMenuProps = {
  busy: boolean;
  hasThread: boolean;
  query: string;
  onSelect: (command: string) => void;
} & ComposerMenuSurfaceProps;

export function CommandMenu({
  busy,
  hasThread,
  query,
  onSelect,
  menuRef,
  onMenuKeyDown,
}: CommandMenuProps) {
  const { t } = useI18n();
  const commands = filteredComposerCommands(query, t);
  return (
    <div
      className="composer-menu command-menu"
      ref={menuRef}
      role="menu"
      aria-label={t("composer.commands.label")}
      onKeyDown={onMenuKeyDown}
    >
      {commands.length > 0 ? (
        commands.map((command) => {
          const disabled =
            (command.requiresThread && !hasThread) ||
            (command.requiresTurn && !busy);
          return (
            <button
              key={command.id}
              role="menuitem"
              disabled={disabled}
              title={
                disabled
                  ? t(
                      command.requiresTurn
                        ? "composer.commands.requiresTurn"
                        : "composer.commands.requiresThread",
                    )
                  : undefined
              }
              onClick={() => onSelect(command.value)}
            >
              <b>{command.value}</b>
              <span>{t(command.labelKey)}</span>
            </button>
          );
        })
      ) : (
        <p>{t("composer.commands.empty")}</p>
      )}
    </div>
  );
}

type AddMenuProps = {
  onOpenFiles: () => void;
  onShellCommand: () => void;
  onOpenApps: () => void;
  onPickImages: () => void;
  onOpenMcp: () => void;
  onOpenPlugins: () => void;
} & ComposerMenuSurfaceProps;

export function AddMenu({
  onPickImages,
  onOpenApps,
  onOpenMcp,
  onOpenPlugins,
  onOpenFiles,
  onShellCommand,
  menuRef,
  onMenuKeyDown,
}: AddMenuProps) {
  const { t } = useI18n();
  return (
    <div
      className="composer-menu add-menu"
      ref={menuRef}
      role="menu"
      aria-label={t("composer.context.add")}
      onKeyDown={onMenuKeyDown}
    >
      <button role="menuitem" onClick={onPickImages}>
        <ImagePlus />
        <span>
          <b>{t("composer.images")}</b>
          <small>{t("composer.images.detail")}</small>
        </span>
      </button>
      <button role="menuitem" onClick={onOpenFiles}>
        <FileSearch />
        <span>
          <b>{t("composer.files")}</b>
          <small>{t("composer.files.detail")}</small>
        </span>
      </button>
      <button role="menuitem" onClick={onShellCommand}>
        <TerminalSquare />
        <span>
          <b>{t("composer.shell")}</b>
          <small>{t("composer.shell.detail")}</small>
        </span>
      </button>
      <button role="menuitem" onClick={onOpenApps}>
        <Blocks />
        <span>
          <b>{t("composer.apps")}</b>
          <small>{t("composer.apps.detail")}</small>
        </span>
      </button>
      <button role="menuitem" onClick={onOpenPlugins}>
        <Plug />
        <span>
          <b>{t("composer.plugins")}</b>
          <small>{t("composer.plugins.detail")}</small>
        </span>
      </button>
      <button role="menuitem" onClick={onOpenMcp}>
        <Server />
        <span>
          <b>{t("composer.mcp")}</b>
          <small>{t("composer.mcp.detail")}</small>
        </span>
      </button>
    </div>
  );
}

export function AppsMenu({
  apps,
  error,
  loading,
  onBack,
  onSelect,
  menuRef,
  onMenuKeyDown,
}: {
  apps: AppInfo[];
  error?: string;
  loading: boolean;
  onBack: () => void;
  onSelect: (app: AppInfo) => void;
} & ComposerMenuSurfaceProps) {
  const { t } = useI18n();
  return (
    <div
      className="composer-menu apps-menu"
      ref={menuRef}
      role="menu"
      aria-label={t("composer.apps")}
      onKeyDown={onMenuKeyDown}
    >
      <button className="composer-menu-back" role="menuitem" onClick={onBack}>
        <ArrowLeft /> {t("composer.apps")}
      </button>
      {loading && apps.length === 0 ? (
        <p>{t("composer.apps.loading")}</p>
      ) : error ? (
        <p>{error}</p>
      ) : apps.length === 0 ? (
        <p>{t("composer.apps.empty")}</p>
      ) : (
        apps.map((app) => (
          <button key={app.id} role="menuitem" onClick={() => onSelect(app)}>
            <Blocks />
            <span>
              <b>{app.name}</b>
              {app.description && <small>{app.description}</small>}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
