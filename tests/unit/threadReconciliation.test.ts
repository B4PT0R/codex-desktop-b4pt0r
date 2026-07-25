import { describe, expect, it } from "vitest";
import {
  markThreadClosed,
  removeThread,
  restoreThread,
} from "../../src/lib/threadReconciliation";

describe("réconciliation multi-client des conversations", () => {
  const threads = [
    { id: "one", name: "Une", status: "active" as const },
    { id: "two", name: "Deux", status: "idle" as const },
  ];

  it("retire une conversation archivée ailleurs", () => {
    expect(removeThread(threads, "one")).toEqual([threads[1]]);
  });

  it("restaure sans doublon une conversation désarchivée ailleurs", () => {
    expect(
      restoreThread(threads, { id: "two", name: "Deux restaurée" }),
    ).toEqual([
      { id: "two", name: "Deux restaurée" },
      { id: "one", name: "Une", status: "active" },
    ]);
  });

  it("marque une conversation déchargée sans la retirer de l’historique", () => {
    expect(markThreadClosed(threads, "one")[0]).toMatchObject({
      id: "one",
      status: "notLoaded",
    });
  });
});
