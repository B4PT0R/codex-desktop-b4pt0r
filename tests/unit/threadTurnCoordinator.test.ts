import { describe, expect, it, vi } from "vitest";
import { ThreadTurnCoordinator } from "../../src/lib/threadTurnCoordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("coordination des tours par thread", () => {
  it("attend qu’un thread actif redevienne inactif", async () => {
    const coordinator = new ThreadTurnCoordinator();
    const start = vi.fn().mockResolvedValue({ turn: { id: "scheduled-1" } });
    coordinator.observeStatus("thread-1", "active");

    const pending = coordinator.runWhenIdle(
      "thread-1",
      start,
      (result) => result.turn.id,
    );
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    expect(coordinator.queuedCount("thread-1")).toBe(1);

    coordinator.handleMessage({
      method: "thread/status/changed",
      params: { threadId: "thread-1", status: { type: "idle" } },
    });
    await expect(pending).resolves.toEqual({ turn: { id: "scheduled-1" } });
    expect(start).toHaveBeenCalledOnce();
  });

  it("sérialise deux réveils qui ciblent le même thread", async () => {
    const coordinator = new ThreadTurnCoordinator();
    const first = deferred<{ turn: { id: string } }>();
    const firstStart = vi.fn(() => first.promise);
    const secondStart = vi
      .fn()
      .mockResolvedValue({ turn: { id: "scheduled-2" } });

    const firstRun = coordinator.runWhenIdle(
      "thread-1",
      firstStart,
      (result) => result.turn.id,
    );
    const secondRun = coordinator.runWhenIdle(
      "thread-1",
      secondStart,
      (result) => result.turn.id,
    );
    expect(firstStart).toHaveBeenCalledOnce();
    expect(secondStart).not.toHaveBeenCalled();

    first.resolve({ turn: { id: "scheduled-1" } });
    await expect(firstRun).resolves.toEqual({ turn: { id: "scheduled-1" } });
    expect(secondStart).not.toHaveBeenCalled();

    coordinator.handleMessage({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "scheduled-1", status: "completed" },
      },
    });
    await expect(secondRun).resolves.toEqual({ turn: { id: "scheduled-2" } });
    expect(secondStart).toHaveBeenCalledOnce();
  });

  it("laisse deux threads différents travailler en parallèle", async () => {
    const coordinator = new ThreadTurnCoordinator();
    const first = deferred<{ turn: { id: string } }>();
    const second = deferred<{ turn: { id: string } }>();
    const firstStart = vi.fn(() => first.promise);
    const secondStart = vi.fn(() => second.promise);

    const firstRun = coordinator.runWhenIdle(
      "thread-1",
      firstStart,
      (result) => result.turn.id,
    );
    const secondRun = coordinator.runWhenIdle(
      "thread-2",
      secondStart,
      (result) => result.turn.id,
    );
    expect(firstStart).toHaveBeenCalledOnce();
    expect(secondStart).toHaveBeenCalledOnce();

    first.resolve({ turn: { id: "scheduled-1" } });
    second.resolve({ turn: { id: "scheduled-2" } });
    await Promise.all([firstRun, secondRun]);
  });

  it("libère la réservation lorsqu’un démarrage échoue", async () => {
    const coordinator = new ThreadTurnCoordinator();
    const nextStart = vi
      .fn()
      .mockResolvedValue({ turn: { id: "scheduled-2" } });
    const failed = coordinator.runWhenIdle(
      "thread-1",
      async () => {
        throw new Error("start failed");
      },
      (result: { turn: { id: string } }) => result.turn.id,
    );
    const next = coordinator.runWhenIdle(
      "thread-1",
      nextStart,
      (result) => result.turn.id,
    );

    await expect(failed).rejects.toThrow("start failed");
    await expect(next).resolves.toEqual({ turn: { id: "scheduled-2" } });
  });

  it("retient la tâche suivante jusqu’au nettoyage manuel", async () => {
    const coordinator = new ThreadTurnCoordinator();
    const nextStart = vi
      .fn()
      .mockResolvedValue({ turn: { id: "scheduled-2" } });
    await coordinator.runWhenIdle(
      "thread-1",
      async () => ({ turn: { id: "scheduled-1" } }),
      (result) => result.turn.id,
      { manualRelease: true },
    );
    const next = coordinator.runWhenIdle(
      "thread-1",
      nextStart,
      (result) => result.turn.id,
    );

    coordinator.handleMessage({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "scheduled-1", status: "completed" },
      },
    });
    await Promise.resolve();
    expect(nextStart).not.toHaveBeenCalled();

    expect(coordinator.release("thread-1", "scheduled-1")).toBe(true);
    await expect(next).resolves.toEqual({ turn: { id: "scheduled-2" } });
  });
});
