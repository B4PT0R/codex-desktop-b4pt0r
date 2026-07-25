import { describe, expect, it, vi } from "vitest";
import {
  createRealtimeThread,
  isMissingThreadRolloutError,
} from "../../src/lib/realtimeThread";

const options = {
  parentThreadId: "parent",
  cwd: "/work",
  model: "gpt-5.4",
  permission: ":workspace",
  personality: "friendly" as const,
  approvalPolicy: "on-request" as const,
};

describe("thread éphémère Realtime", () => {
  it("remplace le fork impossible d’un thread vide par un nouveau thread", async () => {
    const fallbackThread = { thread: { id: "realtime" } };
    const request = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("no rollout found for thread id parent"),
      )
      .mockResolvedValueOnce(fallbackThread);

    await expect(createRealtimeThread(request, options)).resolves.toBe(
      fallbackThread,
    );
    expect(request).toHaveBeenNthCalledWith(1, "thread/fork", {
      threadId: "parent",
      cwd: "/work",
      model: "gpt-5.4",
      permissions: ":workspace",
      approvalPolicy: "on-request",
      ephemeral: true,
      excludeTurns: true,
    });
    expect(request).toHaveBeenNthCalledWith(2, "thread/start", {
      cwd: "/work",
      model: "gpt-5.4",
      permissions: ":workspace",
      personality: "friendly",
      approvalPolicy: "on-request",
      ephemeral: true,
    });
  });

  it("ne masque pas les autres échecs du fork", async () => {
    const error = new Error("connection closed");
    const request = vi.fn().mockRejectedValue(error);

    await expect(createRealtimeThread(request, options)).rejects.toBe(error);
    expect(request).toHaveBeenCalledOnce();
  });

  it("reconnaît uniquement l’erreur d’absence de rollout", () => {
    expect(
      isMissingThreadRolloutError(
        new Error("no rollout found for thread id parent"),
      ),
    ).toBe(true);
    expect(isMissingThreadRolloutError(new Error("connection closed"))).toBe(
      false,
    );
  });
});
