// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { useThreadRuntimeMutations } from "../../src/lib/useThreadRuntimeMutations";
import { useThreadRuntimeState } from "../../src/lib/useThreadRuntimeState";

const initial = {
  approvalPolicy: "on-request" as const,
  collaborationMode: "default" as const,
  effort: "medium",
  model: "gpt-default",
  permission: ":workspace" as const,
  personality: "pragmatic" as const,
  serviceTier: null,
};

function deferred<T>() {
  let reject!: (error: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

describe("mutations des réglages effectifs du thread", () => {
  beforeEach(() => requestMock.mockReset());

  it("applique puis persiste un choix avec le payload protocolaire ciblé", async () => {
    requestMock.mockResolvedValue({});
    const onError = vi.fn();
    const { result } = renderHook(() => {
      const runtime = useThreadRuntimeState(initial);
      const mutations = useThreadRuntimeMutations({
        onError,
        personality: "pragmatic",
        runtime,
        threadId: "thread-1",
      });
      return { mutations, runtime };
    });

    await act(async () => {
      expect(
        await result.current.mutations.changePermission(":danger-full-access"),
      ).toBe(true);
    });

    expect(result.current.runtime.permission).toBe(":danger-full-access");
    expect(requestMock).toHaveBeenCalledWith("thread/settings/update", {
      threadId: "thread-1",
      permissions: ":danger-full-access",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignore l’échec tardif d’un choix remplacé par une écriture plus récente", async () => {
    const firstWrite = deferred<unknown>();
    requestMock
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValueOnce({});
    const onError = vi.fn();
    const { result } = renderHook(() => {
      const runtime = useThreadRuntimeState(initial);
      return {
        mutations: useThreadRuntimeMutations({
          onError,
          runtime,
          threadId: "thread-1",
        }),
        runtime,
      };
    });

    let firstResult!: Promise<boolean>;
    act(() => {
      firstResult =
        result.current.mutations.changePermission(":danger-full-access");
    });
    await act(async () => {
      expect(
        await result.current.mutations.changePermission(":read-only"),
      ).toBe(true);
    });
    await act(async () => {
      firstWrite.reject(new Error("stale failure"));
      expect(await firstResult).toBe(false);
    });

    expect(result.current.runtime.permission).toBe(":read-only");
    expect(onError).not.toHaveBeenCalled();
  });

  it("isole les écritures optimistes lors d’un changement de conversation", async () => {
    const firstWrite = deferred<unknown>();
    requestMock
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValueOnce({});
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      ({ threadId }: { threadId: string }) => {
        const runtime = useThreadRuntimeState(initial);
        return {
          mutations: useThreadRuntimeMutations({
            onError,
            runtime,
            threadId,
          }),
          runtime,
        };
      },
      { initialProps: { threadId: "thread-1" } },
    );

    let firstResult!: Promise<boolean>;
    act(() => {
      firstResult =
        result.current.mutations.changePermission(":danger-full-access");
    });
    rerender({ threadId: "thread-2" });
    await act(async () => {
      expect(
        await result.current.mutations.changePermission(":read-only"),
      ).toBe(true);
    });
    await act(async () => {
      firstWrite.reject(new Error("old thread failure"));
      expect(await firstResult).toBe(false);
    });

    expect(requestMock).toHaveBeenNthCalledWith(2, "thread/settings/update", {
      threadId: "thread-2",
      permissions: ":read-only",
    });
    expect(result.current.runtime.permission).toBe(":read-only");
    expect(onError).not.toHaveBeenCalled();
  });
});
