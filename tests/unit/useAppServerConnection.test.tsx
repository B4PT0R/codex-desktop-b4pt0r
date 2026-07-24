// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listen } from "@tauri-apps/api/event";
import {
  connect,
  reconnect,
  request,
  type AppServerMessage,
} from "../../src/lib/codex";
import {
  normalizeModels,
  useAppServerConnection,
} from "../../src/lib/useAppServerConnection";
import { threadSummary } from "../../src/lib/threadSummary";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("../../src/lib/codex", () => ({
  connect: vi.fn(),
  isTauri: vi.fn(() => true),
  reconnect: vi.fn(),
  request: vi.fn(),
}));
vi.mock("../../src/i18n/I18nProvider", async () => {
  const { defaultTranslate } = await import("../../src/i18n/translate");
  return { useI18n: () => ({ t: defaultTranslate }) };
});

const mockedConnect = vi.mocked(connect);
const mockedListen = vi.mocked(listen);
const mockedReconnect = vi.mocked(reconnect);
const mockedRequest = vi.mocked(request);
let receiveMessage: ((message: AppServerMessage) => void) | undefined;
let updateConnection: ((connected: boolean, error?: Error) => void) | undefined;

function callbacks() {
  return {
    onDisconnected: vi.fn(),
    onError: vi.fn(),
    onInitialized: vi.fn(),
    onMessage: vi.fn(),
    onNewChat: vi.fn(),
  };
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

describe("connexion App Server", () => {
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
      limit: 30,
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
            supportsPersonality: true,
          },
        ],
      }),
    ).toEqual([
      {
        id: "model-1",
        label: "Model One",
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
