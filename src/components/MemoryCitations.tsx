import { BookOpen } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { openMarkdownLink } from "../lib/markdownLinks";
import type { MemoryCitation } from "../types";
import { useMarkdownLinkRouting } from "./MarkdownLinkContext";

export function MemoryCitations({
  citations,
}: {
  citations: MemoryCitation[];
}) {
  const { t } = useI18n();
  const routing = useMarkdownLinkRouting();
  return (
    <aside className="memory-citations" aria-label={t("citation.memory.title")}>
      <BookOpen />
      <div>
        <strong>{t("citation.memory.title")}</strong>
        {citations.map((citation) => (
          <button
            key={`${citation.path}:${citation.lineStart}:${citation.lineEnd}`}
            title={citation.note}
            onClick={() =>
              void openMarkdownLink(
                `file://${citation.path}#L${citation.lineStart}-L${citation.lineEnd}`,
                routing,
              ).catch(routing.onError)
            }
          >
            {citation.note || citation.path.split("/").pop()}
            <small>
              {t("citation.memory.lines", {
                start: citation.lineStart,
                end: citation.lineEnd,
              })}
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}
