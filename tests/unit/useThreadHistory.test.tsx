// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const localeState = vi.hoisted(() => ({ current: "fr" as "fr" | "en" }));

vi.mock("../../src/lib/codex", () => ({ request: requestMock }));
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

import { useThreadHistory } from "../../src/lib/useThreadHistory";
import type { ThreadRuntimeSettings } from "../../src/lib/threadRuntimeSettings";
import type { ChatMessage } from "../../src/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function options(activeThreadId?: string) {
  return {
    activeThreadId,
    onError: vi.fn(),
    onMessagesPrepended: vi.fn<(messages: ChatMessage[]) => void>(),
    onMessagesReplaced: vi.fn<(messages: ChatMessage[]) => void>(),
    onThreadResumed:
      vi.fn<(threadId: string, settings: ThreadRuntimeSettings) => void>(),
  };
}

beforeEach(() => {
  requestMock.mockReset();
  localeState.current = "fr";
});

describe("historique paginé", () => {
  it("hydrate la page récente et expose la pagination", async () => {
    const callbacks = options();
    requestMock.mockResolvedValue({
      thread: { id: "thread-1", cwd: "/tmp/project" },
      cwd: "/tmp/project",
      model: "gpt-5.4",
      reasoningEffort: "high",
      activePermissionProfile: { id: ":danger-full-access" },
      initialTurnsPage: {
        data: [
          {
            items: [{ id: "agent-1", type: "agentMessage", text: "Récent" }],
          },
        ],
        nextCursor: "older",
      },
    });
    const { result } = renderHook(() => useThreadHistory(callbacks));

    await act(async () => {
      await result.current.resume("thread-1");
    });

    expect(callbacks.onMessagesReplaced).toHaveBeenCalledWith([
      { id: "agent-1", role: "assistant", content: "Récent" },
    ]);
    expect(callbacks.onThreadResumed).toHaveBeenCalledWith(
      "thread-1",
      {
        cwd: "/tmp/project",
        model: "gpt-5.4",
        effort: "high",
        permission: ":danger-full-access",
      },
    );
    expect(result.current.canLoadOlder).toBe(true);
  });

  it("ignore une réponse de reprise devenue obsolète", async () => {
    const callbacks = options();
    const first = deferred<{ thread: { id: string } }>();
    const second = deferred<{ thread: { id: string } }>();
    requestMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useThreadHistory(callbacks));

    let firstResume!: Promise<boolean>;
    let secondResume!: Promise<boolean>;
    act(() => {
      firstResume = result.current.resume("thread-1");
      secondResume = result.current.resume("thread-2");
    });
    second.resolve({ thread: { id: "thread-2" } });
    await act(() => secondResume);
    first.resolve({ thread: { id: "thread-1" } });
    await act(() => firstResume);

    expect(callbacks.onThreadResumed).toHaveBeenCalledOnce();
    expect(callbacks.onThreadResumed).toHaveBeenCalledWith(
      "thread-2",
      {
        cwd: undefined,
        model: undefined,
        effort: undefined,
        permission: undefined,
      },
    );
  });

  it("ajoute une page plus ancienne et épuise son curseur", async () => {
    const callbacks = options("thread-1");
    requestMock
      .mockResolvedValueOnce({
        thread: { id: "thread-1" },
        initialTurnsPage: { data: [], nextCursor: "older" },
      })
      .mockResolvedValueOnce({
        data: [
          {
            items: [
              {
                id: "user-1",
                type: "userMessage",
                content: [{ type: "text", text: "Ancien" }],
              },
            ],
          },
        ],
        nextCursor: null,
      });
    const { result } = renderHook(() => useThreadHistory(callbacks));
    await act(async () => {
      await result.current.resume("thread-1");
    });

    await act(async () => {
      await result.current.loadOlder();
    });

    expect(callbacks.onMessagesPrepended).toHaveBeenCalledWith([
      { id: "user-1", role: "user", content: "Ancien" },
    ]);
    expect(result.current.canLoadOlder).toBe(false);
    expect(result.current.loadingOlder).toBe(false);
  });

  it("ignore un second chargement de page lancé dans le même rendu", async () => {
    const callbacks = options("thread-1");
    const page = deferred<{ data: []; nextCursor: null }>();
    requestMock
      .mockResolvedValueOnce({
        thread: { id: "thread-1" },
        initialTurnsPage: { data: [], nextCursor: "older" },
      })
      .mockReturnValueOnce(page.promise);
    const { result } = renderHook(() => useThreadHistory(callbacks));
    await act(() => result.current.resume("thread-1"));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.loadOlder();
      second = result.current.loadOlder();
    });
    expect(requestMock).toHaveBeenCalledTimes(2);
    page.resolve({ data: [], nextCursor: null });
    await act(() => Promise.all([first, second]));
  });

  it("signale en anglais les échecs de reprise et de pagination", async () => {
    localeState.current = "en";
    const callbacks = options("thread-1");
    requestMock.mockRejectedValue(new Error("backend unavailable"));
    const { result } = renderHook(() => useThreadHistory(callbacks));

    await act(() => result.current.resume("thread-1"));
    expect(callbacks.onError).toHaveBeenLastCalledWith(
      "Unable to resume this conversation",
      expect.any(Error),
    );

    requestMock.mockResolvedValueOnce({
      thread: { id: "thread-1" },
      initialTurnsPage: { data: [], nextCursor: "older" },
    });
    await act(() => result.current.resume("thread-1"));
    requestMock.mockRejectedValueOnce(new Error("page unavailable"));
    await act(() => result.current.loadOlder());

    expect(callbacks.onError).toHaveBeenLastCalledWith(
      "Unable to load earlier exchanges",
      expect.any(Error),
    );
  });
});
