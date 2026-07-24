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
  type AppServerMessage,
} from "./codex";
import { threadSummary } from "./threadSummary";

type Options = {
  onDisconnected: () => void;
  onError: (title: string, error: unknown) => void;
  onInitialized: (models: Model[], threads: ThreadSummary[]) => void;
  onMessage: (message: AppServerMessage) => void;
  onNewChat: () => void;
};

export function useAppServerConnection(options: Options) {
  const { t } = useI18n();
  const callbacks = useRef(options);
  callbacks.current = options;
  const translate = useRef(t);
  translate.current = t;
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let unlistenNewChat: (() => void) | undefined;

    void connect(
      (message) => callbacks.current.onMessage(message),
      (nextConnected, error) => {
        if (disposed) return;
        setConnected(nextConnected);
        if (!nextConnected) callbacks.current.onDisconnected();
        if (error)
          callbacks.current.onError(
            translate.current("app.connectionInterrupted"),
            error,
          );
      },
    )
      .then(async (disconnect) => {
        if (disposed) {
          disconnect();
          return;
        }
        cleanup = disconnect;
        if (!isDesktopApp()) return;
        try {
          unlistenNewChat = await listen("new-chat", () =>
            callbacks.current.onNewChat(),
          );
          if (disposed) {
            unlistenNewChat();
            unlistenNewChat = undefined;
            return;
          }
          const [models, history] = await Promise.all([
            request<ModelListResponse>("model/list", { limit: 50 }),
            request<ThreadListResponse>("thread/list", {
              limit: 30,
              sortKey: "updated_at",
            }),
          ]);
          if (!disposed)
            callbacks.current.onInitialized(
              normalizeModels(models),
              (history.data ?? []).map(threadSummary),
            );
        } catch (error) {
          if (!disposed)
            callbacks.current.onError(
              translate.current("app.initializationIncomplete"),
              error,
            );
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      cleanup?.();
      unlistenNewChat?.();
    };
  }, []);

  async function reconnectAppServer() {
    setReconnecting(true);
    try {
      await reconnect();
    } catch {
      // The connection listener presents the actionable error in the conversation.
    } finally {
      setReconnecting(false);
    }
  }

  return { connected, reconnecting, reconnect: reconnectAppServer };
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
