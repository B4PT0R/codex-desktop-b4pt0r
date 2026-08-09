import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { Translate } from "../i18n/I18nProvider";
import type { ThreadSummary } from "../types";
import type { RealtimeVoice } from "./appServerTypes";
import { request } from "./codex";
import { resolveDefaultRealtimeThread } from "./defaultRealtimeThread";
import { createDiscussionWorkspace } from "./discussionWorkspace";
import { threadRuntimeSettings } from "./threadRuntimeSettings";
import { threadSummary } from "./threadSummary";
import { isDesktopApp, listen } from "./nativeBridge";
import type { DefaultThreadSettingsController } from "./useDefaultThreadSettings";
import type { useRealtimeConversation } from "./useRealtimeConversation";
import {
  reportRealtimeTrayError,
  useRealtimeTray,
  type RealtimeTrayRequest,
} from "./useRealtimeTray";

type RealtimeConversationController = Pick<
  ReturnType<typeof useRealtimeConversation>,
  | "attachHeadlessTranscript"
  | "headlessParentThreadId"
  | "recording"
  | "starting"
  | "start"
  | "stop"
>;

type TrayRealtimeConversationOptions = {
  connected: boolean;
  defaultThread: DefaultThreadSettingsController;
  dictationActive: boolean;
  model: string;
  activeThreadId?: string;
  openThread: (threadId: string) => Promise<boolean>;
  realtimeConversation: RealtimeConversationController;
  resolveDeveloperInstructions: (cwd?: string) => Promise<string | undefined>;
  setThreads: Dispatch<SetStateAction<ThreadSummary[]>>;
  translate: Translate;
  voice: RealtimeVoice;
};

export function useTrayRealtimeConversation(
  options: TrayRealtimeConversationOptions,
) {
  const current = useRef(options);
  const windowShownSinceStart = useRef(false);
  const revealing = useRef(false);
  current.current = options;

  useEffect(() => {
    if (!isDesktopApp()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen("window-shown", () => {
      windowShownSinceStart.current = true;
      void revealCurrentHeadlessSession();
    })
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (
      windowShownSinceStart.current &&
      options.realtimeConversation.headlessParentThreadId
    ) {
      void revealCurrentHeadlessSession(
        options.realtimeConversation.headlessParentThreadId,
      );
    }
  }, [options.realtimeConversation.headlessParentThreadId]);

  async function revealCurrentHeadlessSession(parentThreadId?: string) {
    const parent =
      parentThreadId ??
      current.current.realtimeConversation.headlessParentThreadId;
    if (!parent || revealing.current) return;
    revealing.current = true;
    try {
      await revealHeadlessRealtimeSession(current.current, parent);
    } finally {
      revealing.current = false;
    }
  }

  useRealtimeTray({
    connected: options.connected,
    recording: options.realtimeConversation.recording,
    onToggle: async (trayRequest) => {
      if (trayRequest.action === "start") {
        windowShownSinceStart.current = trayRequest.windowVisible;
      }
      const parentThreadId = await handleTrayRealtimeRequest(
        current.current,
        trayRequest,
      );
      if (
        parentThreadId &&
        (trayRequest.windowVisible || windowShownSinceStart.current)
      ) {
        await revealCurrentHeadlessSession(parentThreadId);
      }
    },
  });
}

export async function handleTrayRealtimeRequest(
  options: TrayRealtimeConversationOptions,
  trayRequest: RealtimeTrayRequest,
) {
  if (trayRequest.action === "stop") {
    await options.realtimeConversation.stop();
    return undefined;
  }
  if (!options.connected) {
    throw new Error(options.translate("app.realtimeUnavailable"));
  }
  if (
    options.realtimeConversation.recording ||
    options.realtimeConversation.starting
  )
    return undefined;
  if (options.dictationActive) {
    throw new Error(options.translate("app.realtimeDictationConflict"));
  }

  const resolved = await resolveDefaultRealtimeThread(request, {
    threadId: options.defaultThread.defaultThreadId,
    model: options.model,
    createDiscussionWorkspace: () =>
      createDiscussionWorkspace("Let's discuss anything"),
    resolveDeveloperInstructions: options.resolveDeveloperInstructions,
  });
  const resolvedThread = threadSummary(resolved.response.thread);
  const settings = threadRuntimeSettings(resolved.response);
  if (resolved.created) {
    const saved = await options.defaultThread.setDefaultThreadId(
      resolved.response.thread.id,
    );
    if (!saved) {
      throw new Error(
        options.defaultThread.error ??
          options.translate("settings.defaultThread.saveError"),
      );
    }
  }
  options.setThreads((items) => [
    {
      ...resolvedThread,
      cwd: resolvedThread.cwd ?? settings.cwd ?? resolved.workspace,
    },
    ...items.filter((item) => item.id !== resolvedThread.id),
  ]);

  const started = await options.realtimeConversation.start({
    parentThreadId: resolved.response.thread.id,
    cwd: settings.cwd ?? resolved.workspace,
    model: settings.model ?? options.model,
    permission: settings.permission,
    personality: settings.personality,
    approvalPolicy: settings.approvalPolicy,
    voice: options.voice,
    displayTranscript: false,
    reportError: (_title, error) => {
      void reportRealtimeTrayError(error).catch(() => undefined);
    },
  });
  return started ? resolved.response.thread.id : undefined;
}

export async function revealHeadlessRealtimeSession(
  options: TrayRealtimeConversationOptions,
  parentThreadId: string,
) {
  const opened =
    options.activeThreadId === parentThreadId ||
    (await options.openThread(parentThreadId));
  if (!opened) return false;
  return options.realtimeConversation.attachHeadlessTranscript();
}
