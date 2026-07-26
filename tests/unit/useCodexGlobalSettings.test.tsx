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

describe("réglage global de recherche web", () => {
  it("hydrate la valeur utilisateur puis l'écrit via App Server", async () => {
    requestMock.mockResolvedValueOnce({
      config: {
        file_opener: "cursor",
        model_verbosity: "high",
        model_reasoning_summary: "detailed",
        plan_mode_reasoning_effort: "xhigh",
        web_search: "indexed",
      },
    });
    const { result } = renderHook(() => useCodexGlobalSettings(true));

    await waitFor(() => expect(result.current.mode).toBe("indexed"));
    expect(result.current.fileOpener).toBe("cursor");
    expect(result.current.reasoningSummary).toBe("detailed");
    expect(result.current.modelVerbosity).toBe("high");
    expect(result.current.planReasoningEffort).toBe("xhigh");
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
