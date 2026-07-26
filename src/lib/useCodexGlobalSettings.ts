import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import { isDesktopApp, request } from "./codex";
import {
  configReadParams,
  fileOpenerConfigWriteParams,
  modelVerbosityConfigWriteParams,
  planReasoningEffortConfigWriteParams,
  reasoningSummaryConfigWriteParams,
  webSearchConfigWriteParams,
  type FileOpener,
  type ModelVerbosity,
  type PlanReasoningEffort,
  type ReasoningSummaryMode,
  type WebSearchMode,
} from "./protocol";

export type CodexGlobalSettingsController = {
  allowed?: WebSearchMode[];
  error?: string;
  loading: boolean;
  mode: WebSearchMode;
  fileOpener: FileOpener;
  reasoningSummary: ReasoningSummaryMode;
  modelVerbosity: ModelVerbosity;
  planReasoningEffort: PlanReasoningEffort;
  refresh: () => Promise<void>;
  setMode: (mode: WebSearchMode) => Promise<boolean>;
  setFileOpener: (opener: FileOpener) => Promise<boolean>;
  setReasoningSummary: (mode: ReasoningSummaryMode) => Promise<boolean>;
  setModelVerbosity: (verbosity: ModelVerbosity) => Promise<boolean>;
  setPlanReasoningEffort: (effort: PlanReasoningEffort) => Promise<boolean>;
  updating?: WebSearchMode;
};

export function useCodexGlobalSettings(
  connected: boolean,
  allowed?: WebSearchMode[],
): CodexGlobalSettingsController {
  const [mode, setModeState] = useState<WebSearchMode>("cached");
  const [fileOpener, setFileOpenerState] = useState<FileOpener>("vscode");
  const [reasoningSummary, setReasoningSummaryState] =
    useState<ReasoningSummaryMode>("auto");
  const [modelVerbosity, setModelVerbosityState] =
    useState<ModelVerbosity>("medium");
  const [planReasoningEffort, setPlanReasoningEffortState] =
    useState<PlanReasoningEffort>("high");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<WebSearchMode>();
  const [error, setError] = useState<string>();
  const refreshVersion = useRef(0);
  const writeInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!connected || !isDesktopApp()) return;
    const version = ++refreshVersion.current;
    setLoading(true);
    try {
      const response = await request<ConfigReadResponse>(
        "config/read",
        configReadParams(),
      );
      if (refreshVersion.current !== version) return;
      const config = appServerRecord(response.config);
      setModeState(normalizeWebSearchMode(appServerString(config?.web_search)));
      setFileOpenerState(normalizeFileOpener(appServerString(config?.file_opener)));
      setReasoningSummaryState(
        normalizeReasoningSummary(appServerString(config?.model_reasoning_summary)),
      );
      setModelVerbosityState(
        normalizeModelVerbosity(appServerString(config?.model_verbosity)),
      );
      setPlanReasoningEffortState(
        normalizePlanReasoningEffort(
          appServerString(config?.plan_mode_reasoning_effort),
        ),
      );
      setError(undefined);
    } catch (cause) {
      if (refreshVersion.current === version) setError(errorMessage(cause));
    } finally {
      if (refreshVersion.current === version) setLoading(false);
    }
  }, [connected]);

  const setMode = useCallback(
    async (nextMode: WebSearchMode) => {
      if (writeInFlight.current) return false;
      if (allowed !== undefined && !allowed.includes(nextMode)) return false;
      if (!isDesktopApp()) {
        setModeState(nextMode);
        return true;
      }
      writeInFlight.current = true;
      setUpdating(nextMode);
      setError(undefined);
      try {
        await request(
          "config/value/write",
          webSearchConfigWriteParams(nextMode),
        );
        setModeState(nextMode);
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      } finally {
        writeInFlight.current = false;
        setUpdating(undefined);
      }
    },
    [allowed],
  );

  const writeOption = useCallback(
    async <T,>(
      value: T,
      params: Record<string, unknown>,
      apply: (value: T) => void,
    ) => {
      if (writeInFlight.current) return false;
      if (!isDesktopApp()) {
        apply(value);
        return true;
      }
      writeInFlight.current = true;
      setError(undefined);
      try {
        await request("config/value/write", params);
        apply(value);
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      } finally {
        writeInFlight.current = false;
      }
    },
    [],
  );
  const setFileOpener = useCallback(
    (value: FileOpener) =>
      writeOption(value, fileOpenerConfigWriteParams(value), setFileOpenerState),
    [writeOption],
  );
  const setReasoningSummary = useCallback(
    (value: ReasoningSummaryMode) =>
      writeOption(
        value,
        reasoningSummaryConfigWriteParams(value),
        setReasoningSummaryState,
      ),
    [writeOption],
  );
  const setModelVerbosity = useCallback(
    (value: ModelVerbosity) =>
      writeOption(
        value,
        modelVerbosityConfigWriteParams(value),
        setModelVerbosityState,
      ),
    [writeOption],
  );
  const setPlanReasoningEffort = useCallback(
    (value: PlanReasoningEffort) =>
      writeOption(
        value,
        planReasoningEffortConfigWriteParams(value),
        setPlanReasoningEffortState,
      ),
    [writeOption],
  );

  useEffect(() => {
    if (connected) void refresh();
    else {
      refreshVersion.current += 1;
      setLoading(false);
    }
  }, [connected, refresh]);

  return {
    allowed,
    error,
    fileOpener,
    loading,
    mode,
    modelVerbosity,
    planReasoningEffort,
    reasoningSummary,
    refresh,
    setFileOpener,
    setMode,
    setModelVerbosity,
    setPlanReasoningEffort,
    setReasoningSummary,
    updating,
  };
}

export function normalizeWebSearchMode(value?: string): WebSearchMode {
  return value === "disabled" ||
    value === "indexed" ||
    value === "live" ||
    value === "cached"
    ? value
    : "cached";
}

export function normalizeFileOpener(value?: string): FileOpener {
  return value === "vscode-insiders" ||
    value === "windsurf" ||
    value === "cursor" ||
    value === "none" ||
    value === "vscode"
    ? value
    : "vscode";
}

export function normalizeReasoningSummary(value?: string): ReasoningSummaryMode {
  return value === "concise" ||
    value === "detailed" ||
    value === "none" ||
    value === "auto"
    ? value
    : "auto";
}

export function normalizeModelVerbosity(value?: string): ModelVerbosity {
  return value === "low" || value === "high" || value === "medium"
    ? value
    : "medium";
}

export function normalizePlanReasoningEffort(
  value?: string,
): PlanReasoningEffort {
  return value === "none" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "xhigh" ||
    value === "high"
    ? value
    : "high";
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
