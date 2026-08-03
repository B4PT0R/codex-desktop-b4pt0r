// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscription = vi.hoisted(() => ({
  handler: undefined as
    | ((message: { method?: string; params?: unknown }) => void)
    | undefined,
}));

vi.mock("../../src/lib/codex", () => ({
  request: requestMock,
  subscribeAppServerMessages: vi.fn(
    (handler: (message: { method?: string; params?: unknown }) => void) => {
      subscription.handler = handler;
      return () => {
        subscription.handler = undefined;
      };
    },
  ),
}));

import { useAutoReviewDenials } from "../../src/lib/useAutoReviewDenials";

beforeEach(() => {
  requestMock.mockReset();
  subscription.handler = undefined;
});

describe("refus de relecture automatique", () => {
  it("isole les refus par thread et injecte une autorisation précise", async () => {
    requestMock.mockResolvedValue({});
    const { result } = renderHook(() => useAutoReviewDenials());

    act(() => {
      subscription.handler?.({
        method: "item/autoApprovalReview/completed",
        params: {
          threadId: "thread-1",
          reviewId: "review-1",
          review: { status: "denied", rationale: "Needs user approval" },
          action: {
            type: "command",
            command: "git push",
            cwd: "/work/repo",
            source: "shell",
          },
        },
      });
    });

    expect(result.current.forThread("thread-2")).toEqual([]);
    expect(result.current.forThread("thread-1")).toMatchObject([
      { id: "review-1", action: { command: "git push" } },
    ]);

    await act(() => result.current.approve("thread-1", "review-1"));

    expect(requestMock).toHaveBeenCalledWith(
      "thread/inject_items",
      expect.objectContaining({
        threadId: "thread-1",
        items: [
          expect.objectContaining({
            role: "developer",
            type: "message",
          }),
        ],
      }),
    );
    const params = requestMock.mock.calls[0][1];
    expect(params.items[0].content[0].text).toContain(
      "The user has manually approved a specific action",
    );
    expect(params.items[0].content[0].text).toContain('"command": "git push"');
    expect(result.current.forThread("thread-1")).toEqual([]);
  });

  it("ignore les décisions qui ne sont pas des refus", () => {
    const { result } = renderHook(() => useAutoReviewDenials());
    act(() => {
      subscription.handler?.({
        method: "item/autoApprovalReview/completed",
        params: {
          threadId: "thread-1",
          reviewId: "review-1",
          review: { status: "approved" },
          action: { type: "command", command: "pwd" },
        },
      });
    });
    expect(result.current.forThread("thread-1")).toEqual([]);
  });

  it("conserve deux refus de même identifiant appartenant à des threads distincts", () => {
    const { result } = renderHook(() => useAutoReviewDenials());
    act(() => {
      emitDenial("thread-1", "review-1", "git push origin one");
      emitDenial("thread-2", "review-1", "git push origin two");
    });

    expect(result.current.forThread("thread-1")).toMatchObject([
      { action: { command: "git push origin one" } },
    ]);
    expect(result.current.forThread("thread-2")).toMatchObject([
      { action: { command: "git push origin two" } },
    ]);
  });

  it("refuse deux injections concurrentes pour la même autorisation", async () => {
    const injection = deferred<Record<string, never>>();
    requestMock.mockReturnValueOnce(injection.promise);
    const { result } = renderHook(() => useAutoReviewDenials());
    act(() => emitDenial("thread-1", "review-1", "git push"));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.approve("thread-1", "review-1");
      second = result.current.approve("thread-1", "review-1");
    });

    await expect(second).resolves.toBe(false);
    expect(requestMock).toHaveBeenCalledOnce();
    injection.resolve({});
    await act(async () => expect(await first).toBe(true));
    expect(result.current.forThread("thread-1")).toEqual([]);
  });
});

function emitDenial(threadId: string, reviewId: string, command: string) {
  subscription.handler?.({
    method: "item/autoApprovalReview/completed",
    params: {
      threadId,
      reviewId,
      review: { status: "denied", rationale: "Needs user approval" },
      action: { type: "command", command, cwd: "/work/repo", source: "shell" },
    },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
