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
});
