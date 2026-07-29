// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { useBackgroundTerminals } from "../../src/lib/useBackgroundTerminals";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => requestMock.mockReset());

describe("terminaux en arrière-plan", () => {
  it("normalise la liste paginée puis arrête un processus", async () => {
    requestMock
      .mockResolvedValueOnce({
        data: [
          {
            itemId: "item-1",
            processId: "42",
            command: "python3 -m http.server",
            cwd: "/work/app",
            osPid: 1234,
            cpuPercent: 1.25,
            rssKb: 20_480,
          },
          { processId: "incomplete" },
        ],
        nextCursor: "next",
      })
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({ terminated: true });
    const { result } = renderHook(() =>
      useBackgroundTerminals({
        busy: false,
        connected: true,
        threadId: "thread-1",
      }),
    );

    await waitFor(() => expect(result.current.terminals).toHaveLength(1));
    expect(result.current.terminals[0]).toEqual({
      itemId: "item-1",
      processId: "42",
      command: "python3 -m http.server",
      cwd: "/work/app",
      osPid: 1234,
      cpuPercent: 1.25,
      rssKb: 20_480,
    });
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      "thread/backgroundTerminals/list",
      { threadId: "thread-1", cursor: "next", limit: 50 },
    );

    await act(() => result.current.terminate("42"));
    expect(requestMock).toHaveBeenLastCalledWith(
      "thread/backgroundTerminals/terminate",
      { threadId: "thread-1", processId: "42" },
    );
    expect(result.current.terminals).toEqual([]);
  });

  it("détecte les terminaux pendant un tour actif", async () => {
    requestMock
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({
        data: [
          {
            itemId: "dev-server",
            processId: "7",
            command: "npm run dev",
            cwd: "/work/app",
          },
        ],
        nextCursor: null,
      });
    const { result, rerender } = renderHook(
      ({ busy }) =>
        useBackgroundTerminals({
          busy,
          connected: true,
          threadId: "thread-1",
        }),
      { initialProps: { busy: true } },
    );
    await waitFor(() => expect(requestMock).toHaveBeenCalledOnce());
    rerender({ busy: false });
    await waitFor(() => expect(result.current.terminals).toHaveLength(1));
    expect(result.current.terminals[0].itemId).toBe("dev-server");
  });

  it("n’envoie pas deux arrêts concurrents pour le même processus", async () => {
    const termination = deferred<{ terminated: boolean }>();
    requestMock
      .mockResolvedValueOnce({
        data: [
          {
            itemId: "item-1",
            processId: "42",
            command: "sleep 30",
            cwd: "/work/app",
          },
        ],
        nextCursor: null,
      })
      .mockReturnValueOnce(termination.promise);
    const { result } = renderHook(() =>
      useBackgroundTerminals({
        busy: false,
        connected: true,
        threadId: "thread-1",
      }),
    );
    await waitFor(() => expect(result.current.terminals).toHaveLength(1));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.terminate("42");
      second = result.current.terminate("42");
    });
    expect(requestMock).toHaveBeenCalledTimes(2);
    await expect(second).resolves.toBe(false);
    termination.resolve({ terminated: true });
    await act(() => first);
  });

  it("ignore une liste tardive après déconnexion et repart proprement", async () => {
    const stale = deferred<{
      data: Array<Record<string, string>>;
      nextCursor: null;
    }>();
    requestMock
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({
        data: [
          {
            itemId: "fresh-server",
            processId: "8",
            command: "npm run preview",
            cwd: "/work/fresh",
          },
        ],
        nextCursor: null,
      });
    const { result, rerender } = renderHook(
      ({ connected }) =>
        useBackgroundTerminals({
          busy: false,
          connected,
          threadId: "thread-1",
        }),
      { initialProps: { connected: true } },
    );
    await waitFor(() => expect(requestMock).toHaveBeenCalledOnce());

    rerender({ connected: false });
    expect(result.current.terminals).toEqual([]);
    rerender({ connected: true });
    await waitFor(() =>
      expect(result.current.terminals[0]?.itemId).toBe("fresh-server"),
    );

    stale.resolve({
      data: [
        {
          itemId: "stale-server",
          processId: "7",
          command: "npm run old",
          cwd: "/work/old",
        },
      ],
      nextCursor: null,
    });
    await act(async () => {
      await stale.promise;
    });
    expect(result.current.terminals[0]?.itemId).toBe("fresh-server");
  });
});
