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
import { memo, useEffect, useRef, useState } from "react";
import type { ToolCall } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import { ToolArtifacts } from "./ToolArtifacts";

type ToolGroupProps = {
  tools: ToolCall[];
  onReviewDiff?: (tool: ToolCall) => void;
};

export const ToolGroup = memo(function ToolGroup({
  tools,
  onReviewDiff,
}: ToolGroupProps) {
  const { t } = useI18n();
  const running = tools.some((tool) => tool.status === "running");
  const failed = tools.some((tool) => tool.status === "error");
  const count = tools.length;
  const canCondense = count > 4;
  const [showAll, setShowAll] = useState(!canCondense || running || failed);
  const manuallyExpanded = useRef(false);
  const hiddenCount = showAll ? 0 : count - 3;
  const visibleTools = showAll ? tools : tools.slice(-3);
  const summary = failed
    ? t(count === 1 ? "tool.group.failedOne" : "tool.group.failedMany", {
        count,
      })
    : t(count === 1 ? "tool.group.doneOne" : "tool.group.doneMany", {
        count,
      });

  useEffect(() => {
    if (running || failed) {
      manuallyExpanded.current = false;
      setShowAll(true);
    } else if (canCondense && !manuallyExpanded.current) {
      setShowAll(false);
    }
  }, [canCondense, failed, running]);

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
      {visibleTools.map((tool) => (
        <ToolRow key={tool.id} tool={tool} onReviewDiff={onReviewDiff} />
      ))}
      {canCondense && showAll && !running && !failed && (
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

  if (running) {
    return <section className="tool-group running">{toolList}</section>;
  }

  return (
    <details className={`tool-group complete${failed ? " failed" : ""}`} open={failed}>
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
}: Omit<ToolGroupProps, "tools"> & { tool: ToolCall }) {
  const hasDetails = Boolean(
    tool.output || tool.diff || tool.progress || tool.artifacts?.length,
  );
  const showArtifactByDefault = tool.artifacts?.some(
    (artifact) => artifact.type === "generatedImage",
  );
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(showArtifactByDefault),
  );
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (showArtifactByDefault) setDetailsOpen(true);
  }, [showArtifactByDefault]);
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
      className={`tool-row ${tool.status}${tool.status === "done" ? " compact" : ""}`}
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
      className={`tool-row ${tool.status}${tool.status === "done" ? " compact" : ""}`}
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
      {tool.artifacts && <ToolArtifacts artifacts={tool.artifacts} />}
    </div>
  );
}
