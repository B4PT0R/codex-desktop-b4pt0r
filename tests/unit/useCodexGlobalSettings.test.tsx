// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
}));

import { useCodexGlobalSettings } from "../../src/lib/useCodexGlobalSettings";

beforeEach(() => requestMock.mockReset());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("réglage global de recherche web", () => {
  it("hydrate la valeur utilisateur puis l'écrit via App Server", async () => {
    requestMock.mockResolvedValueOnce({
      config: {
        agents: {
          enabled: false,
          default_subagent_model: "gpt-subagent",
          default_subagent_reasoning_effort: "xhigh",
          max_concurrent_threads_per_session: 4,
          interrupt_message: false,
        },
        allow_login_shell: false,
        approval_policy: "never",
        approvals_reviewer: "auto_review",
        cli_auth_credentials_store: "keyring",
        default_permissions: ":read-only",
        developer_instructions: "Keep changes focused.",
        file_opener: "cursor",
        mcp_oauth_credentials_store: "file",
        model: "gpt-test",
        model_auto_compact_token_limit: 64_000,
        model_reasoning_effort: "high",
        model_verbosity: "high",
        model_reasoning_summary: "detailed",
        plan_mode_reasoning_effort: "xhigh",
        personality: "friendly",
        project_doc_fallback_filenames: ["CLAUDE.md"],
        project_doc_max_bytes: 65_536,
        service_tier: "fast",
        suppress_unstable_features_warning: true,
        tool_output_token_limit: 12_000,
        web_search: "indexed",
      },
    });
    const { result } = renderHook(() => useCodexGlobalSettings(true));

    await waitFor(() => expect(result.current.mode).toBe("indexed"));
    expect(result.current.fileOpener).toBe("cursor");
    expect(result.current.reasoningSummary).toBe("detailed");
    expect(result.current.modelVerbosity).toBe("high");
    expect(result.current.planReasoningEffort).toBe("xhigh");
    expect(result.current.advanced).toEqual({
      agentsEnabled: false,
      allowLoginShell: false,
      approvalPolicy: "never",
      approvalsReviewer: "auto_review",
      cliAuthCredentialsStore: "keyring",
      defaultPermissions: ":read-only",
      developerInstructions: "Keep changes focused.",
      mcpOauthCredentialsStore: "file",
      model: "gpt-test",
      modelAutoCompactTokenLimit: 64_000,
      modelReasoningEffort: "high",
      personality: "friendly",
      projectDocFallbackFilenames: ["CLAUDE.md"],
      projectDocMaxBytes: 65_536,
      serviceTier: "fast",
      subagentInterruptMessage: false,
      subagentMaxConcurrentThreads: 4,
      subagentModel: "gpt-subagent",
      subagentReasoningEffort: "xhigh",
      suppressUnstableFeaturesWarning: true,
      toolOutputTokenLimit: 12_000,
    });
    expect(requestMock).toHaveBeenCalledWith("config/read", {
      cwd: null,
      includeLayers: false,
    });

    requestMock.mockResolvedValueOnce({ status: "ok" });
    await act(async () => {
      expect(await result.current.setMode("live")).toBe(true);
    });
    expect(requestMock).toHaveBeenLastCalledWith("config/value/write", {
      keyPath: "web_search",
      mergeStrategy: "upsert",
      value: "live",
    });
    expect(result.current.mode).toBe("live");
  });

  it("écrit les options globales ciblées sans réécrire config.toml", async () => {
    requestMock.mockResolvedValueOnce({ config: {} });
    const { result } = renderHook(() => useCodexGlobalSettings(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    requestMock.mockResolvedValue({ status: "ok" });
    await act(async () => {
      expect(await result.current.setFileOpener("windsurf")).toBe(true);
      expect(await result.current.setReasoningSummary("concise")).toBe(true);
      expect(await result.current.setModelVerbosity("low")).toBe(true);
      expect(await result.current.setPlanReasoningEffort("medium")).toBe(true);
      expect(
        await result.current.setAdvanced(
          "suppress_unstable_features_warning",
          true,
        ),
      ).toBe(true);
      expect(
        await result.current.setAdvanced("approvals_reviewer", "auto_review"),
      ).toBe(true);
      expect(
        await result.current.setAdvanced(
          "agents.max_concurrent_threads_per_session",
          4,
        ),
      ).toBe(true);
      expect(
        await result.current.setAdvanced(
          "developer_instructions",
          "Be precise.",
        ),
      ).toBe(true);
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, "config/value/write", {
      keyPath: "file_opener",
      mergeStrategy: "upsert",
      value: "windsurf",
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, "config/value/write", {
      keyPath: "model_reasoning_summary",
      mergeStrategy: "upsert",
      value: "concise",
    });
    expect(requestMock).toHaveBeenNthCalledWith(4, "config/value/write", {
      keyPath: "model_verbosity",
      mergeStrategy: "upsert",
      value: "low",
    });
    expect(requestMock).toHaveBeenNthCalledWith(5, "config/value/write", {
      keyPath: "plan_mode_reasoning_effort",
      mergeStrategy: "upsert",
      value: "medium",
    });
    expect(requestMock).toHaveBeenNthCalledWith(6, "config/value/write", {
      keyPath: "suppress_unstable_features_warning",
      mergeStrategy: "upsert",
      value: true,
    });
    expect(requestMock).toHaveBeenNthCalledWith(7, "config/value/write", {
      keyPath: "approvals_reviewer",
      mergeStrategy: "upsert",
      value: "auto_review",
    });
    expect(requestMock).toHaveBeenNthCalledWith(8, "config/value/write", {
      keyPath: "agents.max_concurrent_threads_per_session",
      mergeStrategy: "upsert",
      value: 4,
    });
    expect(requestMock).toHaveBeenNthCalledWith(9, "config/value/write", {
      keyPath: "developer_instructions",
      mergeStrategy: "upsert",
      value: "Be precise.",
    });
  });

  it("conserve la valeur serveur si l'écriture échoue", async () => {
    requestMock.mockResolvedValueOnce({ config: { web_search: "cached" } });
    const { result } = renderHook(() => useCodexGlobalSettings(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    requestMock.mockRejectedValueOnce(new Error("écriture refusée"));
    await act(async () => {
      expect(await result.current.setMode("disabled")).toBe(false);
    });
    expect(result.current.mode).toBe("cached");
    expect(result.current.error).toBe("écriture refusée");
  });

  it("ignore une lecture antérieure à une écriture réussie", async () => {
    const staleRead = deferred<{ config: { web_search: "cached" } }>();
    requestMock
      .mockReturnValueOnce(staleRead.promise)
      .mockResolvedValueOnce({ status: "ok" });
    const { result } = renderHook(() => useCodexGlobalSettings(true));
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      expect(await result.current.setMode("live")).toBe(true);
    });
    expect(result.current.mode).toBe("live");
    expect(result.current.loading).toBe(false);

    staleRead.resolve({ config: { web_search: "cached" } });
    await act(() => staleRead.promise);
    expect(result.current.mode).toBe("live");
    expect(result.current.loading).toBe(false);
  });

  it("écrit une valeur guidée et retire une limite automatique", async () => {
    requestMock.mockResolvedValueOnce({ config: {} });
    const { result } = renderHook(() => useCodexGlobalSettings(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    requestMock.mockResolvedValue({ status: "ok" });
    await act(async () => {
      expect(
        await result.current.setAdvanced(
          "default_permissions",
          ":danger-full-access",
        ),
      ).toBe(true);
      expect(
        await result.current.setAdvanced(
          "model_auto_compact_token_limit",
          null,
        ),
      ).toBe(true);
    });

    expect(requestMock).toHaveBeenNthCalledWith(2, "config/value/write", {
      keyPath: "default_permissions",
      mergeStrategy: "upsert",
      value: ":danger-full-access",
    });
    expect(requestMock).toHaveBeenNthCalledWith(3, "config/value/write", {
      keyPath: "model_auto_compact_token_limit",
      mergeStrategy: "replace",
      value: null,
    });
  });

  it("refuse localement un mode exclu par les contraintes", async () => {
    requestMock.mockResolvedValueOnce({ config: { web_search: "cached" } });
    const { result } = renderHook(() =>
      useCodexGlobalSettings(true, ["cached", "disabled"]),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.setMode("live")).toBe(false);
    });
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
