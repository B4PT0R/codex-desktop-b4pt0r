import {
  BriefcaseBusiness,
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
import { useI18n } from "../i18n/I18nProvider";
import {
  CLOSED_STEP_GROUP_DWELL_MS,
  CLOSED_STEP_TOOL_DWELL_MS,
  TOOL_BACKGROUND_DWELL_MS,
  TOOL_COLLAPSE_MS,
  TOOL_COMPLETION_DWELL_MS,
  TOOL_GROUP_COLLAPSE_MS,
  TOOL_GROUP_DWELL_MS,
  TOOL_HIDE_MS,
} from "../lib/toolActivityTiming";
import type { ToolCall } from "../types";
import { ToolArtifacts } from "./ToolArtifacts";

type ToolGroupProps = {
  backgroundToolIds?: ReadonlySet<string>;
  maxVisibleActions?: number;
  onReviewDiff?: (tool: ToolCall) => void;
  /** True once later chat content is ready or the owning turn has ended. */
  stepClosed?: boolean;
  tools: ToolCall[];
};

type GroupPhase = "open" | "closing" | "closed";
type ToolPhase = "open" | "closing" | "collapsed";

export {
  TOOL_BACKGROUND_DWELL_MS,
  TOOL_COMPLETION_DWELL_MS,
  TOOL_COLLAPSE_MS,
  TOOL_GROUP_DWELL_MS,
  TOOL_GROUP_COLLAPSE_MS,
  TOOL_HIDE_MS,
} from "../lib/toolActivityTiming";

export const ToolGroup = memo(function ToolGroup({
  backgroundToolIds = EMPTY_TOOL_IDS,
  maxVisibleActions = 3,
  onReviewDiff,
  stepClosed,
  tools,
}: ToolGroupProps) {
  const { t } = useI18n();
  const count = tools.length;
  const runningCount = tools.filter(
    (tool) => tool.status === "running",
  ).length;
  const resolvedCount = count - runningCount;
  const failed = tools.some((tool) => tool.status === "error");
  const allResolved = count > 0 && resolvedCount === count;
  const yieldedCount = tools.filter(
    (tool) => tool.status === "running" && backgroundToolIds.has(tool.id),
  ).length;
  const allVisuallySettled =
    count > 0 && resolvedCount + yieldedCount === count;
  const closeRequested = stepClosed ?? allResolved;
  const liveSequence = useRef(runningCount > 0);
  const previousCount = useRef(count);
  const manuallyOpened = useRef(false);
  const [presentedCount, setPresentedCount] = useState(
    runningCount > 0 ? Math.min(1, count) : count,
  );
  const [collapsedThrough, setCollapsedThrough] = useState(
    runningCount > 0 ? 0 : count,
  );
  const [hiddenBefore, setHiddenBefore] = useState(() =>
    Math.max(0, count - maxVisibleActions),
  );
  const [hidingIndex, setHidingIndex] = useState<number | undefined>(
    undefined,
  );
  const [showHistory, setShowHistory] = useState(false);
  const [groupPhase, setGroupPhase] = useState<GroupPhase>(
    closeRequested && allResolved ? "closed" : "open",
  );
  const presentationActive =
    hidingIndex !== undefined ||
    presentedCount < count ||
    collapsedThrough < presentedCount;
  const canAutomaticallyClose =
    closeRequested && allVisuallySettled && !presentationActive;

  useLayoutEffect(() => {
    const previous = previousCount.current;
    previousCount.current = count;
    if (count <= previous) return;

    liveSequence.current = true;
    manuallyOpened.current = false;
    setShowHistory(false);
    setGroupPhase("open");
  }, [count]);

  useEffect(() => {
    const minimumHidden = Math.max(0, presentedCount - maxVisibleActions);
    setHiddenBefore((current) => Math.max(current, minimumHidden));
  }, [maxVisibleActions, presentedCount]);

  useEffect(() => {
    if (
      !liveSequence.current ||
      presentedCount >= count ||
      collapsedThrough < presentedCount ||
      hidingIndex !== undefined
    ) {
      return;
    }

    const visibleCount = presentedCount - hiddenBefore;
    if (visibleCount < maxVisibleActions) {
      setPresentedCount((current) => Math.min(current + 1, count));
      return;
    }

    setHidingIndex(hiddenBefore);
  }, [
    collapsedThrough,
    count,
    hiddenBefore,
    hidingIndex,
    maxVisibleActions,
    presentedCount,
  ]);

  useEffect(() => {
    if (hidingIndex === undefined) return;
    const timer = window.setTimeout(() => {
      setHiddenBefore((current) => current + 1);
      setHidingIndex(undefined);
      setPresentedCount((current) => Math.min(current + 1, count));
    }, TOOL_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [count, hidingIndex]);

  useEffect(() => {
    if (!canAutomaticallyClose) {
      if (groupPhase !== "open") setGroupPhase("open");
      return;
    }
    if (
      groupPhase !== "open" ||
      manuallyOpened.current
    ) {
      return;
    }
    const dwell = stepClosed
      ? CLOSED_STEP_GROUP_DWELL_MS
      : TOOL_GROUP_DWELL_MS;
    const timer = window.setTimeout(() => setGroupPhase("closing"), dwell);
    return () => window.clearTimeout(timer);
  }, [canAutomaticallyClose, groupPhase, stepClosed]);

  useEffect(() => {
    if (groupPhase !== "closing") return;
    const timer = window.setTimeout(
      () => setGroupPhase("closed"),
      TOOL_GROUP_COLLAPSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [groupPhase]);

  const handleCollapsed = useCallback((index: number) => {
    setCollapsedThrough((current) => Math.max(current, index + 1));
  }, []);

  const firstVisible = showHistory ? 0 : hiddenBefore;
  const visibleTools = tools
    .slice(firstVisible, presentedCount)
    .map((tool, offset) => ({
      index: firstVisible + offset,
      tool,
    }));
  const hiddenCount = showHistory ? 0 : hiddenBefore;
  const summary = groupSummary({
    allResolved,
    count,
    failed,
    resolvedCount,
    runningCount,
    t,
  });
  const groupExpanded = groupPhase !== "closed";

  return (
    <section className={`tool-group ${groupPhase}${failed ? " failed" : ""}`}>
      <button
        aria-expanded={groupExpanded}
        className="tool-group-summary"
        onClick={() => {
          if (!allResolved || presentationActive) return;
          if (groupPhase === "closed") {
            manuallyOpened.current = true;
            setGroupPhase("open");
            return;
          }
          if (manuallyOpened.current && groupPhase === "open") {
            manuallyOpened.current = false;
            setGroupPhase("closing");
          }
        }}
        type="button"
      >
        <span className="tool-icon">
          {runningCount > yieldedCount || presentationActive ? (
            <LoaderCircle className="spin" />
          ) : yieldedCount > 0 ? (
            <BriefcaseBusiness />
          ) : failed ? (
            <CircleAlert />
          ) : (
            <Check />
          )}
        </span>
        <span>{summary}</span>
        <ToolKindSummary tools={tools} />
        <ChevronDown className="tool-group-chevron" />
      </button>
      <div
        aria-hidden={!groupExpanded}
        className="tool-list-shell"
        hidden={!groupExpanded}
        inert={!groupExpanded}
      >
        <div className="tool-list">
          {hiddenCount > 0 && (
            <button
              className="tool-history-toggle"
              onClick={() => setShowHistory(true)}
              type="button"
            >
              {t(
                hiddenCount === 1
                  ? "tool.group.previousOne"
                  : "tool.group.previousMany",
                { count: hiddenCount },
              )}
            </button>
          )}
          {visibleTools.map(({ index, tool }) => (
            <ToolRow
              animateCompleted={liveSequence.current}
              className={index === hidingIndex ? "hiding" : undefined}
              index={index}
              key={tool.id}
              onCollapsed={handleCollapsed}
              onReviewDiff={onReviewDiff}
              stepClosed={Boolean(stepClosed)}
              tool={tool}
              yieldRunning={
                tool.status === "running" && backgroundToolIds.has(tool.id)
              }
            />
          ))}
          {showHistory && hiddenBefore > 0 && (
            <button
              className="tool-history-toggle"
              onClick={() => setShowHistory(false)}
              type="button"
            >
              {t("tool.group.collapse")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
});

const EMPTY_TOOL_IDS = new Set<string>();

function groupSummary({
  allResolved,
  count,
  failed,
  resolvedCount,
  runningCount,
  t,
}: {
  allResolved: boolean;
  count: number;
  failed: boolean;
  resolvedCount: number;
  runningCount: number;
  t: ReturnType<typeof useI18n>["t"];
}) {
  if (resolvedCount === 0) {
    return t("tool.group.runningOne");
  }
  if (resolvedCount > 0 && runningCount > 0) {
    const key =
      resolvedCount === 1
        ? runningCount === 1
          ? "tool.group.progressOneOne"
          : "tool.group.progressOneMany"
        : runningCount === 1
          ? "tool.group.progressManyOne"
          : "tool.group.progressManyMany";
    return t(key, { completed: resolvedCount, running: runningCount });
  }
  if (allResolved && failed) {
    return t(
      count === 1 ? "tool.group.failedOne" : "tool.group.failedMany",
      { count },
    );
  }
  return t(
    resolvedCount === 1 ? "tool.group.doneOne" : "tool.group.doneMany",
    { count: resolvedCount },
  );
}

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

const ToolRow = memo(function ToolRow({
  animateCompleted,
  className,
  index,
  onCollapsed,
  onReviewDiff,
  stepClosed,
  tool,
  yieldRunning,
}: {
  animateCompleted: boolean;
  className?: string;
  index: number;
  onCollapsed: (index: number) => void;
  onReviewDiff?: (tool: ToolCall) => void;
  stepClosed: boolean;
  tool: ToolCall;
  yieldRunning: boolean;
}) {
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
        <ToolDetails tool={tool} onReviewDiff={onReviewDiff} />
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
  onReviewDiff,
  tool,
}: {
  onReviewDiff?: (tool: ToolCall) => void;
  tool: ToolCall;
}) {
  const { t } = useI18n();
  const output = tool.output ?? tool.progress;
  return (
    <div className="tool-details">
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
