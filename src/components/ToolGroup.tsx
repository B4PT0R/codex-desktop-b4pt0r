import {
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
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ToolCall } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import {
  CLOSED_STEP_GROUP_DWELL_MS,
  CLOSED_STEP_TOOL_DWELL_MS,
  TOOL_COLLAPSE_MS,
  TOOL_COMPLETION_DWELL_MS,
  TOOL_GROUP_COLLAPSE_MS,
  TOOL_GROUP_DWELL_MS,
} from "../lib/toolActivityTiming";
import { ToolArtifacts } from "./ToolArtifacts";

type ToolGroupProps = {
  tools: ToolCall[];
  onReviewDiff?: (tool: ToolCall) => void;
  stepClosed?: boolean;
};

export {
  TOOL_COMPLETION_DWELL_MS,
  TOOL_COLLAPSE_MS,
  TOOL_GROUP_DWELL_MS,
  TOOL_GROUP_COLLAPSE_MS,
} from "../lib/toolActivityTiming";

export const ToolGroup = memo(function ToolGroup({
  tools,
  onReviewDiff,
  stepClosed = false,
}: ToolGroupProps) {
  const { t } = useI18n();
  const running = tools.some((tool) => tool.status === "running");
  const failed = tools.some((tool) => tool.status === "error");
  const count = tools.length;
  const liveSequence = useRef(running);
  const [presentedCount, setPresentedCount] = useState(
    running ? Math.min(1, count) : count,
  );
  const [compactedCount, setCompactedCount] = useState(running ? 0 : count);
  const [activeWaveStart, setActiveWaveStart] = useState(0);
  const observedCount = useRef(count);
  const presentationPending = liveSequence.current && presentedCount < count;
  const presentationSettling =
    liveSequence.current && compactedCount < presentedCount;
  const active = running || presentationPending || presentationSettling;
  const canCondense = count > 4;
  const [phase, setPhase] = useState<"active" | "settling" | "complete">(
    active ? "active" : "complete",
  );
  const [showAll, setShowAll] = useState(!canCondense || active || failed);
  const manuallyExpanded = useRef(false);
  const hasRun = useRef(running);
  const hasCompleted = useRef(!active);
  const hiddenCount = showAll ? 0 : count - 3;
  const presentedTools = liveSequence.current
    ? tools.slice(0, presentedCount)
    : tools;
  const currentWaveTools =
    phase !== "complete" && activeWaveStart > 0
      ? presentedTools.slice(activeWaveStart)
      : presentedTools;
  const visibleTools = showAll
    ? currentWaveTools
    : currentWaveTools.slice(-3);
  const summary = failed
    ? t(count === 1 ? "tool.group.failedOne" : "tool.group.failedMany", {
        count,
      })
    : t(count === 1 ? "tool.group.doneOne" : "tool.group.doneMany", {
        count,
      });

  useEffect(() => {
    if (active) {
      manuallyExpanded.current = false;
      setShowAll(true);
    } else if (canCondense && !manuallyExpanded.current) {
      setShowAll(false);
    }
  }, [active, canCondense, failed]);

  useEffect(() => {
    if (active) {
      hasRun.current = true;
      hasCompleted.current = false;
      setPhase("active");
      return;
    }
    if (!hasRun.current) {
      hasCompleted.current = true;
      setPhase("complete");
      return;
    }
    if (hasCompleted.current) {
      setPhase("complete");
      return;
    }
    const dwell = stepClosed
      ? CLOSED_STEP_GROUP_DWELL_MS
      : TOOL_GROUP_DWELL_MS;
    const settlingTimer = window.setTimeout(
      () => setPhase("settling"),
      dwell,
    );
    const completeTimer = window.setTimeout(
      () => {
        hasCompleted.current = true;
        setPhase("complete");
      },
      dwell + TOOL_GROUP_COLLAPSE_MS,
    );
    return () => {
      window.clearTimeout(settlingTimer);
      window.clearTimeout(completeTimer);
    };
  }, [active, stepClosed]);

  useLayoutEffect(() => {
    const previousCount = observedCount.current;
    observedCount.current = count;
    if (count <= previousCount || !hasCompleted.current) return;

    // A call arriving after the whole group folded belongs to a new silent
    // agent step. Keep the shared group, but do not reopen completed cards from
    // the previous step while presenting the new wave.
    liveSequence.current = true;
    hasCompleted.current = false;
    setActiveWaveStart(previousCount);
    setPresentedCount(Math.min(previousCount + 1, count));
    setCompactedCount(previousCount);
    setPhase("active");
    setShowAll(true);
  }, [count]);

  const presentNextTool = useCallback(() => {
    setPresentedCount((current) => Math.min(current + 1, count));
  }, [count]);

  useEffect(() => {
    if (
      liveSequence.current &&
      presentedCount < count &&
      compactedCount >= presentedCount
    ) {
      presentNextTool();
    }
  }, [compactedCount, count, presentNextTool, presentedCount]);

  const toolList = (
    <div className="tool-list">
      {hiddenCount > 0 && (
        <button
          className="tool-history-toggle"
          onClick={() => {
            manuallyExpanded.current = true;
            setShowAll(true);
          }}
        >
          {t(
            hiddenCount === 1
              ? "tool.group.previousOne"
              : "tool.group.previousMany",
            { count: hiddenCount },
          )}
        </button>
      )}
      {visibleTools.map((tool, index) => (
        <ToolRow
          key={tool.id}
          tool={tool}
          onReviewDiff={onReviewDiff}
          forceReplay={liveSequence.current && presentedCount > 1}
          onCollapseStarted={
            index === visibleTools.length - 1 && presentationPending
              ? presentNextTool
              : undefined
          }
          onCompacted={
            liveSequence.current
              ? () =>
                  setCompactedCount((current) =>
                    Math.min(current + 1, count),
                  )
              : undefined
          }
          stepClosed={stepClosed}
        />
      ))}
      {canCondense && showAll && !active && !failed && (
        <button
          className="tool-history-toggle"
          onClick={() => {
            manuallyExpanded.current = false;
            setShowAll(false);
          }}
        >
          {t("tool.group.collapse")}
        </button>
      )}
    </div>
  );

  if (phase !== "complete") {
    return (
      <section className={`tool-group ${phase} ${failed ? "failed" : ""}`}>
        {toolList}
      </section>
    );
  }

  return (
    <details className={`tool-group complete${failed ? " failed" : ""}`}>
      <summary className="tool-group-summary">
        <span className="tool-icon">
          {failed ? <CircleAlert /> : <Check />}
        </span>
        <span>{summary}</span>
        <ToolKindSummary tools={tools} />
        <ChevronDown className="tool-group-chevron" />
      </summary>
      {toolList}
    </details>
  );
});

function ToolKindSummary({ tools }: { tools: ToolCall[] }) {
  const { t } = useI18n();
  const groups = [
    {
      key: "tool.kind.terminal" as const,
      icon: <Terminal />,
      count: tools.filter((tool) => tool.kind === "commandExecution").length,
    },
    {
      key: "tool.kind.files" as const,
      icon: <FilePenLine />,
      count: tools.filter((tool) => tool.kind === "fileChange").length,
    },
    {
      key: "tool.kind.integrations" as const,
      icon: <Plug />,
      count: tools.filter(
        (tool) => tool.kind === "mcpToolCall" || tool.kind === "dynamicToolCall",
      ).length,
    },
    {
      key: "tool.kind.web" as const,
      icon: <Search />,
      count: tools.filter((tool) => tool.kind === "webSearch").length,
    },
    {
      key: "tool.kind.media" as const,
      icon: <ImageIcon />,
      count: tools.filter(
        (tool) => tool.kind === "imageView" || tool.kind === "imageGeneration",
      ).length,
    },
  ];
  const knownCount = groups.reduce((total, group) => total + group.count, 0);
  const visibleGroups = [
    ...groups,
    {
      key: "tool.kind.other" as const,
      icon: <Wrench />,
      count: tools.length - knownCount,
    },
  ].filter((group) => group.count > 0);

  return (
    <span className="tool-kind-summary">
      {visibleGroups.map((group) => (
        <span key={group.key}>
          {group.icon}
          {t(group.key)} {group.count}
        </span>
      ))}
    </span>
  );
}

function ToolRow({
  tool,
  onReviewDiff,
  forceReplay = false,
  onCollapseStarted,
  onCompacted,
  stepClosed = false,
}: Omit<ToolGroupProps, "tools"> & {
  forceReplay?: boolean;
  onCollapseStarted?: () => void;
  onCompacted?: () => void;
  tool: ToolCall;
}) {
  const hasDetails = Boolean(
    tool.output ||
      tool.diff ||
      tool.progress ||
      tool.artifacts?.some((artifact) => artifact.type !== "generatedImage"),
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [phase, setPhase] = useState<"full" | "collapsing" | "compact">(
    tool.status !== "running" && !forceReplay ? "compact" : "full",
  );
  const hasRun = useRef(tool.status === "running" || forceReplay);
  const hasCompacted = useRef(
    tool.status !== "running" && !forceReplay,
  );
  const onCollapseStartedRef = useRef(onCollapseStarted);
  const onCompactedRef = useRef(onCompacted);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    onCollapseStartedRef.current = onCollapseStarted;
    onCompactedRef.current = onCompacted;
  }, [onCollapseStarted, onCompacted]);
  useEffect(() => {
    if (tool.status === "running") {
      hasRun.current = true;
      hasCompacted.current = false;
      setPhase("full");
      if (hasDetails) setDetailsOpen(true);
      return;
    }
    if (!hasRun.current) {
      hasCompacted.current = true;
      setPhase("compact");
      return;
    }
    if (hasCompacted.current) {
      setPhase("compact");
      return;
    }
    const dwell = stepClosed
      ? CLOSED_STEP_TOOL_DWELL_MS
      : TOOL_COMPLETION_DWELL_MS;
    const collapsingTimer = window.setTimeout(() => {
      setPhase("collapsing");
      onCollapseStartedRef.current?.();
    }, dwell);
    const compactTimer = window.setTimeout(() => {
      hasCompacted.current = true;
      setDetailsOpen(false);
      setPhase("compact");
      onCompactedRef.current?.();
    }, dwell + TOOL_COLLAPSE_MS);
    return () => {
      window.clearTimeout(collapsingTimer);
      window.clearTimeout(compactTimer);
    };
  }, [hasDetails, stepClosed, tool.status]);
  const content = (
    <>
      <ToolIcon kind={tool.kind} />
      <div className="tool-row-copy">
        <strong>{tool.title}</strong>
        <code>{tool.detail}</code>
        {tool.progress && <small>{tool.progress}</small>}
        <ToolMetrics tool={tool} />
      </div>
      <ToolStatus status={tool.status} />
      {hasDetails && <ChevronDown className="tool-row-chevron" />}
    </>
  );

  return hasDetails ? (
    <details
      ref={detailsRef}
      className={`tool-row ${tool.status} ${phase}`}
      open={detailsOpen}
      onToggle={(event) => {
        const open = event.currentTarget.open;
        setDetailsOpen(open);
        if (open)
          detailsRef.current?.scrollIntoView?.({
            behavior: "smooth",
            block: "nearest",
          });
      }}
    >
      <summary>{content}</summary>
      <ToolDetails tool={tool} onReviewDiff={onReviewDiff} />
    </details>
  ) : (
    <div
      className={`tool-row ${tool.status} ${phase}`}
    >
      {content}
    </div>
  );
}

function ToolStatus({ status }: { status: ToolCall["status"] }) {
  const { t } = useI18n();
  const label =
    status === "running"
      ? t("tool.status.running")
      : status === "error"
        ? t("tool.status.error")
        : t("tool.status.done");
  return (
    <span
      className={`tool-row-status ${status}`}
      aria-label={label}
      title={label}
    >
      {status === "running" ? (
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
  if (kind === "commandExecution") return <Terminal />;
  if (kind === "fileChange") return <FilePenLine />;
  if (kind === "mcpToolCall" || kind === "dynamicToolCall") return <Plug />;
  if (kind === "webSearch") return <Search />;
  if (kind === "imageView" || kind === "imageGeneration") return <ImageIcon />;
  return <Wrench />;
}

function ToolMetrics({ tool }: { tool: ToolCall }) {
  const { t } = useI18n();
  if (tool.exitCode === undefined && tool.durationMs === undefined) return null;
  const duration =
    tool.durationMs === undefined
      ? undefined
      : tool.durationMs < 1000
        ? `${tool.durationMs} ms`
        : `${Math.round(tool.durationMs / 100) / 10} s`;
  return (
    <small className="tool-metrics">
      {tool.exitCode !== undefined &&
        t("tool.metric.exitCode", { code: tool.exitCode })}
      {tool.exitCode !== undefined && duration && " · "}
      {duration}
    </small>
  );
}

function ToolDetails({
  tool,
  onReviewDiff,
}: Omit<ToolGroupProps, "tools"> & { tool: ToolCall }) {
  const { t } = useI18n();
  return (
    <div className="tool-details">
      {tool.output && (
        <section>
          <span>{t("tool.details.output")}</span>
          <pre>{tool.output}</pre>
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
      {tool.artifacts?.some(
        (artifact) => artifact.type !== "generatedImage",
      ) && (
        <ToolArtifacts
          artifacts={tool.artifacts.filter(
            (artifact) => artifact.type !== "generatedImage",
          )}
        />
      )}
    </div>
  );
}
