import { Folder, Sparkles } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AgentActivity } from "../lib/activity";
import type { ChatMessage, ToolCall } from "../types";
import { useConversationScroll } from "../lib/useConversationScroll";
import { AgentStatus } from "./AgentStatus";
import { Markdown } from "./Markdown";
import { SignalCards } from "./SignalCards";
import { ToolGroup } from "./ToolGroup";
import { PlanProgressWidget } from "./PlanProgressWidget";
import {
  RealtimeTextMessage,
  RealtimeVoiceMessage,
} from "./RealtimeAssistantMessage";
import { ApplicationErrorMessage } from "./ApplicationErrorMessage";
import { GeneratedImageWidget } from "./GeneratedImageWidget";
import { MarkdownLinkProvider } from "./MarkdownLinkContext";
import type { FileOpener } from "../lib/protocol";
import { MemoryCitations } from "./MemoryCitations";
import { ScheduledTaskMessage } from "./ScheduledTaskMessage";

type ConversationProps = {
  activity: AgentActivity;
  backgroundToolIds?: ReadonlySet<string>;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  maxVisibleActions?: number;
  messages: ChatMessage[];
  onLoadOlder?: () => void;
  onReviewDiff?: (tool: ToolCall) => void;
  cwd?: string;
  fileOpener?: FileOpener;
  onLinkError?: (error: unknown) => void;
};

export function Conversation({
  activity,
  backgroundToolIds,
  canLoadOlder = false,
  loadingOlder = false,
  maxVisibleActions = 3,
  messages,
  cwd,
  fileOpener = "none",
  onLinkError = () => undefined,
  onLoadOlder,
  onReviewDiff,
}: ConversationProps) {
  const { t } = useI18n();
  const scroll = useConversationScroll(messages, activity);
  const plan = latestPlan(messages);

  return (
    <MarkdownLinkProvider value={{ cwd, fileOpener, onError: onLinkError }}>
      <div className="conversation-shell">
        <div className="conversation-viewport">
          <section
            className={`conversation${plan ? " has-plan" : ""}`}
            onKeyDown={scroll.onKeyDown}
            onPointerDown={scroll.onPointerDown}
            onPointerUp={scroll.onPointerUp}
            onScroll={scroll.onScroll}
            onWheel={scroll.onWheel}
            ref={scroll.container}
          >
            <div
              className={`conversation-content${messages.length === 0 ? " is-empty" : ""}`}
              ref={scroll.content}
            >
              {canLoadOlder && (
                <div className="history-loader">
                  <button
                    disabled={loadingOlder}
                    onClick={onLoadOlder}
                    type="button"
                  >
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
                messages.map((message, messageIndex) => (
                  <ConversationMessage
                    key={message.id}
                    message={message}
                    backgroundToolIds={backgroundToolIds}
                    maxVisibleActions={maxVisibleActions}
                    onReviewDiff={onReviewDiff}
                    stepClosed={
                      messageIndex < messages.length - 1 ||
                      (messageIndex === messages.length - 1 && activity === null)
                    }
                  />
                ))
              )}
              <AgentStatus activity={activity} />
              <PlanProgressWidget plan={plan} />
            </div>
          </section>
        </div>
      </div>
    </MarkdownLinkProvider>
  );
}

const ConversationMessage = memo(function ConversationMessage({
  message,
  backgroundToolIds,
  maxVisibleActions,
  onReviewDiff,
  stepClosed,
}: {
  message: ChatMessage;
  backgroundToolIds?: ReadonlySet<string>;
  maxVisibleActions: number;
  onReviewDiff?: (tool: ToolCall) => void;
  stepClosed: boolean;
}) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(
    () => !message.revealAfter || message.revealAfter <= Date.now(),
  );
  const reasoningSignals = message.signals?.filter(
    (signal) => signal.kind === "reasoning",
  );
  const trailingSignals = message.signals?.filter(
    (signal) => signal.kind !== "plan" && signal.kind !== "reasoning",
  );
  const generatedImages = message.tools?.flatMap((tool) =>
    (tool.artifacts ?? []).filter(
      (artifact) => artifact.type === "generatedImage",
    ),
  );

  useEffect(() => {
    if (!message.revealAfter) {
      setRevealed(true);
      return;
    }
    const remaining = message.revealAfter - Date.now();
    if (remaining <= 0) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), remaining);
    return () => window.clearTimeout(timer);
  }, [message.revealAfter]);

  if (!revealed) return null;

  return (
    <article
      className={`message ${message.role}${message.modality ? ` modality-${message.modality}` : ""}`}
    >
      <div className="message-content">
        {message.attachments?.map((attachment) => (
          <span className="file-chip" key={attachment}>
            <Folder />
            {attachment}
          </span>
        ))}
        {message.skills?.map((skill) => (
          <span className="skill-chip" key={skill.name}>
            <Sparkles />
            {t("conversation.skill", { name: skill.name })}
          </span>
        ))}
        {reasoningSignals && reasoningSignals.length > 0 && (
          <SignalCards signals={reasoningSignals} />
        )}
        {message.modality === "applicationError" ? (
          <ApplicationErrorMessage message={message} />
        ) : message.modality === "realtimeVoice" ? (
          <RealtimeVoiceMessage message={message} />
        ) : message.modality === "realtimeText" ? (
          <RealtimeTextMessage message={message} />
        ) : message.modality === "scheduledTask" ? (
          <ScheduledTaskMessage message={message} />
        ) : (
          <Markdown streaming={message.streaming}>{message.content}</Markdown>
        )}
        {message.memoryCitations && message.memoryCitations.length > 0 && (
          <MemoryCitations citations={message.memoryCitations} />
        )}
        {trailingSignals && trailingSignals.length > 0 && (
          <SignalCards signals={trailingSignals} />
        )}{" "}
        {message.tools && message.tools.length > 0 && (
          <ToolGroup
            backgroundToolIds={backgroundToolIds}
            maxVisibleActions={maxVisibleActions}
            tools={message.tools}
            onReviewDiff={onReviewDiff}
            stepClosed={stepClosed}
          />
        )}
        {generatedImages && generatedImages.length > 0 && (
          <GeneratedImageWidget artifacts={generatedImages} />
        )}
      </div>
    </article>
  );
});

function latestPlan(messages: ChatMessage[]) {
  for (
    let messageIndex = messages.length - 1;
    messageIndex >= 0;
    messageIndex -= 1
  ) {
    const signals = messages[messageIndex].signals;
    if (!signals) continue;
    for (
      let signalIndex = signals.length - 1;
      signalIndex >= 0;
      signalIndex -= 1
    ) {
      if (signals[signalIndex].kind === "plan") return signals[signalIndex];
    }
  }
  return undefined;
}
