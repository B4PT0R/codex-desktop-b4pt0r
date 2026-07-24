import { describe, expect, it } from "vitest";
import { threadStatusFromValue } from "../../src/lib/threadLifecycle";

describe("cycle de vie des threads", () => {
  it.each(["notLoaded", "idle", "active", "systemError"] as const)(
    "normalise le statut %s",
    (type) => expect(threadStatusFromValue({ type })).toBe(type),
  );

  it("ignore les statuts inconnus ou mal formés", () => {
    expect(threadStatusFromValue({ type: "futureStatus" })).toBeUndefined();
    expect(threadStatusFromValue("active")).toBeUndefined();
  });
});
