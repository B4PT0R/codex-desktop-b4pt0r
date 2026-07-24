// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { I18nProvider } from "../../src/i18n/I18nProvider";
import { useThreadSearch } from "../../src/lib/useThreadSearch";

beforeEach(() => {
  requestMock.mockReset();
  localStorage.setItem("codex-desktop.locale", "fr");
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("recherche globale de conversations", () => {
  it("diffère la recherche, normalise les extraits et pagine", async () => {
    requestMock
      .mockResolvedValueOnce({
        data: [
          {
            thread: { id: "thread-1", name: "Navigation", cwd: "/work" },
            snippet: "  Corriger\n la   navigation  ",
          },
        ],
        nextCursor: "next",
      })
      .mockResolvedValueOnce({
        data: [{ thread: { id: "thread-2", preview: "Autre résultat" } }],
        nextCursor: null,
      });
    const { result } = renderHook(() => useThreadSearch(true), {
      wrapper: I18nProvider,
    });

    act(() => result.current.setQuery("navigation"));
    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(requestMock).toHaveBeenCalledWith("thread/search", {
      searchTerm: "navigation",
      cursor: null,
      limit: 50,
      sortKey: "updated_at",
      sortDirection: "desc",
    });
    expect(result.current.results[0]).toEqual(
      expect.objectContaining({
        id: "thread-1",
        searchSnippet: "Corriger la navigation",
      }),
    );
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.results).toHaveLength(2));
    expect(requestMock).toHaveBeenLastCalledWith(
      "thread/search",
      expect.objectContaining({ cursor: "next" }),
    );
  });

  it("ignore une réponse obsolète et permet de retirer un résultat", async () => {
    let resolveOld: ((value: unknown) => void) | undefined;
    requestMock
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveOld = resolve)),
      )
      .mockResolvedValueOnce({
        data: [{ thread: { id: "fresh", name: "Fresh" }, snippet: "new" }],
        nextCursor: null,
      });
    const { result } = renderHook(() => useThreadSearch(true), {
      wrapper: I18nProvider,
    });
    act(() => result.current.setQuery("old"));
    await waitFor(() => expect(requestMock).toHaveBeenCalledOnce());
    act(() => result.current.setQuery("fresh"));
    await waitFor(() => expect(result.current.results[0]?.id).toBe("fresh"));
    await act(async () => resolveOld?.({
      data: [{ thread: { id: "stale" }, snippet: "old" }],
    }));
    expect(result.current.results.map((thread) => thread.id)).toEqual(["fresh"]);
    act(() => result.current.remove("fresh"));
    expect(result.current.results).toEqual([]);
  });

  it("conserve une erreur visible et bornée au parcours", async () => {
    requestMock.mockRejectedValue(new Error("méthode indisponible"));
    const { result } = renderHook(() => useThreadSearch(true), {
      wrapper: I18nProvider,
    });
    act(() => result.current.setQuery("test"));
    await waitFor(() =>
      expect(result.current.error).toContain("méthode indisponible"),
    );
  });

  it("ignore deux demandes de page synchrones", async () => {
    const page = deferred<{ data: []; nextCursor: null }>();
    requestMock
      .mockResolvedValueOnce({
        data: [{ thread: { id: "thread-1" } }],
        nextCursor: "next",
      })
      .mockReturnValueOnce(page.promise);
    const { result } = renderHook(() => useThreadSearch(true), {
      wrapper: I18nProvider,
    });
    act(() => result.current.setQuery("navigation"));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(requestMock).toHaveBeenCalledTimes(2);
    page.resolve({ data: [], nextCursor: null });
    await act(async () => page.promise);
  });
});
