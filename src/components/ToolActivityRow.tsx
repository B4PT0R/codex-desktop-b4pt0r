import {
  BriefcaseBusiness,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  FilePenLine,
  Image as ImageIcon,
  LoaderCircle,
  Plug,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  CLOSED_STEP_TOOL_DWELL_MS,
  TOOL_BACKGROUND_DWELL_MS,
  TOOL_COLLAPSE_MS,
  TOOL_COMPLETION_DWELL_MS,
} from "../lib/toolActivityTiming";
import type { ChatMessage, SubagentTranscript, ToolCall } from "../types";
import { ToolArtifacts } from "./ToolArtifacts";

type ToolActivityRowProps = {
  animateCompleted: boolean;
  className?: string;
  index: number;
  onCollapsed: (index: number) => void;
  onReviewDiff?: (tool: ToolCall) => void;
  renderSubagentMessages?: (
    messages: ChatMessage[],
    complete: boolean,
  ) => ReactNode;
  stepClosed: boolean;
  subagentError?: string;
  subagentTranscripts?: Record<string, SubagentTranscript>;
  tool: ToolCall;
  yieldRunning: boolean;
};

type ToolPhase = "open" | "closing" | "collapsed";

export const ToolActivityRow = memo(function ToolActivityRow({
  animateCompleted,
  className,
  index,
  onCollapsed,
  onReviewDiff,
  renderSubagentMessages,
  stepClosed,
  subagentError,
  subagentTranscripts = {},
  tool,
  yieldRunning,
}: ToolActivityRowProps) {
  const wasPresentedLive = useRef(
    tool.status === "running" || animateCompleted,
  );
  const hasCollapsed = useRef(!wasPresentedLive.current);
  const closingStartedAt = useRef<number | undefined>(undefined);
  const manualTimer = useRef<number | undefined>(undefined);
  const [phase, setPhase] = useState<ToolPhase>(
    wasPresentedLive.current ? "open" : "collapsed",
  );

  useEffect(() => {
    if (tool.status === "running") {
      wasPresentedLive.current = true;
      if (hasCollapsed.current) return;
      if (!yieldRunning) {
        closingStartedAt.current = undefined;
        setPhase("open");
        return;
      }
      if (closingStartedAt.current !== undefined) {
        const remaining = Math.max(
          0,
          closingStartedAt.current + TOOL_COLLAPSE_MS - Date.now(),
        );
        const timer = window.setTimeout(() => {
          hasCollapsed.current = true;
          setPhase("collapsed");
          onCollapsed(index);
        }, remaining);
        return () => window.clearTimeout(timer);
      }
      const closingTimer = window.setTimeout(() => {
        closingStartedAt.current = Date.now();
        setPhase("closing");
      }, TOOL_BACKGROUND_DWELL_MS);
      const collapsedTimer = window.setTimeout(() => {
        hasCollapsed.current = true;
        setPhase("collapsed");
        onCollapsed(index);
      }, TOOL_BACKGROUND_DWELL_MS + TOOL_COLLAPSE_MS);
      return () => {
        window.clearTimeout(closingTimer);
        window.clearTimeout(collapsedTimer);
      };
    }
    if (closingStartedAt.current !== undefined && !hasCollapsed.current) {
      const remaining = Math.max(
        0,
        closingStartedAt.current + TOOL_COLLAPSE_MS - Date.now(),
      );
      const timer = window.setTimeout(() => {
        hasCollapsed.current = true;
        setPhase("collapsed");
        onCollapsed(index);
      }, remaining);
      return () => window.clearTimeout(timer);
    }
    closingStartedAt.current = undefined;
    if (!wasPresentedLive.current || hasCollapsed.current) {
      setPhase("collapsed");
      return;
    }
    const dwell = stepClosed
      ? CLOSED_STEP_TOOL_DWELL_MS
      : TOOL_COMPLETION_DWELL_MS;
    const closingTimer = window.setTimeout(
      () => setPhase("closing"),
      dwell,
    );
    const collapsedTimer = window.setTimeout(() => {
      hasCollapsed.current = true;
      setPhase("collapsed");
      onCollapsed(index);
    }, dwell + TOOL_COLLAPSE_MS);
    return () => {
      window.clearTimeout(closingTimer);
      window.clearTimeout(collapsedTimer);
    };
  }, [index, onCollapsed, stepClosed, tool.status, yieldRunning]);

  useEffect(
    () => () => {
      if (manualTimer.current) window.clearTimeout(manualTimer.current);
    },
    [],
  );

  const expanded = phase !== "collapsed";
  return (
    <article
      className={`tool-row ${tool.status} ${phase}${className ? ` ${className}` : ""}`}
    >
      <button
        aria-expanded={expanded}
        className="tool-row-header"
        onClick={() => {
          if (tool.status === "running" && !yieldRunning) return;
          if (phase === "collapsed") {
            setPhase("open");
            return;
          }
          if (phase === "open" && hasCollapsed.current) {
            setPhase("closing");
            manualTimer.current = window.setTimeout(() => {
              setPhase("collapsed");
              manualTimer.current = undefined;
            }, TOOL_COLLAPSE_MS);
          }
        }}
        type="button"
      >
        <ToolIcon kind={tool.kind} />
        <strong>{tool.title}</strong>
        <ToolMetrics tool={tool} />
        <ToolStatus background={yieldRunning} status={tool.status} />
        <ChevronDown className="tool-row-chevron" />
      </button>
      <div
        aria-hidden={!expanded}
        className="tool-details-shell"
        hidden={!expanded}
      >
        <ToolDetails
          onReviewDiff={onReviewDiff}
          renderSubagentMessages={renderSubagentMessages}
          subagentError={subagentError}
          subagentTranscripts={subagentTranscripts}
          tool={tool}
        />
      </div>
    </article>
  );
});

function ToolStatus({
  background,
  status,
}: {
  background: boolean;
  status: ToolCall["status"];
}) {
  const { t } = useI18n();
  const label = background
    ? t("tool.status.background")
    : status === "running"
      ? t("tool.status.running")
      : status === "error"
        ? t("tool.status.error")
        : t("tool.status.done");
  return (
    <span
      aria-label={label}
      className={`tool-row-status ${status}`}
      title={label}
    >
      {background ? (
        <BriefcaseBusiness />
      ) : status === "running" ? (
        <LoaderCircle className="spin" />
      ) : status === "error" ? (
        <CircleAlert />
      ) : (
        <Check />
      )}
    </span>
  );
}

function ToolIcon({ kind }: { kind: ToolCall["kind"] }) {
  if (kind === "collabAgentToolCall") return <Bot />;
  if (kind === "commandExecution") return <Terminal />;
  if (kind === "fileChange") return <FilePenLine />;
  if (kind === "mcpToolCall" || kind === "dynamicToolCall") return <Plug />;
  if (kind === "webSearch") return <Search />;
  if (kind === "imageView" || kind === "imageGeneration") return <ImageIcon />;
  return <Wrench />;
}

function ToolMetrics({ tool }: { tool: ToolCall }) {
  if (tool.durationMs === undefined) return null;
  const duration =
    tool.durationMs < 1000
      ? `${tool.durationMs} ms`
      : `${Math.round(tool.durationMs / 100) / 10} s`;
  return (
    <small className="tool-metrics">
      {duration}
    </small>
  );
}

function ToolDetails({
  onReviewDiff,
  renderSubagentMessages,
  subagentError,
  subagentTranscripts,
  tool,
}: {
  onReviewDiff?: (tool: ToolCall) => void;
  renderSubagentMessages?: (
    messages: ChatMessage[],
    complete: boolean,
  ) => ReactNode;
  subagentError?: string;
  subagentTranscripts: Record<string, SubagentTranscript>;
  tool: ToolCall;
}) {
  const { t } = useI18n();
  if (tool.subagent) {
    return (
      <SubagentToolDetails
        error={subagentError}
        renderMessages={renderSubagentMessages}
        transcripts={subagentTranscripts}
        tool={tool}
      />
    );
  }
  const output = tool.output ?? tool.progress;
  const artifacts = tool.artifacts?.filter(
    (artifact) => artifact.type !== "generatedImage",
  );
  return (
    <div className="tool-details">
      {tool.exitCode !== undefined && (
        <div className="tool-detail-meta">
          {t("tool.metric.exitCode", { code: tool.exitCode })}
        </div>
      )}
      <section>
        <span>{t("tool.details.input")}</span>
        <pre>{tool.detail}</pre>
      </section>
      {output && (
        <section>
          <span>{t("tool.details.output")}</span>
          <pre>{output}</pre>
        </section>
      )}
      {tool.diff && (
        <section>
          <div className="tool-detail-heading">
            <span>{t("tool.details.changes")}</span>
            {onReviewDiff && (
              <button onClick={() => onReviewDiff(tool)}>
                {t("tool.details.review")}
              </button>
            )}
          </div>
          <pre className="tool-diff">{tool.diff}</pre>
        </section>
      )}
      {artifacts && artifacts.length > 0 && (
        <ToolArtifacts artifacts={artifacts} />
      )}
    </div>
  );
}

function SubagentToolDetails({
  error,
  renderMessages,
  transcripts,
  tool,
}: {
  error?: string;
  renderMessages?: (messages: ChatMessage[], complete: boolean) => ReactNode;
  transcripts: Record<string, SubagentTranscript>;
  tool: ToolCall;
}) {
  const { t } = useI18n();
  const subagent = tool.subagent!;
  return (
    <div className="tool-details subagent-tool-details">
      {subagent.prompt && (
        <section className="subagent-objective">
          <span>{t("tool.subagent.objective")}</span>
          <p>{subagent.prompt}</p>
        </section>
      )}
      {(subagent.model || subagent.reasoningEffort) && (
        <div className="subagent-meta">
          {subagent.model && <span>{subagent.model}</span>}
          {subagent.reasoningEffort && <span>{subagent.reasoningEffort}</span>}
        </div>
      )}
      {subagent.threadIds.length === 0 ? (
        <p className="subagent-empty">{t("tool.subagent.starting")}</p>
      ) : (
        subagent.threadIds.map((threadId, index) => {
          const transcript = transcripts[threadId];
          const complete =
            transcript?.status === "completed" ||
            transcript?.status === "interrupted" ||
            transcript?.status === "error";
          return (
            <section className="subagent-thread" key={threadId}>
              <header>
                <Bot />
                <strong>
                  {transcript?.name ??
                    transcript?.path?.split("/").filter(Boolean).at(-1) ??
                    t("tool.subagent.name", { index: index + 1 })}
                </strong>
                {transcript?.role && <span>{transcript.role}</span>}
                <small>
                  {t(
                    `tool.subagent.status.${transcript?.status ?? "pending"}`,
                  )}
                </small>
              </header>
              {transcript?.messages.length && renderMessages ? (
                <div className="subagent-transcript">
                  {renderMessages(transcript.messages, complete)}
                </div>
              ) : (
                <p className="subagent-empty">
                  {error ?? t("tool.subagent.waiting")}
                </p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
