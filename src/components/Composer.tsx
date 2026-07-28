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
  CommandMenu,
  SkillsMenu,
} from "./ComposerMenus";
import { FileSearchMenu } from "./FileSearchMenu";
import type { AppInfo, AppServerSkill } from "../lib/appServerTypes";
import type { TurnContextItem } from "../lib/protocol";
import { useI18n } from "../i18n/I18nProvider";
import { useFileSearch, type FileSearchResult } from "../lib/useFileSearch";
import { RoundIconButton } from "./RoundIcon";

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
  recording: boolean;
  dictating: boolean;
  dictationProcessing: boolean;
  dictationInsertion?: { id: number; text: string };
  onOpenMcp: () => void;
  onOpenPlugins: () => void;
  onNeedApps: () => void;
  onNeedSkills: () => void;
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
  recording,
  dictating,
  dictationProcessing,
  dictationInsertion,
  onOpenMcp,
  onOpenPlugins,
  onNeedApps,
  onNeedSkills,
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
  const canSubmit = hasInput && (!busy || canSteer);
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
    textarea.current?.focus();
  }, [dictationInsertion]);

  function submit() {
    if (!canSubmit) return;
    onSend(text.trim(), context);
    setText("");
    setContext([]);
  }

  useEffect(() => {
    function close(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuSurface.current?.contains(target) &&
        !addButton.current?.contains(target)
      ) {
        setMenu(null);
      }
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const surface = menuSurface.current;
    surface
      ?.querySelector<HTMLElement>("[data-menu-autofocus]")
      ?.focus();
    if (!surface?.contains(document.activeElement))
      surface?.querySelector<HTMLButtonElement>(menuItemSelector)?.focus();
  }, [menu]);

  function closeMenu() {
    setMenu(null);
    addButton.current?.focus();
  }

  function moveInMenu(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (menu) closeMenu();
      else {
        setCommandMenuDismissed(true);
        textarea.current?.focus();
      }
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [
      ...(menuSurface.current?.querySelectorAll<HTMLButtonElement>(
        menuItemSelector,
      ) ?? []),
    ];
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowUp"
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
    <div className="composer-shell" ref={shell}>
      {text.startsWith("/") && !commandMenuDismissed && (
        <CommandMenu
          busy={busy}
          hasThread={hasThread}
          menuRef={menuSurface}
          onMenuKeyDown={moveInMenu}
          query={text}
          onSelect={(command) => {
            setText(command);
            setCommandMenuDismissed(true);
            textarea.current?.focus();
          }}
        />
      )}
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
            if (text.startsWith("/")) setCommandMenuDismissed(true);
          }
          if (event.key === "ArrowDown" && text.startsWith("/")) {
            const first = shell.current?.querySelector<HTMLButtonElement>(
              ".command-menu [role='menuitem']:not(:disabled)",
            );
            if (first) {
              event.preventDefault();
              first.focus();
            }
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="composer-actions">
        <div>
          <RoundIconButton
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
          <RoundIconButton
            className={recording ? "active" : ""}
            aria-label={t("composer.voice")}
            disabled={dictating}
            icon={AudioWaveform}
            onClick={onToggleVoice}
            variant="tertiary"
          />
          <RoundIconButton
            className={dictating ? "active dictating" : ""}
            aria-label={t("composer.dictation")}
            disabled={recording || dictationProcessing}
            icon={Mic}
            onClick={onToggleDictation}
            variant="tertiary"
          />
          {busy && (
            <RoundIconButton
              className="stop"
              aria-label={t("composer.stop")}
              icon={Square}
              onClick={onStop}
              variant="primary"
            />
          )}
          <RoundIconButton
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

const menuItemSelector = '[role="menuitem"]:not(:disabled)';

function appSlug(name: string) {
  return name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
