import { AlarmClock, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";

export function ScheduledTaskMessage({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();

  return (
    <section
      className={`scheduled-task-message${expanded ? " expanded" : ""}`}
    >
      <button
        aria-controls={bodyId}
        aria-expanded={expanded}
        className="scheduled-task-toggle"
        onClick={() => setExpanded((value) => !value)}
        title={t(
          expanded
            ? "conversation.scheduledTask.collapse"
            : "conversation.scheduledTask.expand",
        )}
        type="button"
      >
        <AlarmClock />
        <span>{t("conversation.scheduledTask")}</span>
        {message.title && <strong>{message.title}</strong>}
        <ChevronDown className="scheduled-task-chevron" />
      </button>
      {expanded && (
        <div className="scheduled-task-body" id={bodyId}>
          <Markdown>{message.content}</Markdown>
        </div>
      )}
    </section>
  );
}
