import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ThreadGoal,
  ThreadGoalGetResponse,
  ThreadGoalSetResponse,
} from "./appServerTypes";
import { request, subscribeAppServerMessages } from "./codex";
import {
  threadGoalClearParams,
  threadGoalGetParams,
  threadGoalSaveParams,
  threadGoalStatusParams,
} from "./protocol";

export function useThreadGoal(connected: boolean, threadId?: string) {
  const [goal, setGoal] = useState<ThreadGoal | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const mutationInFlight = useRef(false);
  const activeThread = useRef(threadId);
  activeThread.current = threadId;

  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!connected || !threadId) {
      setGoal(null);
      setError(undefined);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const response = await request<ThreadGoalGetResponse>(
        "thread/goal/get",
        threadGoalGetParams(threadId),
      );
      if (version === generation.current) setGoal(normalizeGoal(response.goal));
    } catch (cause) {
      if (version === generation.current) setError(errorMessage(cause));
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [connected, threadId]);

  useEffect(() => {
    setGoal(null);
    setError(undefined);
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);

  useEffect(
    () =>
      subscribeAppServerMessages((message) => {
        const params = record(message.params);
        if (params?.threadId !== activeThread.current) return;
        if (message.method === "thread/goal/cleared") setGoal(null);
        if (message.method === "thread/goal/updated") {
          const nextGoal = normalizeGoal(params?.goal);
          if (nextGoal) setGoal(nextGoal);
        }
      }),
    [],
  );

  const mutate = useCallback(
    async (method: string, params: unknown) => {
      if (!threadId || mutationInFlight.current) return false;
      const target = threadId;
      mutationInFlight.current = true;
      setSaving(true);
      setError(undefined);
      try {
        const response = await request<ThreadGoalSetResponse>(method, params);
        if (activeThread.current !== target) return false;
        const nextGoal = normalizeGoal(response.goal);
        if (!nextGoal) throw new Error("Invalid thread goal returned by App Server");
        setGoal(nextGoal);
        return true;
      } catch (cause) {
        if (activeThread.current === target) setError(errorMessage(cause));
        return false;
      } finally {
        mutationInFlight.current = false;
        if (activeThread.current === target) setSaving(false);
      }
    },
    [threadId],
  );

  const save = useCallback(
    (objective: string, tokenBudget: number | null) =>
      threadId
        ? mutate(
            "thread/goal/set",
            threadGoalSaveParams(threadId, objective, tokenBudget),
          )
        : Promise.resolve(false),
    [mutate, threadId],
  );
  const setPaused = useCallback(
    (paused: boolean) =>
      threadId
        ? mutate(
            "thread/goal/set",
            threadGoalStatusParams(threadId, paused ? "paused" : "active"),
          )
        : Promise.resolve(false),
    [mutate, threadId],
  );
  const clear = useCallback(async () => {
    if (!threadId || mutationInFlight.current) return false;
    const target = threadId;
    mutationInFlight.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await request("thread/goal/clear", threadGoalClearParams(threadId));
      if (activeThread.current !== target) return false;
      setGoal(null);
      return true;
    } catch (cause) {
      if (activeThread.current === target) setError(errorMessage(cause));
      return false;
    } finally {
      mutationInFlight.current = false;
      if (activeThread.current === target) setSaving(false);
    }
  }, [threadId]);

  return { clear, error, goal, loading, refresh, save, saving, setPaused };
}

function normalizeGoal(value: unknown): ThreadGoal | null {
  const goal = record(value);
  if (
    typeof goal?.threadId !== "string" ||
    typeof goal.objective !== "string" ||
    typeof goal.status !== "string" ||
    !goalStatuses.has(goal.status) ||
    !safeNonNegative(goal.tokensUsed) ||
    !safeNonNegative(goal.timeUsedSeconds) ||
    !safeNonNegative(goal.createdAt) ||
    !safeNonNegative(goal.updatedAt) ||
    goal.objective.length > 10_000
  )
    return null;
  const tokenBudget = goal.tokenBudget;
  if (tokenBudget !== null && !safePositive(tokenBudget)) return null;
  return {
    threadId: goal.threadId.slice(0, 512),
    objective: goal.objective,
    status: goal.status as ThreadGoal["status"],
    tokenBudget,
    tokensUsed: goal.tokensUsed,
    timeUsedSeconds: goal.timeUsedSeconds,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

const goalStatuses = new Set([
  "active",
  "paused",
  "blocked",
  "usageLimited",
  "budgetLimited",
  "complete",
]);

function safeNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function safePositive(value: unknown): value is number {
  return safeNonNegative(value) && value > 0;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
