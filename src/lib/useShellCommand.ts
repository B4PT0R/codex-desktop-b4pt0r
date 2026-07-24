import { useCallback, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { request } from "./codex";
import { threadShellCommandParams } from "./protocol";

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
  createThread: () => Promise<string>;
  onError: (title: string, error: unknown) => void;
  onStarted: (command: string) => void;
}): ShellCommandController {
  const { t } = useI18n();
  const [pending, setPending] = useState<string>();
  const [executing, setExecuting] = useState(false);

  const requestExecution = useCallback(
    (command: string) => {
      const normalized = command.trim().slice(0, 32_768);
      if (!normalized) {
        onError(t("shellCommand.invalid"), t("shellCommand.empty"));
        return;
      }
      if (busy) {
        onError(t("shellCommand.unavailable"), t("shellCommand.busy"));
        return;
      }
      setPending(normalized);
    },
    [busy, onError, t],
  );

  const cancel = useCallback(() => {
    if (!executing) setPending(undefined);
  }, [executing]);

  const confirm = useCallback(async () => {
    if (!pending || executing) return;
    setExecuting(true);
    try {
      const resolvedThreadId = threadId ?? (await createThread());
      onStarted(pending);
      await request(
        "thread/shellCommand",
        threadShellCommandParams(resolvedThreadId, pending),
      );
      setPending(undefined);
    } catch (error) {
      onError(t("shellCommand.startError"), error);
    } finally {
      setExecuting(false);
    }
  }, [createThread, executing, onError, onStarted, pending, t, threadId]);

  return { pending, executing, requestExecution, cancel, confirm };
}
