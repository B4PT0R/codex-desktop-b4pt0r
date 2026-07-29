import { AlarmClock } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";

export function ScheduledTaskMessage({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  return (
    <div className="scheduled-task-message">
      <header>
        <AlarmClock />
        <span>{t("conversation.scheduledTask")}</span>
        {message.title && <strong>{message.title}</strong>}
      </header>
      <Markdown>{message.content}</Markdown>
    </div>
  );
}
