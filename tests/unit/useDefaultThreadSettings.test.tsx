// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/desktopSettings", () => ({
  loadDesktopSettings: loadMock,
  updateDesktopSettings: updateMock,
}));

import { useDefaultThreadSettings } from "../../src/lib/useDefaultThreadSettings";

beforeEach(() => {
  loadMock.mockReset().mockResolvedValue({
    version: 1,
    defaultThreadId: "thread-a",
  });
  updateMock.mockReset().mockResolvedValue({
    version: 1,
    defaultThreadId: "thread-b",
  });
});

describe("thread par défaut", () => {
  it("charge et remplace le thread persistant partagé par les fonctionnalités", async () => {
    const threads = [
      { id: "thread-a", name: "Voice context", cwd: "/home/user" },
      { id: "thread-b", name: "Another thread", cwd: "/work" },
    ];
    const { result } = renderHook(() => useDefaultThreadSettings(threads));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.defaultThreadId).toBe("thread-a"));
    expect(result.current.loading).toBe(false);
    await act(() => result.current.setDefaultThreadId("thread-b"));

    expect(result.current.defaultThreadId).toBe("thread-b");
    expect(result.current.threadOptions).toBe(threads);
    expect(updateMock).toHaveBeenCalledWith({ defaultThreadId: "thread-b" });
  });

  it("rétablit la valeur précédente si la persistance échoue", async () => {
    updateMock.mockRejectedValue(new Error("write denied"));
    const { result } = renderHook(() => useDefaultThreadSettings([]));
    await waitFor(() => expect(result.current.defaultThreadId).toBe("thread-a"));

    await act(() => result.current.setDefaultThreadId("thread-b"));

    expect(result.current.defaultThreadId).toBe("thread-a");
    expect(result.current.error).toBe("write denied");
  });
});
