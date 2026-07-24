// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const handlers = vi.hoisted(() => new Set<(message: unknown) => void>());
vi.mock("../../src/lib/codex", () => ({
  request: requestMock,
  subscribeAppServerMessages: (handler: (message: unknown) => void) => {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
}));

import { useFileSearch } from "../../src/lib/useFileSearch";

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({});
  handlers.clear();
  vi.stubGlobal("crypto", { randomUUID: () => "search-1" });
});

describe("recherche fuzzy de fichiers", () => {
  it("normalise la session et ignore les résultats obsolètes", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useFileSearch(true, "/work/project"),
    );
    expect(requestMock).toHaveBeenCalledWith("fuzzyFileSearch/sessionStart", {
      sessionId: "search-1",
      roots: ["/work/project"],
    });

    act(() => result.current.search("App"));
    await act(() => vi.advanceTimersByTimeAsync(120));
    expect(requestMock).toHaveBeenCalledWith("fuzzyFileSearch/sessionUpdate", {
      sessionId: "search-1",
      query: "App",
    });
    emit("old", [{ match_type: "file", path: "/old", file_name: "old" }]);
    expect(result.current.results).toEqual([]);

    emit("App", [
      {
        root: "/work/project",
        path: "/work/project/src/App.tsx",
        file_name: "App.tsx",
        match_type: "file",
      },
      {
        root: "/work",
        path: "/work/src",
        file_name: "src",
        match_type: "directory",
      },
    ]);
    expect(result.current.results).toEqual([
      {
        root: "/work/project",
        path: "/work/project/src/App.tsx",
        fileName: "App.tsx",
      },
    ]);

    unmount();
    expect(requestMock).toHaveBeenLastCalledWith(
      "fuzzyFileSearch/sessionStop",
      { sessionId: "search-1" },
    );
    vi.useRealTimers();
  });

  it("rend visible une erreur de démarrage", async () => {
    requestMock.mockRejectedValueOnce(new Error("backend absent"));
    const { result } = renderHook(() => useFileSearch(true, "/work"));
    await waitFor(() => expect(result.current.error).toBe("backend absent"));
  });
});

function emit(query: string, files: unknown[]) {
  act(() => {
    for (const handler of handlers)
      handler({
        method: "fuzzyFileSearch/sessionUpdated",
        params: { sessionId: "search-1", query, files },
      });
  });
}
