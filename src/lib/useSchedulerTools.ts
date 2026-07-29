import { useCallback, useRef, useState } from "react";
import { respond, type AppServerMessage } from "./codex";
import type { Automation, AutomationsController } from "./automations";
import {
  automationDraftFromCreate,
  automationDraftFromUpdate,
  dynamicToolFailure,
  dynamicToolSuccess,
  schedulerToolCallFromMessage,
  type SchedulerToolCall,
} from "./schedulerTools";

export type SchedulerDeleteConfirmation = {
  requestId: number | string;
  task: Automation;
};

export function useSchedulerTools({
  automations,
  onError,
}: {
  automations: AutomationsController;
  onError: (error: unknown) => void;
}) {
  const [confirmation, setConfirmation] =
    useState<SchedulerDeleteConfirmation>();
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef<SchedulerToolCall | undefined>(undefined);
  const busy = useRef(false);

  const answer = useCallback(
    async (requestId: number | string, result: unknown) => {
      try {
        await respond(requestId, result);
      } catch (error) {
        onError(error);
      }
    },
    [onError],
  );

  const execute = useCallback(
    async (call: SchedulerToolCall) => {
      try {
        let result: unknown;
        switch (call.tool) {
          case "list":
            result = automations.automations;
            break;
          case "create": {
            const saved = await automations.save(
              automationDraftFromCreate(call.arguments, call.threadId),
            );
            if (!saved) throw new Error("The scheduled task was not created.");
            result = saved;
            break;
          }
          case "update": {
            const current = findTask(automations, call.arguments.id);
            const saved = await automations.save(
              automationDraftFromUpdate(
                current,
                call.arguments,
                call.threadId,
              ),
            );
            if (!saved) throw new Error("The scheduled task was not updated.");
            result = saved;
            break;
          }
          case "set_enabled": {
            const current = findTask(automations, call.arguments.id);
            if (typeof call.arguments.enabled !== "boolean") {
              throw new Error("enabled must be a boolean.");
            }
            const saved = await automations.save({
              id: current.id,
              name: current.name,
              prompt: current.prompt,
              cwd: current.cwd,
              schedule: current.schedule,
              target: current.target,
              enabled: call.arguments.enabled,
              unattendedAccess: current.unattendedAccess,
            });
            if (!saved) throw new Error("The scheduled task was not updated.");
            result = saved;
            break;
          }
          case "run_now": {
            const current = findTask(automations, call.arguments.id);
            if (!(await automations.runNow(current.id))) {
              throw new Error("The scheduled task could not be queued.");
            }
            result = { id: current.id, queued: true };
            break;
          }
          case "delete": {
            if (pending.current) {
              throw new Error(
                "Another scheduled task deletion is awaiting confirmation.",
              );
            }
            const task = findTask(automations, call.arguments.id);
            pending.current = call;
            setConfirmation({ requestId: call.requestId, task });
            return;
          }
          default:
            throw new Error(`Unknown scheduler tool: ${call.tool}`);
        }
        await answer(call.requestId, dynamicToolSuccess(result));
      } catch (error) {
        await answer(call.requestId, dynamicToolFailure(error));
      }
    },
    [answer, automations],
  );

  const handleMessage = useCallback(
    (message: AppServerMessage) => {
      if (message.method === "serverRequest/resolved") {
        const requestId = record(message.params)?.requestId;
        if (pending.current?.requestId === requestId) {
          pending.current = undefined;
          setConfirmation(undefined);
          setSubmitting(false);
        }
        return false;
      }
      let call: SchedulerToolCall | undefined;
      try {
        call = schedulerToolCallFromMessage(message);
      } catch (error) {
        if (message.id !== undefined) {
          void answer(message.id, dynamicToolFailure(error));
          return true;
        }
        return false;
      }
      if (!call) return false;
      void execute(call);
      return true;
    },
    [answer, execute],
  );

  const cancelDelete = useCallback(async () => {
    const call = pending.current;
    if (!call || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    await answer(
      call.requestId,
      dynamicToolFailure("The user cancelled deletion."),
    );
    pending.current = undefined;
    setConfirmation(undefined);
    setSubmitting(false);
    busy.current = false;
  }, [answer]);

  const confirmDelete = useCallback(async () => {
    const call = pending.current;
    if (!call || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    try {
      const task = findTask(automations, call.arguments.id);
      if (!(await automations.deleteAutomation(task.id))) {
        throw new Error("The scheduled task was not deleted.");
      }
      await answer(call.requestId, dynamicToolSuccess({ id: task.id, deleted: true }));
      pending.current = undefined;
      setConfirmation(undefined);
    } catch (error) {
      await answer(call.requestId, dynamicToolFailure(error));
      pending.current = undefined;
      setConfirmation(undefined);
    } finally {
      setSubmitting(false);
      busy.current = false;
    }
  }, [answer, automations]);

  return {
    cancelDelete,
    confirmation,
    confirmDelete,
    handleMessage,
    submitting,
  };
}

function findTask(automations: AutomationsController, value: unknown) {
  if (typeof value !== "string" || !value) {
    throw new Error("id must be a non-empty string.");
  }
  const task = automations.automations.find((candidate) => candidate.id === value);
  if (!task) throw new Error(`Scheduled task not found: ${value}`);
  return task;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
