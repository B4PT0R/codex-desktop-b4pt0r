import { useCallback, useEffect, useRef, useState } from "react";
import type { ConfigReadResponse } from "./appServerTypes";
import { appServerRecord, appServerString } from "./appServerValues";
import { isDesktopApp, request } from "./codex";
import type { Personality } from "../types";
import type { ApprovalsReviewer } from "./protocol";
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
    agentsEnabled: boolean;
    approvalPolicy: GlobalApprovalPolicy;
    approvalsReviewer: GlobalApprovalsReviewer;
    allowLoginShell: boolean;
    cliAuthCredentialsStore: CredentialStore;
    defaultPermissions: GlobalPermissionProfile;
    developerInstructions: string | null;
    mcpOauthCredentialsStore: CredentialStore;
    model: string | null;
    modelAutoCompactTokenLimit: number | null;
    modelReasoningEffort: string | null;
    personality: Personality | null;
    projectDocFallbackFilenames: string[];
    projectDocMaxBytes: number;
    serviceTier: string | null;
    subagentInterruptMessage: boolean;
    subagentMaxConcurrentThreads: number | null;
    subagentModel: string | null;
    subagentReasoningEffort: string | null;
    suppressUnstableFeaturesWarning: boolean;
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
export type GlobalApprovalsReviewer = ApprovalsReviewer | "custom";
export type GlobalPermissionProfile = string;
export type AdvancedConfigKey =
  | "agents.default_subagent_model"
  | "agents.default_subagent_reasoning_effort"
  | "agents.enabled"
  | "agents.interrupt_message"
  | "agents.max_concurrent_threads_per_session"
  | "approval_policy"
  | "approvals_reviewer"
  | "allow_login_shell"
  | "cli_auth_credentials_store"
  | "default_permissions"
  | "developer_instructions"
  | "mcp_oauth_credentials_store"
  | "model"
  | "model_auto_compact_token_limit"
  | "model_reasoning_effort"
  | "personality"
  | "project_doc_fallback_filenames"
  | "project_doc_max_bytes"
  | "service_tier"
  | "suppress_unstable_features_warning"
  | "tool_output_token_limit";

const advancedDefaults = {
  agentsEnabled: true,
  approvalPolicy: "on-request" as GlobalApprovalPolicy,
  approvalsReviewer: "user" as GlobalApprovalsReviewer,
  allowLoginShell: true,
  cliAuthCredentialsStore: "file" as CredentialStore,
  defaultPermissions: ":workspace" as GlobalPermissionProfile,
  developerInstructions: null as string | null,
  mcpOauthCredentialsStore: "auto" as CredentialStore,
  model: null as string | null,
  modelAutoCompactTokenLimit: null as number | null,
  modelReasoningEffort: null as string | null,
  personality: null as Personality | null,
  projectDocFallbackFilenames: [] as string[],
  projectDocMaxBytes: 32_768,
  serviceTier: null as string | null,
  subagentInterruptMessage: true,
  subagentMaxConcurrentThreads: null as number | null,
  subagentModel: null as string | null,
  subagentReasoningEffort: null as string | null,
  suppressUnstableFeaturesWarning: false,
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
      const agents = appServerRecord(config?.agents);
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
        agentsEnabled: agents?.enabled !== false,
        approvalPolicy: normalizeGlobalApprovalPolicy(config?.approval_policy),
        approvalsReviewer: normalizeGlobalApprovalsReviewer(
          config?.approvals_reviewer,
        ),
        allowLoginShell: config?.allow_login_shell !== false,
        cliAuthCredentialsStore: normalizeCredentialStore(
          config?.cli_auth_credentials_store,
          "file",
        ),
        defaultPermissions: normalizeGlobalPermissionProfile(
          config?.default_permissions,
        ),
        developerInstructions:
          appServerString(config?.developer_instructions) ?? null,
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
        serviceTier: appServerString(config?.service_tier) ?? null,
        subagentInterruptMessage: agents?.interrupt_message !== false,
        subagentMaxConcurrentThreads: positiveIntegerOrNull(
          agents?.max_concurrent_threads_per_session,
        ),
        subagentModel:
          appServerString(agents?.default_subagent_model) ?? null,
        subagentReasoningEffort:
          appServerString(agents?.default_subagent_reasoning_effort) ?? null,
        suppressUnstableFeaturesWarning:
          config?.suppress_unstable_features_warning === true,
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
    "agents.default_subagent_model": "subagentModel",
    "agents.default_subagent_reasoning_effort": "subagentReasoningEffort",
    "agents.enabled": "agentsEnabled",
    "agents.interrupt_message": "subagentInterruptMessage",
    "agents.max_concurrent_threads_per_session":
      "subagentMaxConcurrentThreads",
    approval_policy: "approvalPolicy",
    approvals_reviewer: "approvalsReviewer",
    allow_login_shell: "allowLoginShell",
    cli_auth_credentials_store: "cliAuthCredentialsStore",
    default_permissions: "defaultPermissions",
    developer_instructions: "developerInstructions",
    mcp_oauth_credentials_store: "mcpOauthCredentialsStore",
    model: "model",
    model_auto_compact_token_limit: "modelAutoCompactTokenLimit",
    model_reasoning_effort: "modelReasoningEffort",
    personality: "personality",
    project_doc_fallback_filenames: "projectDocFallbackFilenames",
    project_doc_max_bytes: "projectDocMaxBytes",
    service_tier: "serviceTier",
    suppress_unstable_features_warning: "suppressUnstableFeaturesWarning",
    tool_output_token_limit: "toolOutputTokenLimit",
  };
  return keys[key];
}

function normalizeGlobalApprovalsReviewer(
  value: unknown,
): GlobalApprovalsReviewer {
  if (value === "user") return "user";
  if (value === "auto_review" || value === "guardian_subagent")
    return "auto_review";
  return value === undefined ? "user" : "custom";
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
