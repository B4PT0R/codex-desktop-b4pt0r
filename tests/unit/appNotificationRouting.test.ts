import { describe, expect, it } from "vitest";
import { routeAppNotification } from "../../src/lib/appNotificationRouting";

describe("routeAppNotification", () => {
  it("routes a started turn and clears its previous reroute", () => {
    expect(
      routeAppNotification({
        method: "turn/started",
        params: { threadId: "thread-1", turn: { id: "turn-1" } },
      }),
    ).toMatchObject({
      activity: "working",
      completesTurn: false,
      conversationEvent: true,
      startsTurn: true,
      threadId: "thread-1",
      telemetry: { type: "clearReroute", threadId: "thread-1" },
      turnId: "turn-1",
    });
  });

  it("keeps incomplete global errors out of the active turn lifecycle", () => {
    expect(
      routeAppNotification({
        method: "error",
        params: { willRetry: true },
      }),
    ).toMatchObject({ clearsActivity: false, completesTurn: false });
    expect(
      routeAppNotification({
        method: "error",
        params: { willRetry: false },
      }),
    ).toMatchObject({
      clearsActivity: false,
      completesTurn: false,
      conversationEvent: false,
    });
    expect(
      routeAppNotification({
        method: "error",
        params: { threadId: "thread-1", willRetry: false },
      }),
    ).toMatchObject({
      clearsActivity: true,
      completesTurn: true,
      threadId: "thread-1",
    });
    expect(
      routeAppNotification({
        method: "turn/started",
        params: { turn: { id: "turn-without-thread" } },
      }),
    ).toMatchObject({ startsTurn: false });
  });

  it("normalizes thread updates and ignores incomplete notifications", () => {
    expect(
      routeAppNotification({
        method: "thread/name/updated",
        params: { threadId: "thread-1", threadName: "Renamed" },
      }).thread,
    ).toEqual({
      type: "nameUpdated",
      threadId: "thread-1",
      name: "Renamed",
    });
    expect(
      routeAppNotification({
        method: "thread/name/updated",
        params: { threadName: "Missing id" },
      }).thread,
    ).toBeUndefined();
  });

  it("keeps realtime events out of the ordinary conversation queue", () => {
    expect(
      routeAppNotification({
        method: "thread/realtime/transcript/delta",
      }).conversationEvent,
    ).toBe(false);
  });

  it("normalizes telemetry updates", () => {
    expect(
      routeAppNotification({
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread-1",
          tokenUsage: {
            total: { totalTokens: 10 },
            last: { totalTokens: 4 },
            modelContextWindow: 100,
          },
        },
      }).telemetry,
    ).toMatchObject({
      type: "contextUpdated",
      threadId: "thread-1",
      context: { totalTokens: 10, usedTokens: 4, windowTokens: 100 },
    });
  });
});
