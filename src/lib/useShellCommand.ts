import { useCallback, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { request } from "./codex";
import { threadShellCommandParams } from "./protocol";
import type { ThreadCreationResult } from "./threadNavigationGuard";

export type ShellCommandController = {
  pending?: string;
  executing: boolean;
  requestExecution: (command: string) => void;
  cancel: () => void;
  confirm: () => Promise<void>;
};

export function useShellCommand({
  busy,
  threadId,
  createThread,
  onError,
  onStarted,
}: {
  busy: boolean;
  threadId?: string;
  createThread: () => Promise<ThreadCreationResult>;
  onError: (title: string, error: unknown, threadId?: string) => void;
  onStarted: (command: string, threadId: string) => void;
}): ShellCommandController {
  const { t } = useI18n();
  const [pending, setPending] = useState<string>();
  const [executing, setExecuting] = useState(false);
  const executionInFlight = useRef(false);

  const requestExecution = useCallback(
    (command: string) => {
      const normalized = command.trim().slice(0, 32_768);
      if (!normalized) {
        onError(t("shellCommand.invalid"), t("shellCommand.empty"), threadId);
        return;
      }
      if (busy || executionInFlight.current) {
        onError(
          t("shellCommand.unavailable"),
          t("shellCommand.busy"),
          threadId,
        );
        return;
      }
      setPending(normalized);
    },
    [busy, onError, t, threadId],
  );

  const cancel = useCallback(() => {
    if (!executionInFlight.current) setPending(undefined);
  }, []);

  const confirm = useCallback(async () => {
    if (!pending || executionInFlight.current) return;
    executionInFlight.current = true;
    setExecuting(true);
    const command = pending;
    let targetThreadId = threadId;
    try {
      const created = threadId ? undefined : await createThread();
      if (created && !created.activated) {
        setPending(undefined);
        return;
      }
      const resolvedThreadId = threadId ?? created?.id;
      if (!resolvedThreadId) return;
      targetThreadId = resolvedThreadId;
      onStarted(command, resolvedThreadId);
      await request(
        "thread/shellCommand",
        threadShellCommandParams(resolvedThreadId, command),
      );
      setPending((current) => (current === command ? undefined : current));
    } catch (error) {
      onError(t("shellCommand.startError"), error, targetThreadId);
    } finally {
      executionInFlight.current = false;
      setExecuting(false);
    }
  }, [createThread, onError, onStarted, pending, t, threadId]);

  return { pending, executing, requestExecution, cancel, confirm };
}
