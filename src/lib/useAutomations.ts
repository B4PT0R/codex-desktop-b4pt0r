import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadSummary } from "../types";
import type {
  Automation,
  AutomationDraft,
  AutomationsController,
} from "./automations";
import type {
  AppServerThread,
  ThreadRuntimeResponse,
} from "./appServerTypes";
import { invoke, isDesktopApp, listen } from "./nativeBridge";
import { request, type AppServerMessage } from "./codex";
import { threadSummary } from "./threadSummary";
import {
  automationThreadResumeParams,
  automationThreadSecurityRestoreParams,
  automationThreadStartParams,
  automationTurnStartParams,
} from "./protocol";
import type { ThreadTurnCoordinator } from "./threadTurnCoordinator";
import {
  threadRuntimeSettings,
  threadRuntimeSettingsFromNotification,
  type ThreadRuntimeSettings,
} from "./threadRuntimeSettings";
import { threadStatusFromValue } from "./threadLifecycle";
import { ThreadSettingsConfirmation } from "./threadSettingsConfirmation";

export type {
  Automation,
  AutomationDraft,
  AutomationsController,
} from "./automations";

type DueRun = Automation & { runId: string };
type RunState = {
  automationId: string;
  runId: string;
  threadId: string;
  turnId: string;
  restoreSecurity?: Pick<
    ThreadRuntimeSettings,
    "permission" | "approvalPolicy"
  >;
};

export function useAutomations({
  connected,
  onError,
  onThreadCreated,
  turnCoordinator,
}: {
  connected: boolean;
  onError: (error: unknown) => void;
  onThreadCreated: (thread: ThreadSummary) => void;
  turnCoordinator: ThreadTurnCoordinator;
}) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const runs = useRef(new Map<string, RunState>());
  const settingsConfirmation = useRef(new ThreadSettingsConfirmation());
  const callbacks = useRef({ onError, onThreadCreated });
  callbacks.current = { onError, onThreadCreated };

  const refresh = useCallback(async () => {
    if (!isDesktopApp()) return;
    setLoading(true);
    setError(undefined);
    try {
      setAutomations(await invoke<Automation[]>("automation_list"));
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      callbacks.current.onError(cause);
    } finally {
      setLoading(false);
    }
  }, []);

  const execute = useCallback(async (run: DueRun) => {
    let thread: AppServerThread | undefined;
    let restoreSecurity: RunState["restoreSecurity"];
    try {
      let runtimeResponse: ThreadRuntimeResponse;
      if (run.target.type === "thread") {
        const response = await request<ThreadRuntimeResponse>(
          "thread/resume",
          automationThreadResumeParams(run.target.threadId),
        );
        runtimeResponse = response;
        thread = response.thread;
      } else {
        const response = await request<ThreadRuntimeResponse>(
          "thread/start",
          automationThreadStartParams(
            run.cwd,
            run.target.type === "ephemeralThread",
          ),
        );
        runtimeResponse = response;
        thread = response.thread;
        if (run.target.type === "newThread") {
          callbacks.current.onThreadCreated(threadSummary(thread));
        }
      }
      const effectiveSettings = threadRuntimeSettings(runtimeResponse);
      if (run.unattendedAccess) {
        if (
          !effectiveSettings.permission ||
          !effectiveSettings.approvalPolicy
        ) {
          throw new Error(
            "Unable to capture the thread security settings before unattended execution.",
          );
        }
        restoreSecurity = {
          permission: effectiveSettings.permission,
          approvalPolicy: effectiveSettings.approvalPolicy,
        };
      }
      const executionThreadId = thread.id;
      turnCoordinator.observeStatus(
        executionThreadId,
        threadSummary(thread).status ?? "idle",
      );
      const response = await turnCoordinator.runWhenIdle(
        executionThreadId,
        () =>
          request<{ turn: { id: string } }>(
            "turn/start",
            automationTurnStartParams(
              executionThreadId,
              run.name,
              run.prompt,
              run.unattendedAccess,
            ),
        ),
        (result) => result.turn.id,
        { manualRelease: true },
      );
      runs.current.set(response.turn.id, {
        automationId: run.id,
        runId: run.runId,
        threadId: executionThreadId,
        turnId: response.turn.id,
        restoreSecurity,
      });
      setAutomations((items) =>
        items.map((item) =>
          item.id === run.id
            ? {
                ...item,
                activeRunId: run.runId,
                lastRunAt: Date.now(),
                lastStatus: "running",
                lastThreadId: executionThreadId,
                lastError: undefined,
              }
            : item,
        ),
      );
      void response.turn.id;
    } catch (cause) {
      if (thread && restoreSecurity) {
        await restoreThreadSecurity(
          thread.id,
          restoreSecurity,
          settingsConfirmation.current,
        ).catch((error) => callbacks.current.onError(error));
      }
      await completeRun(run.id, run.runId, "failed", undefined, cause);
    }
  }, [turnCoordinator]);

  useEffect(() => {
    if (!connected || !isDesktopApp()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const cleanup = await listen<DueRun>(
          "automation-run-due",
          ({ payload }) => {
            if (!disposed) void execute(payload);
          },
        );
        if (disposed) {
          cleanup();
          return;
        }
        unlisten = cleanup;
        await invoke("automation_ready");
        if (disposed) return;
        await refresh();
      } catch (cause) {
        if (!disposed) {
          setError(errorMessage(cause));
          callbacks.current.onError(cause);
        }
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [connected, execute, refresh]);

  const save = useCallback(
    async (draft: AutomationDraft) => {
      try {
        const saved = await invoke<Automation>("automation_upsert", {
          automation: draft,
        });
        await refresh();
        return saved;
      } catch (cause) {
        setError(errorMessage(cause));
        return undefined;
      }
    },
    [refresh],
  );

  const deleteAutomation = useCallback(async (id: string) => {
    try {
      const removed = await invoke<boolean>("automation_delete", { id });
      if (removed)
        setAutomations((items) => items.filter((item) => item.id !== id));
      return removed;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }, []);

  const runNow = useCallback(async (id: string) => {
    try {
      const run = await invoke<DueRun | null>("automation_run_now", { id });
      return run !== null;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }, []);

  function handleMessage(message: AppServerMessage) {
    if (message.method === "thread/settings/updated") {
      const params = record(message.params);
      const threadId = stringValue(params?.threadId);
      const settings = threadRuntimeSettingsFromNotification(params);
      if (threadId && settings) {
        settingsConfirmation.current.observe(threadId, settings);
      }
      return false;
    }
    const systemError =
      message.method === "thread/status/changed" &&
      threadStatusFromValue(record(message.params)?.status) === "systemError";
    if (
      message.method !== "turn/completed" &&
      message.method !== "error" &&
      !systemError
    ) {
      return false;
    }
    const params = record(message.params);
    const threadId = stringValue(params?.threadId);
    if (!threadId) return false;
    const turnId =
      stringValue(record(params?.turn)?.id) ?? stringValue(params?.turnId);
    const run = turnId
      ? runs.current.get(turnId)
      : uniqueRunForThread(runs.current, threadId);
    if (!run) return false;
    const terminal =
      message.method === "turn/completed" ||
      systemError ||
      params?.willRetry !== true;
    if (!terminal) return false;
    runs.current.delete(run.turnId);
    const turnStatus = stringValue(record(params?.turn)?.status);
    const succeeded =
      message.method === "turn/completed" && turnStatus !== "failed";
    void finalizeRun(
      run,
      succeeded ? "succeeded" : "failed",
      threadId,
      params?.message ?? record(params?.turn)?.error,
    );
    return true;
  }

  async function finalizeRun(
    run: RunState,
    status: "succeeded" | "failed",
    threadId: string,
    cause?: unknown,
  ) {
    let finalStatus = status;
    let finalCause = cause;
    try {
      if (run.restoreSecurity) {
        await restoreThreadSecurity(
          threadId,
          run.restoreSecurity,
          settingsConfirmation.current,
        );
      }
    } catch (error) {
      finalStatus = "failed";
      finalCause = error;
      callbacks.current.onError(error);
    } finally {
      turnCoordinator.release(threadId, run.turnId);
    }
    await completeRun(
      run.automationId,
      run.runId,
      finalStatus,
      threadId,
      finalCause,
    );
  }

  async function completeRun(
    id: string,
    runId: string,
    status: "succeeded" | "failed",
    threadId?: string,
    cause?: unknown,
  ) {
    await invoke("automation_complete", {
      id,
      runId,
      status,
      threadId,
      error: status === "failed" ? errorMessage(cause) : undefined,
    }).catch((error) => callbacks.current.onError(error));
    await refresh();
  }

  return {
    automations,
    deleteAutomation,
    error,
    handleMessage,
    loading,
    refresh,
    runNow,
    save,
  };
}

async function restoreThreadSecurity(
  threadId: string,
  settings: Pick<ThreadRuntimeSettings, "permission" | "approvalPolicy">,
  confirmation: ThreadSettingsConfirmation,
) {
  if (!settings.permission || !settings.approvalPolicy) return;
  const permission = settings.permission;
  const approvalPolicy = settings.approvalPolicy;
  await confirmation.updateAndWait(
    threadId,
    { permission, approvalPolicy },
    () =>
      request(
        "thread/settings/update",
        automationThreadSecurityRestoreParams(
          threadId,
          permission,
          approvalPolicy,
        ),
      ),
  );
}

function errorMessage(error: unknown) {
  if (error === undefined || error === null) return "Scheduled task failed";
  const message = record(error)?.message;
  if (typeof message === "string") return message;
  return error instanceof Error ? error.message : String(error);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function uniqueRunForThread(runs: Map<string, RunState>, threadId: string) {
  const matches = [...runs.values()].filter((run) => run.threadId === threadId);
  return matches.length === 1 ? matches[0] : undefined;
}
