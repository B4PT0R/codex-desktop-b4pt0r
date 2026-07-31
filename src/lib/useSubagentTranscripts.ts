import { useCallback, useEffect, useRef, useState } from "react";
import type { Translate } from "../i18n/translate";
import type {
  AppServerThread,
  ThreadListResponse,
  ThreadReadResponse,
} from "./appServerTypes";
import type { AppServerMessage } from "./codex";
import { request } from "./codex";
import type { SubagentStatus, SubagentTranscript } from "../types";
import { applyConversationEvent } from "./conversationEvents";
import {
  subagentDescendantsListParams,
  threadReadWithTurnsParams,
} from "./protocol";
import { messagesFromThread } from "./threadPresentation";

const FLUSH_MS = 16;
const MAX_TRACKED_SUBAGENTS = 80;
const MAX_TRANSCRIPT_MESSAGES = 250;

type SubagentTranscriptMap = Record<string, SubagentTranscript>;

type SubagentTranscriptsOptions = {
  enabled: boolean;
  parentThreadId?: string;
  translate: Translate;
};

export function useSubagentTranscripts({
  enabled,
  parentThreadId,
  translate,
}: SubagentTranscriptsOptions) {
  const [transcripts, setTranscripts] = useState<SubagentTranscriptMap>({});
  const [error, setError] = useState<string>();
  const tracked = useRef(new Set<string>());
  const pending = useRef<AppServerMessage[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const hydrationGeneration = useRef(0);
  const translateRef = useRef(translate);
  translateRef.current = translate;

  const flush = useCallback(() => {
    timer.current = undefined;
    const events = pending.current;
    pending.current = [];
    if (events.length === 0) return;
    setTranscripts((current) =>
      events.reduce(
        (next, event) => applyChildEvent(next, event, translateRef.current),
        current,
      ),
    );
  }, []);

  const schedule = useCallback(() => {
    if (timer.current === undefined)
      timer.current = window.setTimeout(flush, FLUSH_MS);
  }, [flush]);

  const handleMessage = useCallback(
    (message: AppServerMessage) => {
      const params = record(message.params);
      const item = record(params?.item);
      const eventThreadId = stringValue(params?.threadId);
      const children =
        eventThreadId === parentThreadId ? childReferences(item) : [];
      for (const child of children) {
        tracked.current.add(child.threadId);
      }
      const removed = trimTracked(tracked.current);
      if (children.length > 0) {
        setTranscripts((current) => {
          const next = { ...current };
          for (const threadId of removed) delete next[threadId];
          for (const child of children) {
            const previous = next[child.threadId] ?? {
              messages: [],
              status: "pending" as const,
            };
            next[child.threadId] = { ...previous, ...child.metadata };
          }
          return next;
        });
      }

      if (!eventThreadId || !tracked.current.has(eventThreadId)) return;
      pending.current.push(message);
      schedule();
    },
    [parentThreadId, schedule],
  );

  useEffect(() => {
    const generation = ++hydrationGeneration.current;
    tracked.current.clear();
    pending.current = [];
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    setTranscripts({});
    setError(undefined);
    if (!enabled || !parentThreadId) return;
    void hydrateDescendants(parentThreadId, translateRef.current)
      .then(({ error: hydrationError, transcripts: loaded }) => {
        if (hydrationGeneration.current !== generation) return;
        for (const threadId of Object.keys(loaded)) tracked.current.add(threadId);
        trimTracked(tracked.current);
        setTranscripts((current) => mergeHydratedTranscripts(loaded, current));
        setError(hydrationError);
      })
      .catch((cause) => {
        if (hydrationGeneration.current === generation)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, [enabled, parentThreadId]);

  useEffect(
    () => () => {
      hydrationGeneration.current += 1;
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  return { error, handleMessage, transcripts };
}

async function hydrateDescendants(parentThreadId: string, t: Translate) {
  const listed = await request<ThreadListResponse>(
    "thread/list",
    subagentDescendantsListParams(parentThreadId),
  );
  const threads = (listed.data ?? []).slice(0, MAX_TRACKED_SUBAGENTS);
  const loaded = await mapWithConcurrency(threads, 6, async (summary) => {
    try {
      const response = await request<ThreadReadResponse>("thread/read", {
        ...threadReadWithTurnsParams(summary.id),
      });
      return [summary.id, transcriptFromThread(response.thread, t)] as const;
    } catch {
      return undefined;
    }
  });
  const available = loaded.filter((entry) => entry !== undefined);
  const failed = loaded.length - available.length;
  return {
    error:
      failed > 0
        ? t("tool.subagent.replayPartial", { count: failed })
        : undefined,
    transcripts: Object.fromEntries(available) as SubagentTranscriptMap,
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  map: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await map(values[index]);
      }
    }),
  );
  return results;
}

function transcriptFromThread(thread: AppServerThread, t: Translate) {
  return {
    messages: messagesFromThread(thread, t).slice(-MAX_TRANSCRIPT_MESSAGES),
    status: statusFromThread(thread),
    ...(thread.agentNickname ? { name: thread.agentNickname } : {}),
    ...(thread.agentRole ? { role: thread.agentRole } : {}),
  } satisfies SubagentTranscript;
}

function applyChildEvent(
  transcripts: SubagentTranscriptMap,
  message: AppServerMessage,
  t: Translate,
) {
  const params = record(message.params);
  const threadId = stringValue(params?.threadId);
  if (!threadId) return transcripts;
  const previous = transcripts[threadId] ?? {
    messages: [],
    status: "pending" as const,
  };
  const nextMessages = applyConversationEvent(previous.messages, message, t);
  const status = statusFromMessage(message) ?? previous.status;
  const next: SubagentTranscript = {
    ...previous,
    messages: nextMessages.slice(-MAX_TRANSCRIPT_MESSAGES),
    status,
  };
  return { ...transcripts, [threadId]: next };
}

function childReferences(item: Record<string, unknown> | undefined) {
  if (item?.type === "subAgentActivity") {
    const threadId = stringValue(item.agentThreadId);
    if (!threadId) return [];
    return [
      {
        threadId,
        metadata: {
          path: boundedString(item.agentPath, 2_048),
          status:
            item.kind === "interrupted"
              ? ("interrupted" as const)
              : ("running" as const),
        },
      },
    ];
  }
  if (item?.type !== "collabAgentToolCall") return [];
  return stringArray(item.receiverThreadIds).map((threadId) => ({
    threadId,
    metadata: { status: statusFromAgentState(item.agentsStates, threadId) },
  }));
}

function statusFromMessage(
  message: AppServerMessage,
): SubagentStatus | undefined {
  if (message.method === "turn/started") return "running";
  if (message.method === "error") return "error";
  if (message.method === "turn/completed") {
    const status = stringValue(record(record(message.params)?.turn)?.status);
    if (status === "failed") return "error";
    if (status === "interrupted") return "interrupted";
    return "completed";
  }
  if (message.method === "thread/status/changed") {
    const type = stringValue(record(record(message.params)?.status)?.type);
    if (type === "active") return "running";
    if (type === "systemError") return "error";
    if (type === "idle") return "completed";
  }
  return undefined;
}

function statusFromThread(thread: AppServerThread): SubagentStatus {
  const type = stringValue(record(thread.status)?.type);
  if (type === "active") return "running";
  if (type === "systemError") return "error";
  return "completed";
}

function statusFromAgentState(value: unknown, threadId: string) {
  const status = stringValue(record(record(value)?.[threadId])?.status);
  if (status === "running") return "running" as const;
  if (status === "pendingInit") return "pending" as const;
  if (status === "interrupted") return "interrupted" as const;
  if (status === "completed" || status === "shutdown")
    return "completed" as const;
  if (status === "errored" || status === "notFound") return "error" as const;
  return "pending" as const;
}

function trimTracked(tracked: Set<string>) {
  const removed: string[] = [];
  while (tracked.size > MAX_TRACKED_SUBAGENTS) {
    const oldest = tracked.values().next().value;
    if (!oldest) break;
    tracked.delete(oldest);
    removed.push(oldest);
  }
  return removed;
}

function mergeHydratedTranscripts(
  hydrated: SubagentTranscriptMap,
  live: SubagentTranscriptMap,
) {
  const merged = { ...hydrated };
  for (const [threadId, current] of Object.entries(live)) {
    const replay = hydrated[threadId];
    if (!replay) {
      merged[threadId] = current;
      continue;
    }
    const messages = new Map(
      replay.messages.map((message) => [message.id, message]),
    );
    for (const message of current.messages) messages.set(message.id, message);
    merged[threadId] = {
      ...replay,
      ...current,
      messages: [...messages.values()].slice(-MAX_TRANSCRIPT_MESSAGES),
      name: current.name ?? replay.name,
      role: current.role ?? replay.role,
      path: current.path ?? replay.path,
    };
  }
  return merged;
}

function boundedString(value: unknown, limit: number) {
  return typeof value === "string" && value.length <= limit ? value : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
