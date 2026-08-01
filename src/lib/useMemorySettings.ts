import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord } from "./appServerValues";
import { isDesktopApp, request } from "./codex";
import { configReadParams, configValueWriteParams } from "./protocol";

export type MemorySettingsController = {
  enabled: boolean;
  generateMemories: boolean;
  useMemories: boolean;
  disableOnExternalContext: boolean;
  minRateLimitRemainingPercent: number;
  loading: boolean;
  saving: boolean;
  resetting: boolean;
  error?: string;
  setEnabled: (value: boolean) => Promise<boolean>;
  setGenerateMemories: (value: boolean) => Promise<boolean>;
  setUseMemories: (value: boolean) => Promise<boolean>;
  setDisableOnExternalContext: (value: boolean) => Promise<boolean>;
  setMinRateLimitRemainingPercent: (value: number) => Promise<boolean>;
  reset: () => Promise<boolean>;
};

export function useMemorySettings(connected: boolean): MemorySettingsController {
  const [enabled, setEnabledState] = useState(false);
  const [generateMemories, setGenerateMemoriesState] = useState(true);
  const [useMemories, setUseMemoriesState] = useState(true);
  const [disableOnExternalContext, setDisableOnExternalContextState] =
    useState(false);
  const [minRateLimitRemainingPercent, setMinRateLimitRemainingPercentState] =
    useState(25);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const resetInFlight = useRef(false);
  const writeInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!connected || !isDesktopApp()) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const response = await request<ConfigReadResponse>(
        "config/read",
        configReadParams(),
      );
      if (current !== generation.current) return;
      const config = appServerRecord(response.config);
      const features = appServerRecord(config?.features);
      const memories = appServerRecord(config?.memories);
      setEnabledState(features?.memories === true);
      setGenerateMemoriesState(memories?.generate_memories !== false);
      setUseMemoriesState(memories?.use_memories !== false);
      setDisableOnExternalContextState(
        memories?.disable_on_external_context === true,
      );
      const threshold = memories?.min_rate_limit_remaining_percent;
      setMinRateLimitRemainingPercentState(
        typeof threshold === "number" &&
          Number.isInteger(threshold) &&
          threshold >= 0 &&
          threshold <= 100
          ? threshold
          : 25,
      );
      setError(undefined);
    } catch (cause) {
      if (current === generation.current) setError(errorMessage(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [connected]);

  const write = useCallback(
    async <T,>(keyPath: string, value: T, apply: (value: T) => void) => {
      if (writeInFlight.current) return false;
      if (!isDesktopApp()) {
        apply(value);
        return true;
      }
      writeInFlight.current = true;
      setSaving(true);
      setError(undefined);
      try {
        await request("config/value/write", configValueWriteParams(keyPath, value));
        apply(value);
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      } finally {
        writeInFlight.current = false;
        setSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (connected) void refresh();
    else {
      generation.current += 1;
      setLoading(false);
    }
  }, [connected, refresh]);

  return {
    enabled,
    generateMemories,
    useMemories,
    disableOnExternalContext,
    minRateLimitRemainingPercent,
    loading,
    saving,
    resetting,
    error,
    setEnabled: (value) => write("features.memories", value, setEnabledState),
    setGenerateMemories: (value) =>
      write("memories.generate_memories", value, setGenerateMemoriesState),
    setUseMemories: (value) =>
      write("memories.use_memories", value, setUseMemoriesState),
    setDisableOnExternalContext: (value) =>
      write(
        "memories.disable_on_external_context",
        value,
        setDisableOnExternalContextState,
      ),
    setMinRateLimitRemainingPercent: (value) =>
      write(
        "memories.min_rate_limit_remaining_percent",
        Math.max(0, Math.min(100, Math.round(value))),
        setMinRateLimitRemainingPercentState,
      ),
    reset: async () => {
      if (resetInFlight.current || !isDesktopApp()) return false;
      resetInFlight.current = true;
      setResetting(true);
      setError(undefined);
      try {
        await request("memory/reset");
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      } finally {
        resetInFlight.current = false;
        setResetting(false);
      }
    },
  };
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
