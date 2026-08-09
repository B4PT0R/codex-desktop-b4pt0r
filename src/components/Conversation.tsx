import { Folder, LoaderCircle, Sparkles } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AgentActivity } from "../lib/activity";
import type { ChatMessage, SubagentTranscript, ToolCall } from "../types";
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
import { CommandResultMessage } from "./CommandResultMessage";
import { presentSubagentTools } from "../lib/subagentPresentation";
import { messagesForPresentation } from "../lib/chatPresentation";

const loadingExitDurationMs = 180;
const loadingLayerExitDurationMs = 400;
const EMPTY_SUBAGENT_TRANSCRIPTS: Record<string, SubagentTranscript> = {};

type ConversationProps = {
  activity: AgentActivity;
  backgroundToolIds?: ReadonlySet<string>;
  canLoadOlder?: boolean;
  loadingThread?: boolean;
  loadingOlder?: boolean;
  keepActionGroupsCollapsed?: boolean;
  maxVisibleActions?: number;
  messages: ChatMessage[];
  onLoadOlder?: () => void;
  onReviewDiff?: (tool: ToolCall) => void;
  cwd?: string;
  fileOpener?: FileOpener;
  onLinkError?: (error: unknown) => void;
  subagentError?: string;
  subagentTranscripts?: Record<string, SubagentTranscript>;
  showReasoningItems?: boolean;
};

export function Conversation({
  activity,
  backgroundToolIds,
  canLoadOlder = false,
  loadingThread = false,
  loadingOlder = false,
  keepActionGroupsCollapsed = false,
  maxVisibleActions = 3,
  messages,
  cwd,
  fileOpener = "none",
  onLinkError = () => undefined,
  onLoadOlder,
  onReviewDiff,
  subagentError,
  subagentTranscripts = {},
  showReasoningItems = true,
}: ConversationProps) {
  const { t } = useI18n();
  const scroll = useConversationScroll(messages, activity);
  const plan = latestPlan(messages);
  const presentedMessages = useMemo(
    () => messagesForPresentation(messages, showReasoningItems),
    [messages, showReasoningItems],
  );
  const wasLoadingThread = useRef(loadingThread);
  const [loadingVisible, setLoadingVisible] = useState(loadingThread);
  const [loadingExiting, setLoadingExiting] = useState(false);
  const [loadingLayerExiting, setLoadingLayerExiting] = useState(false);

  useEffect(() => {
    const wasLoading = wasLoadingThread.current;
    wasLoadingThread.current = loadingThread;
    if (loadingThread) {
      setLoadingVisible(true);
      setLoadingExiting(false);
      setLoadingLayerExiting(false);
      return;
    }
    if (!wasLoading) return;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion) {
      setLoadingVisible(false);
      setLoadingExiting(false);
      setLoadingLayerExiting(false);
      return;
    }

    setLoadingExiting(true);
    let layerTimer: number | undefined;
    const spinnerTimer = window.setTimeout(() => {
      setLoadingExiting(false);
      setLoadingLayerExiting(true);
      layerTimer = window.setTimeout(() => {
        setLoadingVisible(false);
        setLoadingLayerExiting(false);
      }, loadingLayerExitDurationMs);
    }, loadingExitDurationMs);

    return () => {
      window.clearTimeout(spinnerTimer);
      if (layerTimer !== undefined) window.clearTimeout(layerTimer);
    };
  }, [loadingThread]);

  const showingLoading = loadingThread || loadingVisible;
  const contentState = presentedMessages.length === 0 ? " is-empty" : "";

  return (
    <MarkdownLinkProvider value={{ cwd, fileOpener, onError: onLinkError }}>
      <div className="conversation-shell">
        <div className="conversation-viewport">
          {showingLoading && (
            <div
              className={`conversation-loading-layer${
                loadingLayerExiting ? " is-exiting" : ""
              }`}
            >
              {!loadingLayerExiting && (
                <div
                  aria-label={t("conversation.loading")}
                  className={`conversation-loading${
                    loadingExiting ? " is-exiting" : ""
                  }`}
                  role="status"
                >
                  <LoaderCircle aria-hidden="true" className="spin" />
                </div>
              )}
            </div>
          )}
          <section
            aria-busy={showingLoading}
            className={`conversation${plan ? " has-plan" : ""}`}
            onKeyDown={scroll.onKeyDown}
            onPointerDown={scroll.onPointerDown}
            onPointerUp={scroll.onPointerUp}
            onScroll={scroll.onScroll}
            onWheel={scroll.onWheel}
            ref={scroll.container}
          >
            <div
              aria-hidden={showingLoading || undefined}
              className={`conversation-content${contentState}`}
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
              {presentedMessages.length === 0 ? (
                <div className="empty codex-mark" aria-label="Codex">
                  <span className="hero-logo">
                    <Sparkles />
                  </span>
                  <h1>{t("empty.title")}</h1>
                  <p>{t("empty.subtitle")}</p>
                </div>
              ) : (
                presentedMessages.map((message, messageIndex) => {
                  const tracksSubagents = hasSubagentTool(message);
                  return (
                    <ConversationMessage
                      key={message.id}
                      message={message}
                      backgroundToolIds={backgroundToolIds}
                      keepActionGroupsCollapsed={keepActionGroupsCollapsed}
                      maxVisibleActions={maxVisibleActions}
                      onReviewDiff={onReviewDiff}
                      showReasoningItems={showReasoningItems}
                      subagentError={tracksSubagents ? subagentError : undefined}
                      subagentTranscripts={
                        tracksSubagents
                          ? subagentTranscripts
                          : EMPTY_SUBAGENT_TRANSCRIPTS
                      }
                      stepClosed={
                        messageIndex < presentedMessages.length - 1 ||
                        (messageIndex === presentedMessages.length - 1 && activity === null)
                      }
                    />
                  );
                })
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
  keepActionGroupsCollapsed,
  onReviewDiff,
  subagentError,
  subagentTranscripts,
  showReasoningItems,
  stepClosed,
  depth = 0,
}: {
  message: ChatMessage;
  backgroundToolIds?: ReadonlySet<string>;
  maxVisibleActions: number;
  keepActionGroupsCollapsed: boolean;
  onReviewDiff?: (tool: ToolCall) => void;
  subagentError?: string;
  subagentTranscripts: Record<string, SubagentTranscript>;
  showReasoningItems: boolean;
  stepClosed: boolean;
  depth?: number;
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
  const presentedTools = useMemo(
    () =>
      presentSubagentTools(
        message.tools ?? [],
        subagentTranscripts,
        backgroundToolIds,
        stepClosed,
      ),
    [backgroundToolIds, message.tools, stepClosed, subagentTranscripts],
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

  const renderTools = (tools = presentedTools.tools) => tools.length > 0 && (
    <ToolGroup
      backgroundToolIds={presentedTools.backgroundToolIds}
      keepCollapsed={keepActionGroupsCollapsed}
      maxVisibleActions={maxVisibleActions}
      tools={tools}
      onReviewDiff={onReviewDiff}
      renderSubagentMessages={
        depth >= 4
          ? undefined
          : (childMessages, childComplete) =>
              messagesForPresentation(
                childMessages,
                showReasoningItems,
              ).map((childMessage, childIndex, presentedChildren) => {
                const tracksSubagents = hasSubagentTool(childMessage);
                return (
                  <ConversationMessage
                    backgroundToolIds={backgroundToolIds}
                    depth={depth + 1}
                    keepActionGroupsCollapsed={keepActionGroupsCollapsed}
                    key={childMessage.id}
                    maxVisibleActions={maxVisibleActions}
                    message={childMessage}
                    onReviewDiff={onReviewDiff}
                    showReasoningItems={showReasoningItems}
                    stepClosed={
                      childIndex < presentedChildren.length - 1 ||
                      childComplete
                    }
                    subagentError={tracksSubagents ? subagentError : undefined}
                    subagentTranscripts={
                      tracksSubagents
                        ? subagentTranscripts
                        : EMPTY_SUBAGENT_TRANSCRIPTS
                    }
                  />
                );
              })
      }
      stepClosed={stepClosed}
      subagentError={subagentError}
      subagentTranscripts={subagentTranscripts}
    />
  );

  const renderRealtimeSegments = () => {
    const segments = message.realtimeSegments;
    if (!segments?.length) return undefined;
    const nodes: ReactNode[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (segment.type === "text") {
        if (segment.content) {
          nodes.push(
            <div className="realtime-text-segment" key={`text-${segment.id}`}>
              <Markdown streaming={message.streaming}>{segment.content}</Markdown>
            </div>,
          );
        }
        continue;
      }
      const toolIds = new Set<string>();
      while (index < segments.length && segments[index].type === "tool") {
        toolIds.add(segments[index].id);
        index += 1;
      }
      index -= 1;
      const tools = presentedTools.tools.filter((tool) => toolIds.has(tool.id));
      if (tools.length) {
        nodes.push(
          <div className="realtime-tool-segment" key={`tools-${[...toolIds].join("-")}`}>
            {renderTools(tools)}
          </div>,
        );
      }
    }
    return nodes;
  };

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
          <RealtimeTextMessage
            content={renderRealtimeSegments()}
            details={message.realtimeSegments ? undefined : renderTools()}
            message={message}
          />
        ) : message.modality === "scheduledTask" ? (
          <ScheduledTaskMessage message={message} />
        ) : message.modality === "commandResult" ? (
          <CommandResultMessage message={message} />
        ) : (
          <Markdown streaming={message.streaming}>{message.content}</Markdown>
        )}
        {message.memoryCitations && message.memoryCitations.length > 0 && (
          <MemoryCitations citations={message.memoryCitations} />
        )}
        {trailingSignals && trailingSignals.length > 0 && (
          <SignalCards signals={trailingSignals} />
        )}{" "}
        {message.modality !== "realtimeText" && renderTools()}
        {generatedImages && generatedImages.length > 0 && (
          <GeneratedImageWidget artifacts={generatedImages} />
        )}
      </div>
    </article>
  );
});

function hasSubagentTool(message: ChatMessage) {
  return message.tools?.some((tool) => tool.subagent) ?? false;
}

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
