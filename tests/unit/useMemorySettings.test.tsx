// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
}));

import { useMemorySettings } from "../../src/lib/useMemorySettings";

beforeEach(() => requestMock.mockReset());

describe("réglages globaux de mémoire", () => {
  it("hydrate les valeurs Codex et écrit un contrôle ciblé", async () => {
    requestMock.mockResolvedValueOnce({
      config: {
        features: { memories: true },
        memories: {
          disable_on_external_context: true,
          generate_memories: false,
          min_rate_limit_remaining_percent: 40,
          use_memories: true,
        },
      },
    });
    const { result } = renderHook(() => useMemorySettings(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.enabled).toBe(true);
    expect(result.current.generateMemories).toBe(false);
    expect(result.current.disableOnExternalContext).toBe(true);
    expect(result.current.minRateLimitRemainingPercent).toBe(40);

    requestMock.mockResolvedValueOnce({});
    await act(async () => {
      expect(await result.current.setGenerateMemories(true)).toBe(true);
    });
    expect(requestMock).toHaveBeenLastCalledWith("config/value/write", {
      keyPath: "memories.generate_memories",
      mergeStrategy: "upsert",
      value: true,
    });
  });

  it("réinitialise la mémoire par la requête expérimentale dédiée", async () => {
    requestMock.mockResolvedValueOnce({ config: {} });
    const { result } = renderHook(() => useMemorySettings(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    requestMock.mockResolvedValueOnce({});
    await act(async () => {
      expect(await result.current.reset()).toBe(true);
    });
    expect(requestMock).toHaveBeenLastCalledWith("memory/reset");
  });

  it("ne laisse pas une hydratation obsolète annuler une écriture", async () => {
    const hydration =
      deferred<{ config: { features: { memories: boolean } } }>();
    requestMock.mockImplementation((method: string) =>
      method === "config/read" ? hydration.promise : Promise.resolve({}),
    );
    const { result } = renderHook(() => useMemorySettings(true));
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      expect(await result.current.setEnabled(true)).toBe(true);
    });
    expect(result.current.enabled).toBe(true);
    expect(result.current.loading).toBe(false);

    hydration.resolve({ config: { features: { memories: false } } });
    await act(async () => hydration.promise);

    expect(result.current.enabled).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("refuse deux réinitialisations dans le même rendu", async () => {
    const pending = deferred<Record<string, never>>();
    requestMock
      .mockResolvedValueOnce({ config: {} })
      .mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useMemorySettings(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.reset();
      expect(await result.current.reset()).toBe(false);
    });
    expect(
      requestMock.mock.calls.filter(([method]) => method === "memory/reset"),
    ).toHaveLength(1);

    pending.resolve({});
    await act(async () => expect(await first).toBe(true));
    expect(result.current.resetting).toBe(false);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
