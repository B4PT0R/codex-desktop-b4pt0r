// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));

import { useThreadGoal } from "../../src/lib/useThreadGoal";

const goal = {
  threadId: "thread-1",
  objective: "Stabiliser le client",
  status: "active",
  tokenBudget: 50_000,
  tokensUsed: 1_200,
  timeUsedSeconds: 90,
  createdAt: 1,
  updatedAt: 2,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockReset().mockReturnValue(vi.fn());
});

describe("objectif persistant du thread", () => {
  it("charge, met à jour et suit les notifications", async () => {
    requestMock.mockImplementation((method: string) => {
      if (method === "thread/goal/get") return Promise.resolve({ goal });
      return Promise.resolve({ goal: { ...goal, status: "paused" } });
    });
    const { result } = renderHook(() => useThreadGoal(true, "thread-1"));
    await waitFor(() => expect(result.current.goal).toEqual(goal));
    expect(requestMock).toHaveBeenCalledWith("thread/goal/get", {
      threadId: "thread-1",
    });
    await act(() => result.current.setPaused(true));
    expect(requestMock).toHaveBeenLastCalledWith("thread/goal/set", {
      threadId: "thread-1",
      status: "paused",
    });
    expect(result.current.goal?.status).toBe("paused");

    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "thread/goal/updated",
        params: { threadId: "thread-1", goal: { ...goal, tokensUsed: 2_000 } },
      }),
    );
    expect(result.current.goal?.tokensUsed).toBe(2_000);
    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "thread/goal/cleared",
        params: { threadId: "thread-1" },
      }),
    );
    expect(result.current.goal).toBeNull();
  });

  it("rejette les objectifs malformés à la frontière", async () => {
    requestMock.mockResolvedValue({ goal: { ...goal, tokensUsed: -1 } });
    const { result } = renderHook(() => useThreadGoal(true, "thread-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.goal).toBeNull();
  });

  it("n’envoie pas deux mutations concurrentes", async () => {
    const mutation = deferred<{ goal: typeof goal }>();
    requestMock
      .mockResolvedValueOnce({ goal })
      .mockReturnValueOnce(mutation.promise);
    const { result } = renderHook(() => useThreadGoal(true, "thread-1"));
    await waitFor(() => expect(result.current.goal).toEqual(goal));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.setPaused(true);
      second = result.current.setPaused(true);
    });
    expect(requestMock).toHaveBeenCalledTimes(2);
    await expect(second).resolves.toBe(false);
    mutation.resolve({ goal: { ...goal, status: "paused" } });
    await act(() => first);
  });

  it("ignore une relecture devenue obsolète après une mutation", async () => {
    const refresh = deferred<{ goal: typeof goal }>();
    requestMock
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValueOnce({ goal: { ...goal, status: "paused" } });
    const { result } = renderHook(() => useThreadGoal(true, "thread-1"));

    await act(() => result.current.setPaused(true));
    expect(result.current.goal?.status).toBe("paused");

    refresh.resolve({ goal });
    await act(async () => refresh.promise);

    expect(result.current.goal?.status).toBe("paused");
  });

  it("isole une mutation tardive du thread suivant", async () => {
    const oldMutation = deferred<{ goal: typeof goal }>();
    const nextGoal = {
      ...goal,
      threadId: "thread-2",
      objective: "Continuer ailleurs",
    };
    requestMock
      .mockResolvedValueOnce({ goal })
      .mockReturnValueOnce(oldMutation.promise)
      .mockResolvedValueOnce({ goal: nextGoal })
      .mockResolvedValueOnce({
        goal: { ...nextGoal, status: "paused" },
      });
    const { result, rerender } = renderHook(
      ({ threadId }) => useThreadGoal(true, threadId),
      { initialProps: { threadId: "thread-1" } },
    );
    await waitFor(() => expect(result.current.goal).toEqual(goal));

    let first!: Promise<boolean>;
    act(() => {
      first = result.current.setPaused(true);
    });
    expect(result.current.saving).toBe(true);

    rerender({ threadId: "thread-2" });
    await waitFor(() => expect(result.current.goal).toEqual(nextGoal));
    expect(result.current.saving).toBe(false);
    await act(() => result.current.setPaused(true));
    expect(result.current.goal).toEqual({ ...nextGoal, status: "paused" });

    oldMutation.resolve({ goal: { ...goal, status: "paused" } });
    await expect(first).resolves.toBe(false);
    expect(result.current.goal).toEqual({ ...nextGoal, status: "paused" });
    expect(result.current.saving).toBe(false);
  });
});
