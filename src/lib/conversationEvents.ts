import type { AppServerMessage } from "./codex";
import {
  completedSignal,
  signalFromItem,
  signalFromNotification,
} from "./signalPresentation";
import {
  appendToolOutput,
  patchDetails,
  toolFromItem,
  toolStatus,
} from "./toolPresentation";
import type { AgentSignal, ChatMessage, ToolCall } from "../types";
import { defaultTranslate, type Translate } from "../i18n/translate";
import { closedStepRevealDelay } from "./toolActivityTiming";

type EventParams = Record<string, unknown>;
type AppServerItem = Record<string, unknown> & { id?: string; type?: string };

/** Applies an App Server notification to the visible conversation, when relevant. */
export function applyConversationEvent(
  messages: ChatMessage[],
  message: AppServerMessage,
  t: Translate = defaultTranslate,
): ChatMessage[] {
  const params = record(message.params);
  const item = appServerItem(params?.item);
  const notificationSignal = signalFromNotification(message, t);

  if (notificationSignal) return appendSignal(messages, notificationSignal);

  switch (message.method) {
    case "item/agentMessage/delta":
      return appendAgentMessageDelta(
        messages,
        stringValue(params?.itemId),
        stringValue(params?.delta) ?? "",
      );
    case "item/reasoning/summaryTextDelta":
      return appendReasoningDelta(
        messages,
        stringValue(params?.itemId),
        stringValue(params?.delta) ?? "",
      );
    case "item/reasoning/summaryPartAdded":
      return appendReasoningSeparator(messages, stringValue(params?.itemId));
    case "item/commandExecution/outputDelta":
      return updateTool(messages, stringValue(params?.itemId), (tool) => ({
        ...tool,
        output: appendToolOutput(
          tool.output,
          stringValue(params?.delta) ?? "",
          t,
        ),
      }));
    case "item/commandExecution/terminalInteraction":
      return updateTool(messages, stringValue(params?.itemId), (tool) => ({
        ...tool,
        output: appendToolOutput(
          tool.output,
          `\n$ ${stringValue(params?.stdin) ?? ""}`,
          t,
        ),
      }));
    case "item/fileChange/patchUpdated":
      return updateTool(messages, stringValue(params?.itemId), (tool) => ({
        ...tool,
        ...patchDetails(params?.changes, t),
      }));
    case "item/mcpToolCall/progress":
      return updateTool(messages, stringValue(params?.itemId), (tool) => ({
        ...tool,
        progress: stringValue(params?.message) ?? tool.progress,
      }));
    case "turn/diff/updated":
      return updateLatestTool(messages, "fileChange", (tool) => ({
        ...tool,
        diff:
          patchDetails([{ diff: stringValue(params?.diff) }], t).diff ??
          tool.diff,
      }));
    case "item/started":
      return startItem(messages, item, t);
    case "item/completed":
      return completeItem(messages, item, t);
    default:
      return messages;
  }
}

function appendAgentMessageDelta(
  messages: ChatMessage[],
  itemId: string | undefined,
  delta: string,
): ChatMessage[] {
  const index = itemId
    ? findLastIndex(
        messages,
        (message) =>
          message.id === itemId || message.sourceItemId === itemId,
      )
    : -1;
  if (index < 0) {
    return [
      ...messages,
      {
        id: itemId ?? crypto.randomUUID(),
        role: "assistant",
        content: delta,
        streaming: true,
      },
    ];
  }
  const message = messages[index];
  if (message.tools?.length) {
    const closed = replaceAt(messages, index, {
      ...message,
      streaming: false,
    });
    return [
      ...closed,
      {
        id: `${itemId ?? message.id}-continuation-${countMessageSegments(
          messages,
          itemId ?? message.id,
        )}`,
        sourceItemId: itemId ?? message.sourceItemId ?? message.id,
        revealAfter:
          Date.now() + closedStepRevealDelay(message.tools.length),
        role: "assistant",
        content: delta,
        streaming: true,
      },
    ];
  }
  return replaceAt(messages, index, {
    ...message,
    content: message.content + delta,
    streaming: true,
  });
}

function appendReasoningSeparator(
  messages: ChatMessage[],
  itemId: string | undefined,
) {
  return appendReasoningDelta(messages, itemId, "\n\n", true);
}

function appendReasoningDelta(
  messages: ChatMessage[],
  itemId: string | undefined,
  delta: string,
  onlyAfterContent = false,
): ChatMessage[] {
  if (!itemId || !delta) return messages;
  const index = findLastIndex(messages, (message) =>
    Boolean(message.signals?.some((signal) => signal.id === itemId)),
  );
  if (index < 0) return messages;
  const message = messages[index];
  return replaceAt(messages, index, {
    ...message,
    signals: message.signals?.map((signal) =>
      signal.id === itemId
        ? {
            ...signal,
            detail:
              onlyAfterContent && !signal.detail?.trim()
                ? signal.detail
                : `${signal.detail ?? ""}${delta}`,
          }
        : signal,
    ),
  });
}

function startItem(
  messages: ChatMessage[],
  item: AppServerItem | undefined,
  t: Translate,
): ChatMessage[] {
  const tool = toolFromItem(item, t);
  const signal = signalFromItem(item, t);
  let next = messages;

  if (tool) {
    const existingIndex = findLastIndex(next, (message) =>
      Boolean(message.tools?.some((existing) => existing.id === tool.id)),
    );
    if (existingIndex >= 0) {
      const existingMessage = next[existingIndex];
      next = replaceAt(next, existingIndex, {
        ...existingMessage,
        tools: existingMessage.tools?.map((existing) => {
          if (existing.id !== tool.id || existing.status !== "running") {
            return existing;
          }
          return {
            ...existing,
            ...tool,
            ...(existing.output ? { output: existing.output } : {}),
            ...(existing.diff ? { diff: existing.diff } : {}),
            ...(existing.progress ? { progress: existing.progress } : {}),
          };
        }),
      });
      return signal ? appendSignal(next, signal) : next;
    }
    const last = next.at(-1);
    next =
      last?.role === "assistant"
        ? replaceAt(next, next.length - 1, {
            ...last,
            tools: [...(last.tools ?? []), tool],
          })
        : [
            ...next,
            {
              id: `tools-${tool.id}`,
              role: "assistant",
              content: "",
              tools: [tool],
            },
          ];
  }
  return signal ? appendSignal(next, signal) : next;
}

function completeItem(
  messages: ChatMessage[],
  item: AppServerItem | undefined,
  t: Translate,
): ChatMessage[] {
  if (!item?.id) return messages;
  const completedTool = toolFromItem(item, t);
  const index = findLastIndex(
    messages,
    (message) =>
      Boolean(
        message.id === item.id ||
          message.sourceItemId === item.id ||
          message.tools?.some((tool) => tool.id === item.id) ||
          message.signals?.some((signal) => signal.id === item.id),
      ),
  );
  let next = messages;
  if (index >= 0) {
    const message = messages[index];
    const hasTool = message.tools?.some((tool) => tool.id === item.id);
    const hasSignal = message.signals?.some((signal) => signal.id === item.id);
    next = replaceAt(messages, index, {
      ...message,
      ...(message.id === item.id || message.sourceItemId === item.id
        ? {
            streaming: false,
            memoryCitations: memoryCitations(item.memoryCitation),
          }
        : {}),
      ...(hasTool
        ? {
            tools: message.tools?.map((tool) =>
              tool.id === item.id
                ? {
                    ...tool,
                    ...completedTool,
                    ...(!completedTool?.output && tool.output
                      ? { output: tool.output }
                      : {}),
                    ...(!completedTool?.diff && tool.diff
                      ? { diff: tool.diff }
                      : {}),
                    ...(tool.progress ? { progress: tool.progress } : {}),
                    status: toolStatus(item, true),
                  }
                : tool,
            ),
          }
        : {}),
      ...(hasSignal
        ? {
            signals: message.signals?.map((signal) =>
              signal.id === item.id ? completedSignal(signal, item, t) : signal,
            ),
          }
        : {}),
    });
  }
  if (
    item.type === "agentMessage" &&
    !next.some((message) => message.id === item.id)
  ) {
    next = [
      ...next,
      {
        id: item.id,
        role: "assistant",
        content: stringValue(item.text) ?? "",
        memoryCitations: memoryCitations(item.memoryCitation),
      },
    ];
  }
  return next;
}

function memoryCitations(value: unknown): ChatMessage["memoryCitations"] {
  const citation = record(value);
  if (!Array.isArray(citation?.entries)) return undefined;
  const entries = citation.entries.flatMap((candidate) => {
    const entry = record(candidate);
    const path = stringValue(entry?.path);
    const note = stringValue(entry?.note) ?? "";
    const lineStart = boundedLine(entry?.lineStart);
    const lineEnd = boundedLine(entry?.lineEnd);
    return path && lineStart && lineEnd && lineEnd >= lineStart
      ? [{ path, note, lineStart, lineEnd }]
      : [];
  });
  return entries.length > 0 ? entries : undefined;
}

function boundedLine(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 10_000_000
    ? value
    : undefined;
}

function countMessageSegments(messages: ChatMessage[], itemId: string) {
  return messages.filter(
    (message) =>
      message.id === itemId || message.sourceItemId === itemId,
  ).length;
}

function updateTool(
  messages: ChatMessage[],
  itemId: string | undefined,
  update: (tool: ToolCall) => ToolCall,
) {
  if (!itemId) return messages;
  const index = findLastIndex(messages, (message) =>
    Boolean(message.tools?.some((tool) => tool.id === itemId)),
  );
  if (index < 0) return messages;
  const message = messages[index];
  return replaceAt(messages, index, {
    ...message,
    tools: message.tools?.map((tool) =>
      tool.id === itemId ? update(tool) : tool,
    ),
  });
}

function updateLatestTool(
  messages: ChatMessage[],
  kind: ToolCall["kind"],
  update: (tool: ToolCall) => ToolCall,
) {
  let targetId: string | undefined;
  for (let index = messages.length - 1; index >= 0 && !targetId; index--) {
    const tools = messages[index].tools;
    if (!tools) continue;
    for (let toolIndex = tools.length - 1; toolIndex >= 0; toolIndex--) {
      if (tools[toolIndex].kind === kind) {
        targetId = tools[toolIndex].id;
        break;
      }
    }
  }
  return updateTool(messages, targetId, update);
}

function appendSignal(
  messages: ChatMessage[],
  signal: AgentSignal,
): ChatMessage[] {
  const existingIndex = findLastIndex(messages, (message) =>
    Boolean(message.signals?.some((existing) => existing.id === signal.id)),
  );
  if (existingIndex >= 0) {
    const existingMessage = messages[existingIndex];
    return replaceAt(messages, existingIndex, {
      ...existingMessage,
      signals: existingMessage.signals?.map((existing) =>
        existing.id === signal.id ? signal : existing,
      ),
    });
  }
  let index = -1;
  for (
    let currentIndex = messages.length - 1;
    currentIndex >= 0;
    currentIndex--
  ) {
    if (messages[currentIndex].role === "assistant") {
      index = currentIndex;
      break;
    }
  }
  if (index < 0) {
    return [
      ...messages,
      {
        id: `signal-${signal.id}`,
        role: "assistant",
        content: "",
        signals: [signal],
      },
    ];
  }
  const message = messages[index];
  const signals = message.signals ?? [];
  const previousSignal = signals.at(-1);
  const mergesPreviousReasoning =
    signal.kind === "reasoning" && previousSignal?.kind === "reasoning";
  const nextSignal =
    mergesPreviousReasoning
      ? mergeReasoningSignals(previousSignal, signal)
      : signal;
  return replaceAt(messages, index, {
    ...message,
    signals: [
      ...signals.filter(
        (existing) =>
          existing.id !== signal.id &&
          !(mergesPreviousReasoning && existing.id === previousSignal.id),
      ),
      nextSignal,
    ],
  });
}

function mergeReasoningSignals(previous: AgentSignal, signal: AgentSignal) {
  const details = [previous.detail, signal.detail].filter(
    (detail): detail is string => Boolean(detail),
  );
  return details.length > 0
    ? { ...signal, detail: details.join("\n\n") }
    : signal;
}

function findLastIndex<T>(items: T[], matches: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (matches(items[index])) return index;
  }
  return -1;
}

function replaceAt<T>(items: T[], index: number, value: T) {
  const next = items.slice();
  next[index] = value;
  return next;
}

function record(value: unknown): EventParams | undefined {
  return value !== null && typeof value === "object"
    ? (value as EventParams)
    : undefined;
}

function appServerItem(value: unknown): AppServerItem | undefined {
  return record(value) as AppServerItem | undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
