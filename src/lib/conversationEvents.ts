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
import { scheduledTaskFromPrompt } from "./scheduledTaskMessage";

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
        t,
      );
    case "item/reasoning/summaryPartAdded":
      return appendReasoningSeparator(
        messages,
        stringValue(params?.itemId),
        t,
      );
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
      return completeItem(messages, withCompletionTiming(item, params), t);
    default:
      return messages;
  }
}

function withCompletionTiming(
  item: AppServerItem | undefined,
  params: EventParams | undefined,
) {
  if (!item || typeof item.durationMs === "number") return item;
  const startedAtMs = numberValue(params?.startedAtMs);
  const completedAtMs = numberValue(params?.completedAtMs);
  if (startedAtMs === undefined || completedAtMs === undefined) return item;
  return {
    ...item,
    durationMs: Math.max(0, completedAtMs - startedAtMs),
  };
}

function appendAgentMessageDelta(
  messages: ChatMessage[],
  itemId: string | undefined,
  delta: string,
): ChatMessage[] {
  const index = itemId
    ? findLastIndex(
        messages,
        (message) => message.id === itemId || message.sourceItemId === itemId,
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
        ...(message.phase ? { phase: message.phase } : {}),
        revealAfter: Date.now() + closedStepRevealDelay(message.tools.length),
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
  t: Translate,
) {
  return appendReasoningDelta(messages, itemId, "\n\n", t, true);
}

function appendReasoningDelta(
  messages: ChatMessage[],
  itemId: string | undefined,
  delta: string,
  t: Translate,
  onlyAfterContent = false,
): ChatMessage[] {
  if (!itemId || !delta) return messages;
  const index = findLastIndex(messages, (message) =>
    Boolean(message.signals?.some((signal) => signal.id === itemId)),
  );
  if (index < 0) {
    if (onlyAfterContent || !delta.trim()) return messages;
    const signal = signalFromItem(
      { id: itemId, type: "reasoning", summary: [delta] },
      t,
    );
    return signal ? appendSignal(messages, signal) : messages;
  }
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
  const userMessage = userMessageFromItem(item);
  if (userMessage) return reconcileUserMessage(messages, userMessage);
  if (item?.type === "agentMessage" && item.id) {
    if (messages.some((message) => message.id === item.id)) return messages;
    const phase = messagePhase(item.phase);
    return [
      ...messages,
      {
        id: item.id,
        role: "assistant",
        content: stringValue(item.text) ?? "",
        ...(phase ? { phase } : {}),
        streaming: true,
      },
    ];
  }
  let tool = toolFromItem(item, t);
  const signal = signalFromItem(item, t);
  let next = messages;

  if (tool) {
    const toolId = tool.id;
    const existingIndex = findLastIndex(next, (message) =>
      Boolean(message.tools?.some((existing) => existing.id === toolId)),
    );
    if (existingIndex >= 0) {
      const existingMessage = next[existingIndex];
      next = replaceAt(next, existingIndex, {
        ...existingMessage,
        tools: existingMessage.tools?.map((existing) => {
          if (existing.id !== toolId || existing.status !== "running") {
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
    const description =
      last?.role === "assistant" && last.phase === "commentary"
        ? shortToolDescription(last.content)
        : undefined;
    if (description && last) {
      tool = { ...tool, description };
      next = replaceAt(next, next.length - 1, {
        ...last,
        content: "",
        streaming: false,
        tools: [...(last.tools ?? []), tool],
      });
      return signal ? appendSignal(next, signal) : next;
    }
    next = trimTrailingEmptyAssistantMessages(next);
    const toolHost = next.at(-1);
    next =
      toolHost?.role === "assistant"
        ? replaceAt(next, next.length - 1, {
            ...toolHost,
            tools: [...(toolHost.tools ?? []), tool],
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

function userMessageFromItem(
  item: AppServerItem | undefined,
): ChatMessage | undefined {
  if (item?.type !== "userMessage" || !item.id || !Array.isArray(item.content)) {
    return undefined;
  }
  const content = item.content.flatMap((entry) => {
    const value = record(entry);
    return value?.type === "text" && typeof value.text === "string"
      ? [value.text]
      : [];
  });
  const attachments = item.content.flatMap((entry) => {
    const value = record(entry);
    if (value?.type !== "localImage" || typeof value.path !== "string") return [];
    return [value.path.split("/").at(-1) ?? value.path];
  });
  const skills = item.content.flatMap((entry) => {
    const value = record(entry);
    return value?.type === "skill" && typeof value.name === "string"
      ? [{ name: value.name }]
      : [];
  });
  const text = content.filter(Boolean).join("\n");
  const scheduledTask = scheduledTaskFromPrompt(text);
  return {
    id: item.id,
    role: "user",
    content: scheduledTask?.prompt ?? text,
    ...(scheduledTask
      ? { modality: "scheduledTask" as const, title: scheduledTask.name }
      : {}),
    ...(attachments.length ? { attachments } : {}),
    ...(skills.length ? { skills } : {}),
  };
}

function reconcileUserMessage(
  messages: ChatMessage[],
  authoritative: ChatMessage,
): ChatMessage[] {
  if (messages.some((message) => message.id === authoritative.id)) {
    return messages;
  }
  return [...messages, authoritative];
}

function completeItem(
  messages: ChatMessage[],
  item: AppServerItem | undefined,
  t: Translate,
): ChatMessage[] {
  if (!item?.id) return messages;
  const userMessage = userMessageFromItem(item);
  if (userMessage) return reconcileUserMessage(messages, userMessage);
  const completedTool = toolFromItem(item, t);
  const index = findLastIndex(messages, (message) =>
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
    const completedAgentText =
      item.type === "agentMessage" &&
      !(message.phase === "commentary" &&
        message.tools?.some((tool) => tool.description))
        ? stringValue(item.text)
        : undefined;
    next = replaceAt(messages, index, {
      ...message,
      ...(message.id === item.id || message.sourceItemId === item.id
        ? {
            ...(completedAgentText ? { content: completedAgentText } : {}),
            streaming: false,
            memoryCitations: memoryCitations(item.memoryCitation),
          }
        : {}),
      ...(hasTool
        ? {
            tools: message.tools?.map((tool) =>
              tool.id === item.id
                ? mergeCompletedTool(tool, completedTool, item)
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
    stringValue(item.text)?.trim() &&
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
  if (index < 0 && item.type === "reasoning") {
    const signal = signalFromItem(item, t);
    if (signal) return appendSignal(next, completedSignal(signal, item, t));
  }
  if (index < 0 && completedTool) {
    return startItem(
      next,
      item.type === "subAgentActivity" || item.status !== undefined
        ? item
        : { ...item, status: "completed" },
      t,
    );
  }
  return next;
}

function shortToolDescription(value: string) {
  const description = value.replace(/\s+/g, " ").trim();
  return description && description.length <= 280 ? description : undefined;
}

function messagePhase(value: unknown): ChatMessage["phase"] {
  return value === "commentary" || value === "final_answer"
    ? value
    : undefined;
}

function mergeCompletedTool(
  tool: ToolCall,
  completed: ToolCall | undefined,
  item: AppServerItem,
): ToolCall {
  if (item.type === "subAgentActivity" && completed?.subagent) {
    return {
      ...tool,
      status: tool.status,
      subagent: {
        ...completed.subagent,
        ...tool.subagent,
        threadIds: [
          ...new Set([
            ...(tool.subagent?.threadIds ?? []),
            ...completed.subagent.threadIds,
          ]),
        ],
        status: tool.subagent?.status ?? completed.subagent.status,
      },
    };
  }
  return {
    ...tool,
    ...completed,
    ...(!completed?.output && tool.output ? { output: tool.output } : {}),
    ...(!completed?.diff && tool.diff ? { diff: tool.diff } : {}),
    ...(tool.progress ? { progress: tool.progress } : {}),
    // The lifecycle notification itself is authoritative. Several terminal
    // items (notably webSearch) omit a wire-level status, so the presentation
    // reconstructed above still says "running" unless completion is explicit.
    status: toolStatus(item, true),
  };
}

function trimTrailingEmptyAssistantMessages(messages: ChatMessage[]) {
  let end = messages.length;
  while (end > 0 && isEmptyAssistantMessage(messages[end - 1])) end -= 1;
  return end === messages.length ? messages : messages.slice(0, end);
}

function isEmptyAssistantMessage(message: ChatMessage) {
  return (
    message.role === "assistant" &&
    message.content.trim() === "" &&
    !message.modality &&
    !message.title &&
    !message.tools?.length &&
    !message.signals?.length &&
    !message.attachments?.length &&
    !message.skills?.length &&
    !message.memoryCitations?.length
  );
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
    (message) => message.id === itemId || message.sourceItemId === itemId,
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
  if (message.tools?.length) {
    const closed = replaceAt(messages, index, {
      ...message,
      streaming: false,
    });
    return [
      ...closed,
      {
        id: `signal-${signal.id}`,
        role: "assistant",
        content: "",
        revealAfter:
          Date.now() + closedStepRevealDelay(message.tools.length),
        signals: [signal],
      },
    ];
  }
  const signals = message.signals ?? [];
  const previousSignal = signals.at(-1);
  const mergesPreviousReasoning =
    signal.kind === "reasoning" && previousSignal?.kind === "reasoning";
  const nextSignal = mergesPreviousReasoning
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

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
