import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import { isDesktopApp, request } from "./codex";
import type { Personality } from "../types";
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
  advanced: {
    approvalPolicy: GlobalApprovalPolicy;
    allowLoginShell: boolean;
    cliAuthCredentialsStore: CredentialStore;
    defaultPermissions: GlobalPermissionProfile;
    mcpOauthCredentialsStore: CredentialStore;
    model: string | null;
    modelAutoCompactTokenLimit: number | null;
    modelReasoningEffort: string | null;
    personality: Personality | null;
    projectDocFallbackFilenames: string[];
    projectDocMaxBytes: number;
    toolOutputTokenLimit: number | null;
  };
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
  setAdvanced: (
    key: AdvancedConfigKey,
    value: boolean | number | string | string[] | null,
  ) => Promise<boolean>;
  updating?: WebSearchMode;
};

export type CredentialStore = "auto" | "file" | "keyring";
export type GlobalApprovalPolicy =
  | "untrusted"
  | "on-request"
  | "never"
  | "custom";
export type GlobalPermissionProfile = string;
export type AdvancedConfigKey =
  | "approval_policy"
  | "allow_login_shell"
  | "cli_auth_credentials_store"
  | "default_permissions"
  | "mcp_oauth_credentials_store"
  | "model"
  | "model_auto_compact_token_limit"
  | "model_reasoning_effort"
  | "personality"
  | "project_doc_fallback_filenames"
  | "project_doc_max_bytes"
  | "tool_output_token_limit";

const advancedDefaults = {
  approvalPolicy: "on-request" as GlobalApprovalPolicy,
  allowLoginShell: true,
  cliAuthCredentialsStore: "file" as CredentialStore,
  defaultPermissions: ":workspace" as GlobalPermissionProfile,
  mcpOauthCredentialsStore: "auto" as CredentialStore,
  model: null as string | null,
  modelAutoCompactTokenLimit: null as number | null,
  modelReasoningEffort: null as string | null,
  personality: null as Personality | null,
  projectDocFallbackFilenames: [] as string[],
  projectDocMaxBytes: 32_768,
  toolOutputTokenLimit: null as number | null,
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
  const [advanced, setAdvancedState] = useState(advancedDefaults);
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
      setAdvancedState({
        approvalPolicy: normalizeGlobalApprovalPolicy(config?.approval_policy),
        allowLoginShell: config?.allow_login_shell !== false,
        cliAuthCredentialsStore: normalizeCredentialStore(
          config?.cli_auth_credentials_store,
          "file",
        ),
        defaultPermissions: normalizeGlobalPermissionProfile(
          config?.default_permissions,
        ),
        mcpOauthCredentialsStore: normalizeCredentialStore(
          config?.mcp_oauth_credentials_store,
          "auto",
        ),
        model: appServerString(config?.model) ?? null,
        modelAutoCompactTokenLimit: positiveIntegerOrNull(
          config?.model_auto_compact_token_limit,
        ),
        modelReasoningEffort:
          appServerString(config?.model_reasoning_effort) ?? null,
        personality: normalizePersonality(config?.personality),
        projectDocFallbackFilenames: stringArray(
          config?.project_doc_fallback_filenames,
        ),
        projectDocMaxBytes:
          positiveIntegerOrNull(config?.project_doc_max_bytes) ?? 32_768,
        toolOutputTokenLimit: positiveIntegerOrNull(
          config?.tool_output_token_limit,
        ),
      });
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
  const setAdvanced = useCallback(
    (
      key: AdvancedConfigKey,
      value: boolean | number | string | string[] | null,
    ) =>
      writeOption(value, {
        keyPath: key,
        value,
        mergeStrategy: value === null ? "replace" : "upsert",
      }, () => {
        setAdvancedState((current) => ({
          ...current,
          [advancedStateKey(key)]: value,
        }));
      }),
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
    advanced,
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
    setAdvanced,
    setReasoningSummary,
    updating,
  };
}

function advancedStateKey(key: AdvancedConfigKey) {
  const keys: Record<AdvancedConfigKey, keyof typeof advancedDefaults> = {
    approval_policy: "approvalPolicy",
    allow_login_shell: "allowLoginShell",
    cli_auth_credentials_store: "cliAuthCredentialsStore",
    default_permissions: "defaultPermissions",
    mcp_oauth_credentials_store: "mcpOauthCredentialsStore",
    model: "model",
    model_auto_compact_token_limit: "modelAutoCompactTokenLimit",
    model_reasoning_effort: "modelReasoningEffort",
    personality: "personality",
    project_doc_fallback_filenames: "projectDocFallbackFilenames",
    project_doc_max_bytes: "projectDocMaxBytes",
    tool_output_token_limit: "toolOutputTokenLimit",
  };
  return keys[key];
}

function normalizePersonality(value: unknown): Personality | null {
  return value === "pragmatic" || value === "friendly" || value === "none"
    ? value
    : null;
}

function normalizeGlobalApprovalPolicy(value: unknown): GlobalApprovalPolicy {
  return value === "untrusted" || value === "on-request" || value === "never"
    ? value
    : value === undefined
      ? "on-request"
      : "custom";
}

function normalizeGlobalPermissionProfile(
  value: unknown,
): GlobalPermissionProfile {
  return typeof value === "string" && value ? value : ":workspace";
}

function normalizeCredentialStore(
  value: unknown,
  fallback: CredentialStore,
): CredentialStore {
  return value === "auto" || value === "file" || value === "keyring"
    ? value
    : fallback;
}

function positiveIntegerOrNull(value: unknown) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
