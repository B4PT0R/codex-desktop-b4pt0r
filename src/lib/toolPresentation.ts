import type { ToolArtifact, ToolCall } from "../types";
import { defaultTranslate, type Translate } from "../i18n/translate";

type ToolKind = ToolCall["kind"];

const toolTypes = new Set<ToolKind>([
  "commandExecution",
  "fileChange",
  "mcpToolCall",
  "dynamicToolCall",
  "collabAgentToolCall",
  "webSearch",
  "imageView",
  "sleep",
  "imageGeneration",
]);

export function toolFromItem(
  item: unknown,
  t: Translate = defaultTranslate,
): ToolCall | undefined {
  const value = record(item);
  const id = stringValue(value?.id);
  const type = stringValue(value?.type);
  if (!value || !id || !type || !isToolKind(type)) return undefined;
  const [title, detail] = presentation(type, value, t);
  return {
    id,
    kind: type,
    title,
    detail,
    status: status(value.status),
    ...finalDetails(type, value, t),
  };
}

export function appendToolOutput(
  current: string | undefined,
  delta: string,
  t: Translate = defaultTranslate,
) {
  return boundedText(
    (current ?? "") + delta,
    50_000,
    t("tool.details.output"),
    t,
  );
}

export function patchDetails(
  changes: unknown,
  t: Translate = defaultTranslate,
): Pick<ToolCall, "detail"> & Partial<Pick<ToolCall, "diff">> {
  if (!Array.isArray(changes)) return { detail: t("tool.patch.preparing") };
  const diffs = changes.flatMap((change) => {
    const value = record(change);
    const diff = stringValue(value?.diff);
    return diff ? [diff] : [];
  });
  return {
    detail: summarizeFiles(changes, t),
    ...(diffs.length > 0
      ? { diff: boundedText(diffs.join("\n"), 100_000, t("work.diff"), t) }
      : {}),
  };
}

export function toolStatus(
  item: unknown,
  completed = false,
): ToolCall["status"] {
  const value = record(item);
  return value?.status !== undefined
    ? status(value.status)
    : completed
      ? "done"
      : "running";
}

function status(value: unknown): ToolCall["status"] {
  if (value === "failed" || value === "declined") return "error";
  if (value === "completed") return "done";
  return "running";
}

function presentation(
  type: ToolKind,
  item: Record<string, unknown>,
  t: Translate,
): [string, string] {
  switch (type) {
    case "commandExecution":
      return [
        t("tool.command"),
        stringValue(item.command) ?? t("tool.command.running"),
      ];
    case "fileChange":
      return [t("tool.files"), summarizeFiles(item.changes, t)];
    case "mcpToolCall": {
      const appContext = record(item.appContext);
      return [
        stringValue(appContext?.actionName) ??
          stringValue(item.tool) ??
          t("tool.mcp"),
        t("tool.mcp.detail", {
          server:
            stringValue(appContext?.appName) ??
            stringValue(item.server) ??
            t("tool.unknownServer"),
        }),
      ];
    }
    case "dynamicToolCall": {
      const namespace = stringValue(item.namespace);
      return [
        stringValue(item.tool) ?? t("tool.dynamic"),
        namespace ? t("tool.dynamic.detail", { namespace }) : t("tool.dynamic"),
      ];
    }
    case "collabAgentToolCall":
      return [
        collabLabel(stringValue(item.tool), t),
        stringValue(item.prompt) ??
          t("tool.collab.agents", {
            count: arrayLength(item.receiverThreadIds),
          }),
      ];
    case "webSearch":
      return [
        t("tool.web"),
        stringValue(item.query) ??
          stringValue(record(item.action)?.query) ??
          t("tool.web.running"),
      ];
    case "imageView":
      return [
        t("tool.imageView"),
        stringValue(item.path) ?? t("tool.imageView.running"),
      ];
    case "sleep":
      return [t("tool.sleep"), formatDuration(numberValue(item.durationMs), t)];
    case "imageGeneration":
      return [
        t("tool.imageGeneration"),
        stringValue(item.revisedPrompt) ??
          stringValue(item.prompt) ??
          t("tool.imageGeneration.running"),
      ];
    default:
      return [t("tool.generic"), type];
  }
}

function finalDetails(
  type: ToolKind,
  item: Record<string, unknown>,
  t: Translate,
) {
  if (type === "commandExecution") {
    return {
      ...(stringValue(item.aggregatedOutput)
        ? {
            output: boundedText(
              stringValue(item.aggregatedOutput)!,
              50_000,
              t("tool.details.output"),
              t,
            ),
          }
        : {}),
      ...(numberValue(item.exitCode, true) !== undefined
        ? { exitCode: numberValue(item.exitCode, true) }
        : {}),
      ...(numberValue(item.durationMs) !== undefined
        ? { durationMs: numberValue(item.durationMs) }
        : {}),
    };
  }
  if (type === "fileChange") return patchDetails(item.changes, t);
  const artifacts = richArtifacts(type, item);
  return artifacts.length ? { artifacts } : {};
}

function richArtifacts(
  type: ToolKind,
  item: Record<string, unknown>,
): ToolArtifact[] {
  if (type === "imageGeneration") {
    const dataUrl = imageDataUrl(stringValue(item.result));
    const path = boundedString(item.savedPath, 4096);
    if (!dataUrl && !path) return [];
    return [
      {
        type: "generatedImage",
        ...(dataUrl ? { dataUrl } : {}),
        ...(path ? { path } : {}),
        ...(boundedString(item.revisedPrompt, 2_000)
          ? { prompt: boundedString(item.revisedPrompt, 2_000) }
          : {}),
      },
    ];
  }
  if (type !== "webSearch") return [];
  const results = Array.isArray(item.results) ? item.results.slice(0, 8) : [];
  const artifacts = results.flatMap(webResult);
  if (artifacts.length) return artifacts;
  const action = record(item.action);
  const url = safeUrl(action?.url);
  return url
    ? [{ type: "webResult", title: url, url } satisfies ToolArtifact]
    : [];
}

function webResult(value: unknown): ToolArtifact[] {
  const result = record(value);
  if (result?.type !== "text_result") return [];
  const url = safeUrl(result.url);
  if (!url) return [];
  return [
    {
      type: "webResult",
      title: boundedString(result.title, 300) ?? url,
      url,
      ...(boundedString(result.snippet, 1_000)
        ? { snippet: boundedString(result.snippet, 1_000) }
        : {}),
    },
  ];
}

function imageDataUrl(result: string | undefined) {
  if (!result || result.length > 20_000_000) return undefined;
  if (result.startsWith("data:image/"))
    return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=\s]+$/.test(
      result,
    )
      ? result
      : undefined;
  if (!/^[a-zA-Z0-9+/=\s]+$/.test(result)) return undefined;
  const mime = result.startsWith("/9j/")
    ? "image/jpeg"
    : result.startsWith("UklGR")
      ? "image/webp"
      : result.startsWith("R0lGOD")
        ? "image/gif"
        : "image/png";
  return `data:${mime};base64,${result}`;
}

function safeUrl(value: unknown) {
  const candidate = boundedString(value, 2_048);
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function boundedString(value: unknown, limit: number) {
  return typeof value === "string" && value.length > 0 && value.length <= limit
    ? value
    : undefined;
}

function boundedText(
  value: string,
  limit: number,
  label: string,
  t: Translate,
) {
  if (value.length <= limit) return value;
  return `${t("tool.truncated", { label: label.toLocaleLowerCase() })}\n${value.slice(-limit)}`;
}

function isToolKind(value: string): value is ToolKind {
  return toolTypes.has(value as ToolKind);
}

function summarizeFiles(value: unknown, t: Translate) {
  if (!Array.isArray(value) || value.length === 0)
    return t("tool.patch.preparing");
  const paths = value.flatMap((change) => {
    const path = stringValue(record(change)?.path);
    return path ? [path] : [];
  });
  if (paths.length === 0) return t("tool.patch.preparing");
  return paths.length === 1
    ? paths[0]
    : t("tool.patch.files", { count: paths.length });
}

function formatDuration(milliseconds: number | undefined, t: Translate) {
  if (milliseconds === undefined) return t("tool.duration.running");
  return milliseconds < 1000
    ? `${milliseconds} ms`
    : `${Math.round(milliseconds / 100) / 10} s`;
}

function collabLabel(tool: string | undefined, t: Translate) {
  const labels: Record<string, ReturnType<Translate>> = {
    spawnAgent: t("tool.collab.spawn"),
    sendInput: t("tool.collab.send"),
    resumeAgent: t("tool.collab.resume"),
    wait: t("tool.collab.wait"),
    closeAgent: t("tool.collab.close"),
  };
  return labels[tool ?? ""] ?? t("tool.collab");
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown, signed = false): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    (signed || value >= 0)
    ? value
    : undefined;
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}
