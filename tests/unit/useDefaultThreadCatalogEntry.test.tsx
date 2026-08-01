// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { ThreadSummary } from "../../src/types";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { useDefaultThreadCatalogEntry } from "../../src/lib/useDefaultThreadCatalogEntry";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function useHarness(initialThreads: ThreadSummary[] = []) {
  const [threads, setThreads] = useState(initialThreads);
  useDefaultThreadCatalogEntry({
    connected: true,
    defaultThreadId: "thread-default",
    setThreads,
    threads,
  });
  return { setThreads, threads };
}

describe("catalogue de la conversation par défaut", () => {
  beforeEach(() => {
    requestMock.mockReset().mockResolvedValue({
      thread: {
        id: "thread-default",
        name: "Mon titre conservé",
        preview: "Dernier échange",
        cwd: "/home/user",
      },
    });
  });

  it("résout le titre serveur absent de la page récente sans le modifier", async () => {
    const { result } = renderHook(() => useHarness());

    await waitFor(() =>
      expect(result.current.threads).toEqual([
        {
          id: "thread-default",
          name: "Mon titre conservé",
          preview: "Dernier échange",
          cwd: "/home/user",
          section: undefined,
          status: undefined,
          updatedAt: undefined,
        },
      ]),
    );
    expect(requestMock).toHaveBeenCalledOnce();
    expect(requestMock).toHaveBeenCalledWith("thread/read", {
      threadId: "thread-default",
      includeTurns: false,
    });
    expect(
      requestMock.mock.calls.some(([method]) => method === "thread/name/set"),
    ).toBe(false);
  });

  it("reste idempotent sur deux démarrages successifs", async () => {
    const first = renderHook(() => useHarness());
    await waitFor(() => expect(first.result.current.threads).toHaveLength(1));
    first.unmount();

    const second = renderHook(() => useHarness());
    await waitFor(() => expect(second.result.current.threads).toHaveLength(1));

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(
      requestMock.mock.calls.map(([method]) => method),
    ).toEqual(["thread/read", "thread/read"]);
  });

  it("relit les métadonnées si le catalogue initial écrase une réponse plus rapide", async () => {
    const { result } = renderHook(() => useHarness());
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    act(() => result.current.setThreads([]));

    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.threads[0]?.name).toBe("Mon titre conservé"),
    );
  });

  it("ignore une ancienne lecture après un aller-retour de sélection", async () => {
    const firstA = deferred<{ thread: Record<string, unknown> }>();
    const threadB = deferred<{ thread: Record<string, unknown> }>();
    const secondA = deferred<{ thread: Record<string, unknown> }>();
    requestMock
      .mockReturnValueOnce(firstA.promise)
      .mockReturnValueOnce(threadB.promise)
      .mockReturnValueOnce(secondA.promise);

    function useChangingDefault(defaultThreadId: string) {
      const [threads, setThreads] = useState<ThreadSummary[]>([]);
      useDefaultThreadCatalogEntry({
        connected: true,
        defaultThreadId,
        setThreads,
        threads,
      });
      return threads;
    }

    const { result, rerender } = renderHook(
      ({ threadId }) => useChangingDefault(threadId),
      { initialProps: { threadId: "thread-a" } },
    );
    rerender({ threadId: "thread-b" });
    rerender({ threadId: "thread-a" });
    expect(requestMock).toHaveBeenCalledTimes(3);

    secondA.resolve({
      thread: {
        id: "thread-a",
        name: "Métadonnées récentes",
        cwd: "/recent",
      },
    });
    await act(async () => secondA.promise);
    await waitFor(() =>
      expect(result.current[0]?.name).toBe("Métadonnées récentes"),
    );

    firstA.resolve({
      thread: {
        id: "thread-a",
        name: "Métadonnées obsolètes",
        cwd: "/old",
      },
    });
    await act(async () => firstA.promise);
    expect(result.current[0]?.name).toBe("Métadonnées récentes");
  });
});
