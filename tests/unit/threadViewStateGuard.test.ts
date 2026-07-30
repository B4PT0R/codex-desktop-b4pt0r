import { describe, expect, it } from "vitest";
import { ThreadViewStateGuard } from "../../src/lib/threadViewStateGuard";

const activeRun = {
  activity: "working" as const,
  busy: true,
  status: "active" as const,
  turnId: "turn-live",
};

describe("isolation de l’état visible d’un thread", () => {
  it("applique le snapshot de reprise en l’absence d’événement plus récent", () => {
    const guard = new ThreadViewStateGuard();
    guard.beginResume("thread-live");

    expect(guard.reconcileResume("thread-live", activeRun)).toEqual({
      activity: "working",
      busy: true,
      turnId: "turn-live",
    });
  });

  it("préserve chaque champ modifié pendant la reprise", () => {
    const guard = new ThreadViewStateGuard();
    guard.beginResume("thread-live");
    guard.observe("activity");

    expect(guard.reconcileResume("thread-live", activeRun)).toEqual({
      busy: true,
      turnId: "turn-live",
    });
  });

  it("ignore une réponse obsolète ou annulée", () => {
    const guard = new ThreadViewStateGuard();
    guard.beginResume("thread-old");
    guard.beginResume("thread-new");

    expect(guard.reconcileResume("thread-old", activeRun)).toEqual({});
    guard.failResume("thread-new");
    expect(guard.reconcileResume("thread-new", activeRun)).toEqual({});
  });
});
