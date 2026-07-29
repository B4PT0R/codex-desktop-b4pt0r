import { listen } from "./nativeBridge";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { Model, ThreadSummary } from "../types";
import type { ModelListResponse, ThreadListResponse } from "./appServerTypes";
import {
  connect,
  isDesktopApp,
  reconnect,
  request,
  restartAppServer,
  type AppServerMessage,
} from "./codex";
import { threadSummary } from "./threadSummary";

type Options = {
  onDisconnected: () => void;
  onError: (title: string, error: unknown) => void;
  onInitialized: (models: Model[], threads: ThreadSummary[]) => void;
  onMessage: (message: AppServerMessage) => void;
  onNewChat: () => void;
  onRecovered?: () => Promise<unknown>;
};

const RECONNECT_DELAYS_MS = [1_000, 3_000, 10_000, 30_000] as const;

export function useAppServerConnection(options: Options) {
  const { t } = useI18n();
  const callbacks = useRef(options);
  callbacks.current = options;
  const translate = useRef(t);
  translate.current = t;
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [restartError, setRestartError] = useState<string>();
  const [restarting, setRestarting] = useState(false);
  const restartingRef = useRef(false);
  const recoverNow = useRef<() => Promise<boolean>>(async () => false);

  async function hydrateCatalogs(shouldApply: () => boolean = () => true) {
    const [models, history] = await Promise.all([
      request<ModelListResponse>("model/list", { limit: 50 }),
      request<ThreadListResponse>("thread/list", {
        limit: 30,
        sortKey: "updated_at",
      }),
    ]);
    if (shouldApply())
      callbacks.current.onInitialized(
        normalizeModels(models),
        (history.data ?? []).map(threadSummary),
      );
  }

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let unlistenNewChat: (() => void) | undefined;
    let reconnectAttempt = 0;
    let reconnectTimer: number | undefined;
    let recoveryInFlight = false;
    let connectionErrorReported = false;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    };

    const handleMessage = (message: AppServerMessage) =>
      callbacks.current.onMessage(message);

    const handleConnection = (nextConnected: boolean, error?: Error) => {
      if (disposed) return;
      setConnected(nextConnected);
      if (nextConnected) {
        clearReconnectTimer();
        return;
      }
      callbacks.current.onDisconnected();
      if (error && !connectionErrorReported) {
        connectionErrorReported = true;
        callbacks.current.onError(
          translate.current("app.connectionInterrupted"),
          error,
        );
      }
      scheduleReconnect();
    };

    const establishConnection = async () => {
      if (cleanup) {
        await reconnect();
        return;
      }
      const disconnect = await connect(handleMessage, handleConnection);
      if (disposed) {
        disconnect();
        return;
      }
      cleanup = disconnect;
    };

    const ensureNewChatListener = async () => {
      if (!isDesktopApp() || unlistenNewChat) return;
      const unlisten = await listen("new-chat", () =>
        callbacks.current.onNewChat(),
      );
      if (disposed) {
        unlisten();
        return;
      }
      unlistenNewChat = unlisten;
    };

    const recover = async () => {
      if (disposed || recoveryInFlight || restartingRef.current) return false;
      recoveryInFlight = true;
      let shouldRetry = false;
      clearReconnectTimer();
      setReconnecting(true);
      try {
        await establishConnection();
        if (!disposed) setConnected(true);
        await ensureNewChatListener();
        await hydrateCatalogs(() => !disposed);
        if (!disposed) await callbacks.current.onRecovered?.();
        reconnectAttempt = 0;
        connectionErrorReported = false;
        return true;
      } catch {
        reconnectAttempt += 1;
        shouldRetry = true;
        return false;
      } finally {
        recoveryInFlight = false;
        if (shouldRetry) scheduleReconnect();
        if (!disposed) setReconnecting(false);
      }
    };

    const scheduleReconnect = () => {
      if (
        disposed ||
        reconnectTimer !== undefined ||
        recoveryInFlight ||
        restartingRef.current
      )
        return;
      const delay =
        RECONNECT_DELAYS_MS[
          Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
        ];
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        void recover();
      }, delay);
    };
    recoverNow.current = recover;

    void establishConnection()
      .then(async () => {
        if (!isDesktopApp() || disposed) return;
        try {
          await ensureNewChatListener();
          if (!disposed) await hydrateCatalogs(() => !disposed);
        } catch (error) {
          if (!disposed)
            callbacks.current.onError(
              translate.current("app.initializationIncomplete"),
              error,
            );
        }
      })
      .catch(() => scheduleReconnect());

    return () => {
      disposed = true;
      clearReconnectTimer();
      recoverNow.current = async () => false;
      cleanup?.();
      unlistenNewChat?.();
    };
  }, []);

  async function reconnectAppServer() {
    await recoverNow.current();
  }

  async function restartCodexAppServer() {
    if (restarting) return false;
    restartingRef.current = true;
    setRestarting(true);
    setRestartError(undefined);
    try {
      await restartAppServer();
      await hydrateCatalogs();
      return true;
    } catch (error) {
      setRestartError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      restartingRef.current = false;
      setRestarting(false);
    }
  }

  return {
    connected,
    reconnecting,
    reconnect: reconnectAppServer,
    restart: restartCodexAppServer,
    restartError,
    restarting,
  };
}

export function normalizeModels(response: ModelListResponse): Model[] {
  return (response.data ?? response.models ?? []).map((model) => ({
    id: model.id,
    label: model.displayName ?? model.id,
    supportedReasoningEfforts: model.supportedReasoningEfforts,
    defaultReasoningEffort: model.defaultReasoningEffort,
    supportsPersonality: model.supportsPersonality,
  }));
}
