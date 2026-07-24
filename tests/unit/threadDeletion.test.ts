import { describe, expect, it } from "vitest";
import {
  removeDeletedThread,
  removeDeletedThreadTelemetry,
} from "../../src/lib/threadDeletion";

describe("notifications de suppression de conversations", () => {
  it("retire successivement la conversation et ses branches notifiées", () => {
    const threads = [
      { id: "parent", name: "Parent", cwd: "/project" },
      { id: "child", name: "Branche", cwd: "/project" },
      { id: "other", name: "Autre", cwd: "/other" },
    ];
    const telemetry = {
      parent: { context: { used: 20, window: 100 } },
      child: { context: { used: 10, window: 100 } },
      other: { context: { used: 5, window: 100 } },
    };

    expect(
      removeDeletedThread(removeDeletedThread(threads, "parent"), "child"),
    ).toEqual([{ id: "other", name: "Autre", cwd: "/other" }]);
    expect(
      removeDeletedThreadTelemetry(
        removeDeletedThreadTelemetry(telemetry, "parent"),
        "child",
      ),
    ).toEqual({ other: { context: { used: 5, window: 100 } } });
  });

  it("préserve la référence de télémétrie en l’absence de données associées", () => {
    const telemetry = {};
    expect(removeDeletedThreadTelemetry(telemetry, "deleted")).toBe(telemetry);
  });
});
