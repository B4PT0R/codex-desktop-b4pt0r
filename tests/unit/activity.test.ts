import { describe, expect, it } from "vitest";
import { activityFromEvent } from "../../src/lib/activity";
describe("statut agent", () => {
  it.each([
    ["turn/started", undefined, "working"],
    ["item/reasoning/textDelta", undefined, "thinking"],
    ["item/agentMessage/delta", undefined, "talking"],
    ["thread/compacted", undefined, "compacting"],
    ["item/commandExecution/requestApproval", undefined, "waiting"],
    ["thread/realtime/started", undefined, "listening"],
    ["item/started", "commandExecution", "working"],
    ["turn/completed", undefined, null],
  ])("mappe %s", (method, item, expected) =>
    expect(
      activityFromEvent(method as string, item as string | undefined),
    ).toBe(expected),
  );
});
