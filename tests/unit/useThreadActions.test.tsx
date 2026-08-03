// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../../src/lib/codex";
import { useThreadActions } from "../../src/lib/useThreadActions";
import type { ThreadSummary } from "../../src/types";
import { ThreadTurnCoordinator } from "../../src/lib/threadTurnCoordinator";

vi.mock("../../src/lib/codex", () => ({ request: vi.fn() }));
const localeState = vi.hoisted(() => ({ current: "fr" as "fr" | "en" }));
vi.mock("../../src/i18n/I18nProvider", async () => {
  const { translate } = await import("../../src/i18n/translate");
  return {
    useI18n: () => ({
      locale: localeState.current,
      setLocale: vi.fn(),
      t: (key: Parameters<typeof translate>[1]) =>
        translate(localeState.current, key),
    }),
  };
});

const mockedRequest = vi.mocked(request);
const initialThreads: ThreadSummary[] = [
  { id: "thread-1", name: "Original", cwd: "/project" },
  { id: "thread-2", name: "Autre", cwd: "/project" },
];

function useHarness() {
  const [threads, setThreads] = useState(initialThreads);
  const [busy, setBusy] = useState(false);
  const callbacks = useRef({
    onActiveThreadRemoved: vi.fn(),
    onError: vi.fn(),
    onForked: vi.fn().mockResolvedValue(undefined),
  }).current;
  const actions = useThreadActions({
    activeThreadId: "thread-1",
    busy,
    threads,
    setBusy,
    setThreads,
    turnCoordinator: new ThreadTurnCoordinator(),
    ...callbacks,
  });
  return { actions, busy, ...callbacks, threads };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockedRequest.mockReset();
  localeState.current = "fr";
});

describe("actions de conversation", () => {
  it("épingle une conversation avec l’état autoritatif du serveur", async () => {
    mockedRequest.mockResolvedValueOnce({
      thread: {
        id: "thread-1",
        isPinned: true,
        name: "Original",
        cwd: "/project",
      },
    });
    const { result } = renderHook(useHarness);

    await act(async () => {
      expect(
        await result.current.actions.setPinned(result.current.threads[0], true),
      ).toBe(true);
    });

    expect(mockedRequest).toHaveBeenCalledWith("thread/metadata/update", {
      threadId: "thread-1",
      isPinned: true,
    });
    expect(result.current.threads[0]?.isPinned).toBe(true);
  });

  it("conserve l’état local si App Server ne confirme pas l’épinglage", async () => {
    mockedRequest.mockResolvedValueOnce({
      thread: { id: "thread-1", isPinned: false, cwd: "/project" },
    });
    const { result } = renderHook(useHarness);

    await act(async () => {
      expect(
        await result.current.actions.setPinned(result.current.threads[0], true),
      ).toBe(false);
    });

    expect(result.current.threads[0]?.isPinned).toBeUndefined();
    expect(result.current.onError).toHaveBeenCalledWith(
      "Impossible de modifier l’épinglage de cette conversation",
      expect.any(Error),
    );
  });

  it("confirme un renommage avec les métadonnées persistées du serveur", async () => {
    mockedRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        thread: {
          id: "thread-1",
          name: "Nouveau titre",
          cwd: "/project",
        },
      });
    const { result } = renderHook(useHarness);

    await act(async () => {
      expect(await result.current.actions.rename("Nouveau titre")).toBe(true);
    });

    expect(mockedRequest).toHaveBeenNthCalledWith(1, "thread/name/set", {
      threadId: "thread-1",
      name: "Nouveau titre",
    });
    expect(mockedRequest).toHaveBeenNthCalledWith(2, "thread/read", {
      threadId: "thread-1",
      includeTurns: false,
    });
    expect(result.current.threads[0]?.name).toBe("Nouveau titre");
  });

  it("refuse un succès optimiste si le serveur ne conserve pas le nom", async () => {
    mockedRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        thread: { id: "thread-1", name: null, cwd: "/project" },
      });
    const { result } = renderHook(useHarness);

    await act(async () => {
      expect(await result.current.actions.rename("Nouveau titre")).toBe(false);
    });

    expect(result.current.threads[0]?.name).toBe("Original");
    expect(result.current.onError).toHaveBeenCalledWith(
      "Impossible de renommer cette conversation",
      expect.objectContaining({
        message: "App Server did not persist the conversation name",
      }),
    );
  });

  it("archive puis restaure la conversation à sa position", async () => {
    mockedRequest.mockResolvedValue({});
    const { result } = renderHook(useHarness);

    await act(async () => {
      await result.current.actions.archive("thread-1");
    });
    expect(mockedRequest).toHaveBeenCalledWith("thread/archive", {
      threadId: "thread-1",
    });
    expect(result.current.threads.map((thread) => thread.id)).toEqual([
      "thread-2",
    ]);
    expect(result.current.onActiveThreadRemoved).toHaveBeenCalledOnce();

    await act(() =>
      result.current.actions.unarchive(
        result.current.actions.archivedThreads[0],
      ),
    );
    expect(result.current.threads.map((thread) => thread.id)).toEqual([
      "thread-1",
      "thread-2",
    ]);
  });

  it("archive un résultat global absent de la page récente", async () => {
    mockedRequest.mockResolvedValue({});
    const { result } = renderHook(useHarness);
    const remote = { id: "thread-remote", name: "Ancienne conversation" };

    await act(async () => {
      expect(await result.current.actions.archive(remote.id, remote)).toBe(true);
    });

    expect(mockedRequest).toHaveBeenCalledWith("thread/archive", {
      threadId: "thread-remote",
    });
    expect(result.current.actions.archivedThreads[0]?.thread).toEqual(remote);
  });

  it("crée une branche et l’ouvre", async () => {
    mockedRequest.mockResolvedValueOnce({
      cwd: "/project",
      thread: { id: "thread-fork", name: "Original", cwd: "/project" },
    });
    const { result } = renderHook(useHarness);

    await act(() => result.current.actions.fork());

    expect(mockedRequest).toHaveBeenCalledWith("thread/fork", {
      threadId: "thread-1",
    });
    expect(result.current.threads[0]).toMatchObject({
      id: "thread-fork",
      name: "Original",
    });
    expect(result.current.onForked).toHaveBeenCalledWith("thread-fork");
    expect(result.current.busy).toBe(false);
  });

  it("supprime définitivement la conversation active", async () => {
    mockedRequest.mockResolvedValueOnce({});
    const { result } = renderHook(useHarness);

    await act(() => result.current.actions.deleteThread());

    expect(mockedRequest).toHaveBeenCalledWith("thread/delete", {
      threadId: "thread-1",
    });
    expect(result.current.threads.map((thread) => thread.id)).toEqual([
      "thread-2",
    ]);
    expect(result.current.onActiveThreadRemoved).toHaveBeenCalledOnce();
  });

  it("sérialise les actions incompatibles d’une même conversation", async () => {
    const deletion = deferred<Record<string, never>>();
    mockedRequest.mockReturnValueOnce(deletion.promise);
    const { result } = renderHook(useHarness);

    let deleting!: Promise<boolean>;
    let archiving!: Promise<boolean>;
    act(() => {
      deleting = result.current.actions.deleteThread();
      archiving = result.current.actions.archive("thread-1");
    });

    await expect(archiving).resolves.toBe(false);
    expect(mockedRequest).toHaveBeenCalledOnce();
    expect(mockedRequest).toHaveBeenCalledWith("thread/delete", {
      threadId: "thread-1",
    });

    deletion.resolve({});
    await act(async () => expect(await deleting).toBe(true));
  });

  it("rend l’échec d’une branche visible et rétablit l’état", async () => {
    mockedRequest.mockRejectedValueOnce(new Error("fork refusé"));
    const { result } = renderHook(useHarness);

    await act(() => result.current.actions.fork());

    expect(result.current.onError).toHaveBeenCalledWith(
      "Impossible de créer une branche de cette conversation",
      expect.any(Error),
    );
    expect(result.current.busy).toBe(false);
  });

  it("rend les erreurs d’action dans la langue anglaise active", async () => {
    localeState.current = "en";
    mockedRequest.mockRejectedValue(new Error("backend unavailable"));
    const { result } = renderHook(useHarness);

    await act(() => result.current.actions.archive("thread-1"));
    expect(result.current.onError).toHaveBeenLastCalledWith(
      "Unable to archive this conversation",
      expect.any(Error),
    );

    await act(async () => {
      await result.current.actions.rename("Renamed");
    });
    expect(result.current.onError).toHaveBeenLastCalledWith(
      "Unable to rename this conversation",
      expect.any(Error),
    );

    await act(async () => {
      await result.current.actions.compact();
    });
    expect(result.current.onError).toHaveBeenLastCalledWith(
      "Unable to compact this conversation",
      expect.any(Error),
    );

    await act(async () => {
      await result.current.actions.deleteThread();
    });
    expect(result.current.onError).toHaveBeenLastCalledWith(
      "Unable to delete this conversation",
      expect.any(Error),
    );
  });
});
