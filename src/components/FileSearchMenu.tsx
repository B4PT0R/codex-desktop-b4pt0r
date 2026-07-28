import { ArrowLeft, FileText, Search } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { RoundIconButton } from "./RoundIcon";
import type { FileSearchResult } from "../lib/useFileSearch";
import type { ComposerMenuSurfaceProps } from "./ComposerMenus";

export function FileSearchMenu({
  complete,
  error,
  loading,
  query,
  results,
  onBack,
  onQueryChange,
  onSelect,
  menuRef,
  onMenuKeyDown,
}: {
  complete: boolean;
  error?: string;
  loading: boolean;
  query: string;
  results: FileSearchResult[];
  onBack: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (file: FileSearchResult) => void;
} & ComposerMenuSurfaceProps) {
  const { t } = useI18n();
  return (
    <div
      className="composer-menu file-search-menu"
      ref={menuRef}
      role="menu"
      aria-label={t("composer.files")}
      onKeyDown={onMenuKeyDown}
    >
      <RoundIconButton
        className="composer-menu-back"
        icon={ArrowLeft}
        label={t("composer.files")}
        onClick={onBack}
        role="menuitem"
        variant="tertiary"
      />
      <label className="file-search-input">
        <Search />
        <input
          data-menu-autofocus
          aria-label={t("composer.files.search")}
          placeholder={t("composer.files.placeholder")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
              return;
            event.stopPropagation();
            if (event.key !== "ArrowDown") return;
            const first = event.currentTarget
              .closest("[role=menu]")
              ?.querySelector<HTMLButtonElement>(
                ".file-search-results [role=menuitem]",
              );
            if (first) {
              event.preventDefault();
              first.focus();
            }
          }}
        />
      </label>
      <div className="file-search-results">
        {error ? (
          <p role="alert">{t("composer.files.error", { detail: error })}</p>
        ) : !query.trim() ? (
          <p>{t("composer.files.hint")}</p>
        ) : loading && results.length === 0 ? (
          <p>{t("composer.files.loading")}</p>
        ) : results.length === 0 && complete ? (
          <p>{t("composer.files.empty")}</p>
        ) : (
          results.map((file) => (
            <button
              key={file.path}
              role="menuitem"
              onClick={() => onSelect(file)}
            >
              <FileText />
              <span>
                <b>{file.fileName}</b>
                <small>{relativePath(file)}</small>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function relativePath(file: FileSearchResult) {
  const root = file.root.replace(/\/$/, "");
  return file.path.startsWith(`${root}/`)
    ? file.path.slice(root.length + 1)
    : file.path;
}
