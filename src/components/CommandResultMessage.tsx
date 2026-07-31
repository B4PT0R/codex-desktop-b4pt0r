import { ChevronDown, SquareTerminal } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";
import "../command-result.css";

export function CommandResultMessage({
  message,
}: {
  message: ChatMessage;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();

  return (
    <section className={`command-result${expanded ? " expanded" : ""}`}>
      <button
        aria-controls={bodyId}
        aria-expanded={expanded}
        className="command-result-toggle"
        onClick={() => setExpanded((value) => !value)}
        title={t(
          expanded
            ? "conversation.commandResult.collapse"
            : "conversation.commandResult.expand",
        )}
        type="button"
      >
        <SquareTerminal aria-hidden="true" />
        <strong>{message.title}</strong>
        <span>{t("conversation.commandResult")}</span>
        <ChevronDown className="command-result-chevron" />
      </button>
      {expanded && (
        <div className="command-result-body" id={bodyId}>
          <Markdown>{message.content}</Markdown>
        </div>
      )}
    </section>
  );
}
