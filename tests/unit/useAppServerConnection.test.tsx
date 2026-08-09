// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listen } from "../../src/lib/nativeBridge";
import {
  connect,
  reconnect,
  request,
  restartAppServer,
  type AppServerMessage,
} from "../../src/lib/codex";
import {
  normalizeModels,
  useAppServerConnection,
} from "../../src/lib/useAppServerConnection";
import { threadSummary } from "../../src/lib/threadSummary";

vi.mock("../../src/lib/nativeBridge", () => ({ listen: vi.fn() }));
vi.mock("../../src/lib/codex", () => ({
  connect: vi.fn(),
  isDesktopApp: vi.fn(() => true),
  reconnect: vi.fn(),
  request: vi.fn(),
  restartAppServer: vi.fn(),
}));
vi.mock("../../src/i18n/I18nProvider", async () => {
  const { defaultTranslate } = await import("../../src/i18n/translate");
  return { useI18n: () => ({ t: defaultTranslate }) };
});

const mockedConnect = vi.mocked(connect);
const mockedListen = vi.mocked(listen);
const mockedReconnect = vi.mocked(reconnect);
const mockedRequest = vi.mocked(request);
const mockedRestart = vi.mocked(restartAppServer);
let receiveMessage: ((message: AppServerMessage) => void) | undefined;
let updateConnection: ((connected: boolean, error?: Error) => void) | undefined;

function callbacks() {
  return {
    onDisconnected: vi.fn(),
    onError: vi.fn(),
    onInitialized: vi.fn(),
    onMessage: vi.fn(),
    onNewChat: vi.fn(),
    onRecovered: vi.fn(),
    onThreadsRefreshed: vi.fn(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  receiveMessage = undefined;
  updateConnection = undefined;
  mockedConnect.mockImplementation(async (onMessage, onConnection) => {
    receiveMessage = onMessage;
    updateConnection = onConnection;
    onConnection?.(true);
    return vi.fn();
  });
  mockedListen.mockResolvedValue(vi.fn());
  mockedRequest.mockImplementation(async (method) => {
    if (method === "model/list")
      return {
        data: [
          {
            id: "gpt-test",
            displayName: "GPT Test",
            defaultReasoningEffort: "high",
          },
        ],
      };
    if (method === "thread/list")
      return {
        data: [
          {
            id: "thread-1",
            cwd: "/project",
            status: { type: "idle" },
            turns: [],
          },
        ],
      };
    return {};
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("connexion App Server", () => {
  it("charge toutes les pages de conversations et déduplique les recouvrements", async () => {
    mockedRequest.mockImplementation(async (method, params) => {
      if (method === "model/list") return { data: [] };
      if (
        method === "thread/list" &&
        params &&
        typeof params === "object" &&
        "cursor" in params
      ) {
        return {
          data: [
            {
              id: "thread-overlap",
              cwd: "/project",
            },
            {
              id: "thread-older-pinned",
              isPinned: true,
              cwd: "/older-project",
            },
          ],
          nextCursor: null,
        };
      }
      return {
        data: [
          {
            id: "thread-recent",
            cwd: "/project",
          },
          { id: "thread-overlap", cwd: "/project" },
        ],
        nextCursor: "older-page",
      };
    });
    const options = callbacks();
    renderHook(() => useAppServerConnection(options));

    await waitFor(() => expect(options.onInitialized).toHaveBeenCalledOnce());
    expect(mockedRequest).toHaveBeenNthCalledWith(2, "thread/list", {
      limit: 100,
      sortKey: "updated_at",
    });
    expect(mockedRequest).toHaveBeenNthCalledWith(3, "thread/list", {
      cursor: "older-page",
      limit: 100,
      sortKey: "updated_at",
    });
    expect(options.onInitialized).toHaveBeenCalledWith([], [
      expect.objectContaining({ id: "thread-recent" }),
      expect.objectContaining({ id: "thread-overlap" }),
      expect.objectContaining({ id: "thread-older-pinned", isPinned: true }),
    ]);
  });

  it("arrête une pagination dont le curseur se répète", async () => {
    mockedRequest.mockImplementation(async (method, params) => {
      if (method === "model/list") return { data: [] };
      return {
        data: [{ id: "thread-recent", cwd: "/project" }],
        nextCursor: "same-cursor",
      };
    });
    const options = callbacks();
    renderHook(() => useAppServerConnection(options));

    await waitFor(() => expect(options.onInitialized).toHaveBeenCalledOnce());
    expect(options.onInitialized).toHaveBeenCalledWith([], [
      expect.objectContaining({ id: "thread-recent" }),
    ]);
    expect(mockedRequest).toHaveBeenCalledTimes(3);
  });

  it("charge les catalogues initiaux et utilise les callbacks les plus récents", async () => {
    const first = callbacks();
    const second = callbacks();
    const { result, rerender } = renderHook(
      ({ options }) => useAppServerConnection(options),
      { initialProps: { options: first } },
    );

    await waitFor(() => expect(first.onInitialized).toHaveBeenCalledOnce());
    expect(result.current.connected).toBe(true);
    expect(mockedRequest).toHaveBeenCalledWith("model/list", { limit: 50 });
    expect(mockedRequest).toHaveBeenCalledWith("thread/list", {
      limit: 100,
      sortKey: "updated_at",
    });
    expect(first.onInitialized).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "gpt-test", label: "GPT Test" })],
      [expect.objectContaining({ id: "thread-1", cwd: "/project" })],
    );

    rerender({ options: second });
    act(() => receiveMessage?.({ method: "turn/started" }));
    expect(first.onMessage).not.toHaveBeenCalled();
    expect(second.onMessage).toHaveBeenCalledWith({ method: "turn/started" });
  });

  it("transmet l'action Nouveau chat du tray au propriétaire courant", async () => {
    const options = callbacks();
    renderHook(() => useAppServerConnection(options));
    await waitFor(() => expect(options.onInitialized).toHaveBeenCalledOnce());

    const registration = mockedListen.mock.calls.find(
      ([event]) => event === "new-chat",
    );
    expect(registration).toBeDefined();
    act(() => registration?.[1]());

    expect(options.onNewChat).toHaveBeenCalledOnce();
  });

  it("rafraîchit les conversations créées par un autre client au retour dans la fenêtre", async () => {
    const options = callbacks();
    renderHook(() => useAppServerConnection(options));
    await waitFor(() => expect(options.onInitialized).toHaveBeenCalledOnce());

    mockedRequest.mockImplementation(async (method) => {
      if (method === "thread/list")
        return {
          data: [
            {
              id: "remote-discussion",
              cwd: "/home/user/Documents/Codex/2026-08-05-discussion",
              preview: "Discussion depuis les vacances",
            },
          ],
        };
      return { data: [] };
    });

    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() =>
      expect(options.onThreadsRefreshed).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "remote-discussion",
          preview: "Discussion depuis les vacances",
        }),
      ]),
    );
  });

  it("rend une déconnexion visible et pilote une reconnexion", async () => {
    const options = callbacks();
    let resolveReconnect: (() => void) | undefined;
    mockedReconnect.mockImplementation(
      () => new Promise<void>((resolve) => (resolveReconnect = resolve)),
    );
    const { result } = renderHook(() => useAppServerConnection(options));
    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => updateConnection?.(false, new Error("process exited")));
    expect(result.current.connected).toBe(false);
    expect(options.onDisconnected).toHaveBeenCalledOnce();
    expect(options.onError).toHaveBeenCalledWith(
      "Connexion à Codex interrompue",
      expect.any(Error),
    );

    let reconnecting: Promise<void> | undefined;
    act(() => {
      reconnecting = result.current.reconnect();
    });
    expect(result.current.reconnecting).toBe(true);
    await act(async () => {
      resolveReconnect?.();
      await reconnecting;
    });
    expect(result.current.reconnecting).toBe(false);
  });

  it("redémarre App Server puis recharge ses catalogues", async () => {
    const options = callbacks();
    const { result } = renderHook(() => useAppServerConnection(options));
    await waitFor(() => expect(options.onInitialized).toHaveBeenCalledOnce());
    mockedRequest.mockClear();
    mockedRestart.mockResolvedValue();

    let restarted = false;
    await act(async () => {
      restarted = await result.current.restart();
    });

    expect(restarted).toBe(true);
    expect(mockedRestart).toHaveBeenCalledOnce();
    expect(mockedRequest).toHaveBeenCalledWith("model/list", { limit: 50 });
    expect(mockedRequest).toHaveBeenCalledWith("thread/list", {
      limit: 100,
      sortKey: "updated_at",
    });
    expect(options.onInitialized).toHaveBeenCalledTimes(2);
    expect(result.current.restartError).toBeUndefined();
  });

  it("ne lance qu’un redémarrage App Server dans le même rendu", async () => {
    const options = callbacks();
    const restart = deferred<void>();
    mockedRestart.mockReturnValueOnce(restart.promise);
    const { result } = renderHook(() => useAppServerConnection(options));
    await waitFor(() => expect(options.onInitialized).toHaveBeenCalledOnce());

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.restart();
      second = result.current.restart();
    });
    await expect(second).resolves.toBe(false);
    expect(mockedRestart).toHaveBeenCalledOnce();

    restart.resolve();
    await act(async () => expect(await first).toBe(true));
    expect(result.current.restarting).toBe(false);
  });

  it("se reconnecte automatiquement puis réhydrate le thread actif", async () => {
    const options = callbacks();
    mockedReconnect.mockResolvedValue();
    const { result, unmount } = renderHook(() =>
      useAppServerConnection(options),
    );
    await waitFor(() => expect(result.current.connected).toBe(true));
    vi.useFakeTimers();

    act(() => updateConnection?.(false, new Error("stale pipe")));
    expect(result.current.connected).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(mockedReconnect).toHaveBeenCalledOnce();
    expect(options.onInitialized).toHaveBeenCalledTimes(2);
    expect(options.onRecovered).toHaveBeenCalledOnce();
    expect(result.current.connected).toBe(true);
    unmount();
  });

  it("réinstalle ses abonnements après un échec de connexion initial", async () => {
    const options = callbacks();
    let attempt = 0;
    mockedConnect.mockImplementation(async (onMessage, onConnection) => {
      attempt += 1;
      if (attempt === 1) {
        onConnection?.(false, new Error("startup failed"));
        throw new Error("startup failed");
      }
      receiveMessage = onMessage;
      updateConnection = onConnection;
      onConnection?.(true);
      return vi.fn();
    });
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useAppServerConnection(options),
    );

    await act(async () => vi.advanceTimersByTimeAsync(1_000));

    expect(mockedConnect).toHaveBeenCalledTimes(2);
    expect(mockedReconnect).not.toHaveBeenCalled();
    expect(options.onInitialized).toHaveBeenCalledOnce();
    expect(options.onRecovered).toHaveBeenCalledOnce();
    expect(result.current.connected).toBe(true);

    act(() => updateConnection?.(false, new Error("later failure")));
    expect(options.onDisconnected).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("nettoie les abonnements et ignore une initialisation devenue obsolète", async () => {
    const options = callbacks();
    const disconnect = vi.fn();
    const unlisten = vi.fn();
    let resolveModels: ((value: unknown) => void) | undefined;
    mockedConnect.mockImplementation(async (onMessage, onConnection) => {
      receiveMessage = onMessage;
      onConnection?.(true);
      return disconnect;
    });
    mockedListen.mockResolvedValue(unlisten);
    mockedRequest.mockImplementation((method) =>
      method === "model/list"
        ? new Promise((resolve) => (resolveModels = resolve))
        : Promise.resolve({ data: [] }),
    );
    const { unmount } = renderHook(() => useAppServerConnection(options));
    await waitFor(() => expect(mockedListen).toHaveBeenCalledOnce());

    unmount();
    await act(async () => resolveModels?.({ data: [] }));

    expect(disconnect).toHaveBeenCalledOnce();
    expect(unlisten).toHaveBeenCalledOnce();
    expect(options.onInitialized).not.toHaveBeenCalled();
  });
});

describe("normalisation initiale App Server", () => {
  it("conserve les capacités modèles et reconstruit l’aperçu du dernier tour", () => {
    expect(
      normalizeModels({
        models: [
          {
            id: "model-1",
            displayName: "Model One",
            isDefault: true,
            serviceTiers: [
              { id: "fast", name: "Fast", description: "Priority" },
            ],
            supportsPersonality: true,
          },
        ],
      }),
    ).toEqual([
      {
        id: "model-1",
        label: "Model One",
        isDefault: true,
        serviceTiers: [
          { id: "fast", name: "Fast", description: "Priority" },
        ],
        supportedReasoningEfforts: undefined,
        defaultReasoningEffort: undefined,
        supportsPersonality: true,
      },
    ]);
    expect(
      threadSummary({
        id: "thread-1",
        cwd: "/project",
        turns: [
          {
            id: "turn-1",
            status: "completed",
            items: [
              {
                id: "item-1",
                type: "userMessage",
                content: [{ type: "text", text: "Dernière demande" }],
              },
            ],
          },
        ],
      }),
    ).toEqual({
      id: "thread-1",
      name: undefined,
      preview: "Dernière demande",
      updatedAt: undefined,
      cwd: "/project",
      status: undefined,
    });
  });
});
