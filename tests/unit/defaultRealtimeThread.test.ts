import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REALTIME_THREAD_NAME,
  isMissingThreadError,
  resolveDefaultRealtimeThread,
} from "../../src/lib/defaultRealtimeThread";
import { schedulerDynamicTools } from "../../src/lib/schedulerTools";

describe("thread parent Realtime du tray", () => {
  it("reprend le thread configuré sans charger son transcript", async () => {
    const response = {
      thread: { id: "thread-default", name: "Mon contexte" },
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
    expect(request).toHaveBeenCalledOnce();
  });

  it("nomme une ancienne conversation automatique restée sans titre", async () => {
    const response = {
      thread: { id: "thread-default" },
      cwd: "/home/user",
      model: "gpt-5.4",
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce(response)
      .mockResolvedValueOnce({});

    await expect(
      resolveDefaultRealtimeThread(request, {
        threadId: "thread-default",
        home: "/home/user",
        model: "gpt-5.4",
      }),
    ).resolves.toEqual({
      response: {
        ...response,
        thread: {
          ...response.thread,
          name: DEFAULT_REALTIME_THREAD_NAME,
        },
      },
      created: false,
    });
    expect(request).toHaveBeenLastCalledWith("thread/name/set", {
      threadId: "thread-default",
      name: DEFAULT_REALTIME_THREAD_NAME,
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
      .mockResolvedValueOnce(response)
      .mockResolvedValueOnce({});

    await expect(
      resolveDefaultRealtimeThread(request, {
        threadId: "thread-deleted",
        home: "/home/user",
        model: "gpt-5.4",
      }),
    ).resolves.toEqual({
      response: {
        ...response,
        thread: {
          ...response.thread,
          name: DEFAULT_REALTIME_THREAD_NAME,
        },
      },
      created: true,
    });
    expect(request).toHaveBeenNthCalledWith(2, "thread/start", {
      cwd: "/home/user",
      model: "gpt-5.4",
      dynamicTools: schedulerDynamicTools(),
    });
    expect(request).toHaveBeenNthCalledWith(3, "thread/name/set", {
      threadId: "thread-created",
      name: DEFAULT_REALTIME_THREAD_NAME,
    });
  });

  it("supprime le thread vide si son initialisation ne peut pas être terminée", async () => {
    const namingError = new Error("rename unavailable");
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        thread: { id: "thread-incomplete" },
        cwd: "/home/user",
        model: "gpt-5.4",
      })
      .mockRejectedValueOnce(namingError)
      .mockResolvedValueOnce({});

    await expect(
      resolveDefaultRealtimeThread(request, {
        home: "/home/user",
        model: "gpt-5.4",
      }),
    ).rejects.toBe(namingError);
    expect(request).toHaveBeenLastCalledWith("thread/delete", {
      threadId: "thread-incomplete",
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
