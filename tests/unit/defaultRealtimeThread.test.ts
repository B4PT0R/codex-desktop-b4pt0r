import { describe, expect, it, vi } from "vitest";
import {
  isMissingThreadError,
  resolveDefaultRealtimeThread,
} from "../../src/lib/defaultRealtimeThread";
import { schedulerDynamicTools } from "../../src/lib/schedulerTools";

describe("thread parent Realtime du tray", () => {
  it("reprend le thread configuré sans charger son transcript", async () => {
    const response = {
      thread: { id: "thread-default" },
      cwd: "/home/user",
      model: "gpt-5.4",
    };
    const request = vi.fn().mockResolvedValue(response);

    await expect(
      resolveDefaultRealtimeThread(request, {
        threadId: "thread-default",
        home: "/home/user",
        model: "gpt-5.4",
      }),
    ).resolves.toEqual({ response, created: false });
    expect(request).toHaveBeenCalledWith("thread/resume", {
      threadId: "thread-default",
      excludeTurns: true,
    });
  });

  it("crée un thread persistant à la racine utilisateur si nécessaire", async () => {
    const response = {
      thread: { id: "thread-created" },
      cwd: "/home/user",
      model: "gpt-5.4",
    };
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("thread not found"))
      .mockResolvedValueOnce(response);

    await expect(
      resolveDefaultRealtimeThread(request, {
        threadId: "thread-deleted",
        home: "/home/user",
        model: "gpt-5.4",
      }),
    ).resolves.toEqual({ response, created: true });
    expect(request).toHaveBeenNthCalledWith(2, "thread/start", {
      cwd: "/home/user",
      model: "gpt-5.4",
      dynamicTools: schedulerDynamicTools(),
    });
  });

  it("ne crée pas de doublon après une erreur transitoire", async () => {
    const error = new Error("connection closed");
    const request = vi.fn().mockRejectedValue(error);
    await expect(
      resolveDefaultRealtimeThread(request, {
        threadId: "thread-default",
        home: "/home/user",
        model: "gpt-5.4",
      }),
    ).rejects.toBe(error);
    expect(request).toHaveBeenCalledOnce();
  });

  it("reconnaît uniquement les erreurs de thread absent", () => {
    expect(isMissingThreadError(new Error("unknown thread: abc"))).toBe(true);
    expect(isMissingThreadError(new Error("permission denied"))).toBe(false);
  });
});
