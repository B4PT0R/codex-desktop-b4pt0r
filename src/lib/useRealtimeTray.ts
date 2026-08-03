import { useEffect, useRef, useState } from "react";
import { invoke, isDesktopApp, listen } from "./nativeBridge";

export type RealtimeTrayRequest = {
  action: "start" | "stop";
  home: string;
  windowVisible: boolean;
};

type RealtimeTrayOptions = {
  connected: boolean;
  recording: boolean;
  onToggle: (request: RealtimeTrayRequest) => Promise<void>;
};

export function useRealtimeTray({
  connected,
  recording,
  onToggle,
}: RealtimeTrayOptions) {
  const [listenerReady, setListenerReady] = useState(false);
  const callback = useRef(onToggle);
  const toggling = useRef(false);
  callback.current = onToggle;

  useEffect(() => {
    if (!isDesktopApp()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<unknown>("realtime-tray-toggle", ({ payload }) => {
      if (toggling.current) return;
      let request: RealtimeTrayRequest;
      try {
        request = realtimeTrayRequest(payload);
      } catch (error) {
        safelyReportRealtimeTrayError(error);
        return;
      }
      toggling.current = true;
      void callback
        .current(request)
        .catch(safelyReportRealtimeTrayError)
        .finally(() => {
          toggling.current = false;
        });
    })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
          return;
        }
        unlisten = cleanup;
        setListenerReady(true);
      })
      .catch((error) => {
        if (!disposed) safelyReportRealtimeTrayError(error);
      });
    return () => {
      disposed = true;
      setListenerReady(false);
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!listenerReady || !isDesktopApp()) return;
    const state = !connected ? "unavailable" : recording ? "active" : "idle";
    void invoke("set_tray_realtime_state", { state }).catch(() => undefined);
  }, [connected, listenerReady, recording]);
}

export function reportRealtimeTrayError(error: unknown) {
  if (!isDesktopApp()) return Promise.resolve();
  return invoke("set_tray_realtime_state", {
    state: "error",
    message: error instanceof Error ? error.message : String(error),
  });
}

function safelyReportRealtimeTrayError(error: unknown) {
  void reportRealtimeTrayError(error).catch(() => undefined);
}

function realtimeTrayRequest(value: unknown): RealtimeTrayRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid tray Realtime request");
  }
  const request = value as Record<string, unknown>;
  if (
    (request.action !== "start" && request.action !== "stop") ||
    typeof request.home !== "string" ||
    !request.home.startsWith("/") ||
    typeof request.windowVisible !== "boolean"
  ) {
    throw new Error("Invalid tray Realtime request");
  }
  return {
    action: request.action,
    home: request.home,
    windowVisible: request.windowVisible,
  };
}
