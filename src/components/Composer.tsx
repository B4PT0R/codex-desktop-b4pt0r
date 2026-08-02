import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ArrowUp, AudioWaveform, Mic, Plus, Square } from "lucide-react";
import { openDialog as open } from "../lib/nativeBridge";
import { isDesktopApp } from "../lib/codex";
import {
  AddMenu,
  AppsMenu,
  CommandChoiceMenu,
  CommandMenu,
  SkillsMenu,
} from "./ComposerMenus";
import { FileSearchMenu } from "./FileSearchMenu";
import type { AppInfo, AppServerSkill } from "../lib/appServerTypes";
import type { TurnContextItem } from "../lib/protocol";
import { useI18n } from "../i18n/I18nProvider";
import { useFileSearch, type FileSearchResult } from "../lib/useFileSearch";
import { IconButton } from "./IconButton";
import type { ComposerCommandChoiceRequest } from "../lib/commands";

type ComposerProps = {
  busy: boolean;
  apps: AppInfo[];
  appsError?: string;
  appsLoading: boolean;
  skills: AppServerSkill[];
  skillsError?: string;
  skillsLoading: boolean;
  canSteer: boolean;
  cwd: string;
  hasThread: boolean;
  loadingThread?: boolean;
  commandChoiceRequest?: ComposerCommandChoiceRequest;
  recording: boolean;
  dictating: boolean;
  dictationProcessing: boolean;
  dictationInsertion?: { id: number; text: string };
  onOpenMcp: () => void;
  onOpenPlugins: () => void;
  onNeedApps: () => void;
  onNeedSkills: () => void;
  onConsumeDictationInsertion: (id: number) => void;
  onCommandChoiceDismiss: () => void;
  onCommandChoiceSelect: (choiceId: string) => void;
  onSend: (text: string, context: TurnContextItem[]) => void;
  onStop: () => void;
  onToggleVoice: () => void;
  onToggleDictation: () => void;
};

export function Composer({
  busy,
  apps,
  appsError,
  appsLoading,
  skills,
  skillsError,
  skillsLoading,
  canSteer,
  cwd,
  hasThread,
  loadingThread = false,
  commandChoiceRequest,
  recording,
  dictating,
  dictationProcessing,
  dictationInsertion,
  onOpenMcp,
  onOpenPlugins,
  onNeedApps,
  onNeedSkills,
  onConsumeDictationInsertion,
  onCommandChoiceDismiss,
  onCommandChoiceSelect,
  onSend,
  onStop,
  onToggleVoice,
  onToggleDictation,
}: ComposerProps) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [context, setContext] = useState<TurnContextItem[]>([]);
  const [menu, setMenu] = useState<
    "add" | "apps" | "files" | "skills" | null
  >(null);
  const [fileQuery, setFileQuery] = useState("");
  const [commandMenuDismissed, setCommandMenuDismissed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const menuSurface = useRef<HTMLDivElement>(null);
  const insertedDictation = useRef(0);
  const hasInput = Boolean(text.trim() || context.length);
  const canSubmit = !loadingThread && hasInput && (!busy || canSteer);
  const fileSearch = useFileSearch(menu === "files", cwd);

  useEffect(() => {
    if (
      !dictationInsertion ||
      dictationInsertion.id === insertedDictation.current
    )
      return;
    insertedDictation.current = dictationInsertion.id;
    setText((current) =>
      [current.trimEnd(), dictationInsertion.text.trim()]
        .filter(Boolean)
        .join(" "),
    );
    onConsumeDictationInsertion(dictationInsertion.id);
    textarea.current?.focus();
  }, [dictationInsertion, onConsumeDictationInsertion]);

  function submit() {
    if (!canSubmit) return;
    onSend(text.trim(), context);
    setText("");
    setContext([]);
  }

  function dispatchCommand(command: string) {
    onSend(command, []);
    setText("");
    setContext([]);
    setCommandMenuDismissed(true);
    textarea.current?.focus();
  }

  function selectCommandChoice(choiceId: string) {
    onCommandChoiceSelect(choiceId);
    textarea.current?.focus();
  }

  function completeCommand(command: string) {
    setText(`${command} `);
    setCommandMenuDismissed(true);
    textarea.current?.focus();
  }

  useEffect(() => {
    function close(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuSurface.current?.contains(target) &&
        !addButton.current?.contains(target)
      ) {
        setMenu(null);
        if (commandChoiceRequest) onCommandChoiceDismiss();
      }
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [commandChoiceRequest, onCommandChoiceDismiss]);

  useEffect(() => {
    if (!menu && !commandChoiceRequest) return;
    const surface = menuSurface.current;
    surface
      ?.querySelector<HTMLElement>(
        '[data-menu-autofocus], [aria-checked="true"]:not(:disabled)',
      )
      ?.focus();
    if (!surface?.contains(document.activeElement))
      surface?.querySelector<HTMLButtonElement>(menuItemSelector)?.focus();
  }, [commandChoiceRequest?.id, commandChoiceRequest?.stage, menu]);

  function closeMenu() {
    setMenu(null);
    addButton.current?.focus();
  }

  function moveInMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (commandChoiceRequest) {
        onCommandChoiceDismiss();
        textarea.current?.focus();
      } else if (menu) closeMenu();
      else {
        setCommandMenuDismissed(true);
        textarea.current?.focus();
      }
      return;
    }
    if (event.key === "Tab" || (event.key === "/" && !event.ctrlKey)) {
      const command = (event.target as HTMLElement).dataset.command;
      if (command) {
        event.preventDefault();
        completeCommand(command);
      }
      return;
    }
    const navigationKey =
      event.ctrlKey && event.key === "n"
        ? "ArrowDown"
        : event.ctrlKey && event.key === "p"
          ? "ArrowUp"
          : event.key;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(navigationKey))
      return;
    const items = [
      ...(menuSurface.current?.querySelectorAll<HTMLButtonElement>(
        menuItemSelector,
      ) ?? []),
    ];
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      navigationKey === "Home"
        ? 0
        : navigationKey === "End"
          ? items.length - 1
          : navigationKey === "ArrowUp"
            ? (current - 1 + items.length) % items.length
            : (current + 1) % items.length;
    items[next].focus();
  }

  async function pick() {
    if (isDesktopApp()) {
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: t("composer.images"),
            extensions: ["png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
      });
      if (selected)
        setContext((items) => [
          ...items,
          ...(Array.isArray(selected) ? selected : [selected]).map((path) => ({
            type: "localImage" as const,
            path,
          })),
        ]);
    } else {
      input.current?.click();
    }
  }

  return (
    <div className="composer-shell" ref={shell} aria-busy={loadingThread}>
      {commandChoiceRequest ? (
        <CommandChoiceMenu
          menuRef={menuSurface}
          onMenuKeyDown={moveInMenu}
          onSelect={selectCommandChoice}
          request={commandChoiceRequest}
        />
      ) : text.startsWith("/") && !commandMenuDismissed ? (
        <CommandMenu
          busy={busy}
          hasThread={hasThread}
          menuRef={menuSurface}
          onMenuKeyDown={moveInMenu}
          query={text}
          onSelect={dispatchCommand}
        />
      ) : null}
      {menu === "add" && (
        <AddMenu
          menuRef={menuSurface}
          onMenuKeyDown={moveInMenu}
          onPickImages={() => {
            setMenu(null);
            void pick();
          }}
          onOpenApps={() => {
            onNeedApps();
            setMenu("apps");
          }}
          onOpenSkills={() => {
            onNeedSkills();
            setMenu("skills");
          }}
          onOpenFiles={() => {
            setFileQuery("");
            setMenu("files");
          }}
          onShellCommand={() => {
            setMenu(null);
            setText((value) => (value.trim() ? `${value} ! ` : "! "));
            textarea.current?.focus();
          }}
          onOpenMcp={onOpenMcp}
          onOpenPlugins={onOpenPlugins}
        />
      )}
      {menu === "files" && (
        <FileSearchMenu
          complete={fileSearch.complete}
          error={fileSearch.error}
          loading={fileSearch.loading}
          menuRef={menuSurface}
          onMenuKeyDown={moveInMenu}
          query={fileQuery}
          results={fileSearch.results}
          onBack={() => setMenu("add")}
          onQueryChange={(query) => {
            setFileQuery(query);
            fileSearch.search(query);
          }}
          onSelect={addFileMention}
        />
      )}
      {menu === "apps" && (
        <AppsMenu
          apps={apps}
          error={appsError}
          loading={appsLoading}
          menuRef={menuSurface}
          onMenuKeyDown={moveInMenu}
          onBack={() => setMenu("add")}
          onSelect={(app) => {
            if (
              !context.some(
                (item) =>
                  item.type === "mention" && item.path === `app://${app.id}`,
              )
            ) {
              setContext((items) => [
                ...items,
                { type: "mention", name: app.name, path: `app://${app.id}` },
              ]);
              setText(
                (value) =>
                  `${value}${value && !value.endsWith(" ") ? " " : ""}$${appSlug(app.name)} `,
              );
            }
            setMenu(null);
            textarea.current?.focus();
          }}
        />
      )}
      {menu === "skills" && (
        <SkillsMenu
          skills={skills}
          error={skillsError}
          loading={skillsLoading}
          menuRef={menuSurface}
          onMenuKeyDown={moveInMenu}
          onBack={() => setMenu("add")}
          onSelect={(skill) => {
            if (
              !context.some(
                (item) => item.type === "skill" && item.path === skill.path,
              )
            ) {
              setContext((items) => [
                ...items,
                { type: "skill", name: skill.name, path: skill.path },
              ]);
              setText((value) =>
                `${value}${value && !value.endsWith(" ") ? " " : ""}$${skill.name} `,
              );
            }
            setMenu(null);
            textarea.current?.focus();
          }}
        />
      )}
      {context.length > 0 && (
        <div className="attachments">
          {context.map((item, index) => (
            <button
              key={`${item.type}-${item.path}-${index}`}
              onClick={() => removeContext(index, item)}
            >
              {item.type === "skill"
                ? `$${item.name}`
                : item.type === "mention"
                  ? `@${item.name}`
                  : item.path.split("/").at(-1)}{" "}
              <span>×</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textarea}
        autoFocus
        value={text}
        rows={1}
        placeholder={
          busy ? t("composer.placeholder.steer") : t("composer.placeholder")
        }
        onChange={(event) => {
          setText(event.target.value);
          setCommandMenuDismissed(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setMenu(null);
            if (commandChoiceRequest) onCommandChoiceDismiss();
            if (text.startsWith("/")) setCommandMenuDismissed(true);
          }
          if (
            text.startsWith("/") &&
            (["ArrowDown", "ArrowUp"].includes(event.key) ||
              (event.ctrlKey && ["n", "p"].includes(event.key)))
          ) {
            const items = shell.current?.querySelectorAll<HTMLButtonElement>(
              `.command-menu ${menuItemSelector}`,
            );
            const backwards =
              event.key === "ArrowUp" || (event.ctrlKey && event.key === "p");
            const selected = backwards
              ? items?.item((items?.length ?? 1) - 1)
              : items?.item(0);
            if (selected) {
              event.preventDefault();
              selected.focus();
            }
          }
          if (
            text.startsWith("/") &&
            (event.key === "Tab" ||
              (event.key === "/" && text.length > 1 && !event.ctrlKey))
          ) {
            const selected = shell.current?.querySelector<HTMLButtonElement>(
              `.command-menu [data-command]:not(:disabled)`,
            );
            if (selected?.dataset.command) {
              event.preventDefault();
              completeCommand(selected.dataset.command);
            }
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const selected = text.startsWith("/")
              ? shell.current?.querySelector<HTMLButtonElement>(
                  `.command-menu [data-command]:not(:disabled)`,
                )
              : undefined;
            if (selected?.dataset.command) {
              dispatchCommand(selected.dataset.command);
              return;
            }
            submit();
          }
        }}
      />
      <div className="composer-actions">
        <div>
          <IconButton
            ref={addButton}
            aria-label={t("composer.context.add")}
            aria-haspopup="menu"
            aria-expanded={menu !== null}
            icon={Plus}
            onClick={() => setMenu((current) => (current ? null : "add"))}
            variant="tertiary"
          />
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) =>
              setContext((items) => [
                ...items,
                ...Array.from(event.target.files ?? []).map((file) => ({
                  type: "localImage" as const,
                  path: file.name,
                })),
              ])
            }
          />
        </div>
        <div>
          {recording && (
            <span className="listening">
              <AudioWaveform /> {t("composer.voice.listening")}
            </span>
          )}
          {dictating && (
            <span className="listening dictating">
              <Mic />{" "}
              {t(
                dictationProcessing
                  ? "composer.dictation.processing"
                  : "composer.dictation.listening",
              )}
            </span>
          )}
          <IconButton
            className={recording ? "active" : ""}
            aria-label={t("composer.voice")}
            disabled={dictating || loadingThread}
            icon={AudioWaveform}
            onClick={onToggleVoice}
            variant="tertiary"
          />
          <IconButton
            className={dictating ? "active dictating" : ""}
            aria-label={t("composer.dictation")}
            disabled={recording || dictationProcessing || loadingThread}
            icon={Mic}
            onClick={onToggleDictation}
            variant="tertiary"
          />
          {busy && (
            <IconButton
              className="stop"
              aria-label={t("composer.stop")}
              icon={Square}
              onClick={onStop}
              variant="primary"
            />
          )}
          <IconButton
            className="send"
            aria-label={busy ? t("composer.steer") : t("composer.send")}
            disabled={!canSubmit}
            enabled={canSubmit}
            icon={ArrowUp}
            onClick={submit}
            variant="primary"
          />
        </div>
      </div>
    </div>
  );

  function removeContext(index: number, item: TurnContextItem) {
    setContext((items) => items.filter((_, current) => current !== index));
    if (item.type === "mention" || item.type === "skill") {
      const token =
        item.type === "skill"
          ? `$${item.name}`
          : item.path.startsWith("app://")
            ? `$${appSlug(item.name)}`
            : `@${item.name}`;
      setText((value) =>
        value
          .replace(token, "")
          .replace(/\s{2,}/g, " ")
          .trimStart(),
      );
    }
  }

  function addFileMention(file: FileSearchResult) {
    if (
      !context.some(
        (item) => item.type === "mention" && item.path === file.path,
      )
    ) {
      setContext((items) => [
        ...items,
        { type: "mention", name: file.fileName, path: file.path },
      ]);
      setText(
        (value) =>
          `${value}${value && !value.endsWith(" ") ? " " : ""}@${file.fileName} `,
      );
    }
    setMenu(null);
    textarea.current?.focus();
  }
}

const menuItemSelector =
  ':is([role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]):not(:disabled)';

function appSlug(name: string) {
  return name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
