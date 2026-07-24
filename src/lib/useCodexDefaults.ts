import { useEffect, useRef } from "react";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import { request } from "./codex";
import { configReadParams } from "./protocol";

export type CodexThreadDefaults = {
  model?: string;
  effort?: string;
};

type Options = {
  connected: boolean;
  cwd: string;
  enabled: boolean;
  onDefaults: (defaults: CodexThreadDefaults) => void;
  onError: (error: unknown) => void;
};

/** Reads the effective Codex config for the workspace before a thread exists. */
export function useCodexDefaults({
  connected,
  cwd,
  enabled,
  onDefaults,
  onError,
}: Options) {
  const callbacks = useRef({ onDefaults, onError });
  callbacks.current = { onDefaults, onError };

  useEffect(() => {
    if (!connected || !enabled) return;
    let disposed = false;
    void request<ConfigReadResponse>("config/read", configReadParams(cwd))
      .then((response) => {
        if (disposed) return;
        const config = appServerRecord(response.config);
        callbacks.current.onDefaults({
          model: appServerString(config?.model),
          effort: appServerString(config?.model_reasoning_effort),
        });
      })
      .catch((error) => {
        if (!disposed) callbacks.current.onError(error);
      });
    return () => {
      disposed = true;
    };
  }, [connected, cwd, enabled]);
}
