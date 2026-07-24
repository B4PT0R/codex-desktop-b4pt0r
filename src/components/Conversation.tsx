import { Folder, Sparkles } from "lucide-react";
import { memo } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AgentActivity } from "../lib/activity";
import type { ChatMessage, ToolCall } from "../types";
import { useConversationScroll } from "../lib/useConversationScroll";
import { AgentStatus } from "./AgentStatus";
import { Markdown } from "./Markdown";
import { SignalCards } from "./SignalCards";
import { ToolGroup } from "./ToolGroup";

type ConversationProps = {
  activity: AgentActivity;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  messages: ChatMessage[];
  onLoadOlder?: () => void;
  onReviewDiff?: (tool: ToolCall) => void;
};

export function Conversation({
  activity,
  canLoadOlder = false,
  loadingOlder = false,
  messages,
  onLoadOlder,
  onReviewDiff,
}: ConversationProps) {
  const { t } = useI18n();
  const scroll = useConversationScroll(messages, activity);

  return (
    <section
      className="conversation"
      onScroll={scroll.onScroll}
      ref={scroll.container}
    >
      {canLoadOlder && (
        <div className="history-loader">
          <button disabled={loadingOlder} onClick={onLoadOlder} type="button">
            {loadingOlder
              ? t("conversation.history.loading")
              : t("conversation.history.loadOlder")}
          </button>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="empty codex-mark" aria-label="Codex">
          <span className="hero-logo">
            <Sparkles />
          </span>
          <h1>{t("empty.title")}</h1>
          <p>{t("empty.subtitle")}</p>
        </div>
      ) : (
        messages.map((message) => (
          <ConversationMessage
            key={message.id}
            message={message}
            onReviewDiff={onReviewDiff}
          />
        ))
      )}
      <AgentStatus activity={activity} />
    </section>
  );
}

const ConversationMessage = memo(function ConversationMessage({
  message,
  onReviewDiff,
}: {
  message: ChatMessage;
  onReviewDiff?: (tool: ToolCall) => void;
}) {
  return (
    <article className={`message ${message.role}`}>
      <div className="message-content">
        {message.attachments?.map((attachment) => (
          <span className="file-chip" key={attachment}>
            <Folder />
            {attachment}
          </span>
        ))}
        <Markdown streaming={message.streaming}>{message.content}</Markdown>
        {message.streaming && <span className="cursor" />}
        {message.signals && message.signals.length > 0 && (
          <SignalCards signals={message.signals} />
        )}{" "}
        {message.tools && message.tools.length > 0 && (
          <ToolGroup tools={message.tools} onReviewDiff={onReviewDiff} />
        )}
      </div>
    </article>
  );
});
