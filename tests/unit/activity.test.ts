import { describe, expect, it } from "vitest";
import { activityFromEvent } from "../../src/lib/activity";
describe("statut agent", () => {
  it.each([
    ["turn/started", undefined, "working"],
    ["item/reasoning/textDelta", undefined, "thinking"],
    ["item/agentMessage/delta", undefined, "talking"],
    ["item/started", "contextCompaction", "compacting"],
    ["item/completed", "contextCompaction", null],
    ["thread/compacted", undefined, null],
    ["item/commandExecution/requestApproval", undefined, "waiting"],
    ["thread/realtime/started", undefined, "listening"],
    ["thread/realtime/closed", undefined, null],
    ["thread/realtime/error", undefined, null],
    ["item/started", "commandExecution", "working"],
    ["turn/completed", undefined, null],
  ])("mappe %s", (method, item, expected) =>
    expect(
      activityFromEvent(method as string, item as string | undefined),
    ).toBe(expected),
  );
});
