// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultTranslate } from "../../src/i18n/translate";
import {
  handleTrayRealtimeRequest,
  revealHeadlessRealtimeSession,
  useTrayRealtimeConversation,
} from "../../src/lib/useTrayRealtimeConversation";
import type { ThreadSummary } from "../../src/types";

const requestMock = vi.hoisted(() => vi.fn());
const reportErrorMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const trayHookMock = vi.hoisted(() => vi.fn());
const nativeMocks = vi.hoisted(() => ({
  listen: vi.fn(),
}));

vi.mock("../../src/lib/codex", () => ({ request: requestMock }));
vi.mock("../../src/lib/useRealtimeTray", () => ({
  reportRealtimeTrayError: reportErrorMock,
  useRealtimeTray: trayHookMock,
}));
vi.mock("../../src/lib/nativeBridge", () => ({
  isDesktopApp: () => true,
  listen: nativeMocks.listen,
}));

function options() {
  let threads: ThreadSummary[] = [];
  const start = vi.fn().mockResolvedValue(true);
  const stop = vi.fn().mockResolvedValue(undefined);
  const attachHeadlessTranscript = vi.fn().mockReturnValue(true);
  const openThread = vi.fn().mockResolvedValue(true);
  const setDefaultThreadId = vi.fn().mockResolvedValue(true);
  return {
    controller: {
      connected: true,
      defaultThread: {
        defaultThreadId: undefined,
        saving: false,
        threadOptions: [],
        setDefaultThreadId,
      },
      dictationActive: false,
      model: "gpt-5.4",
      activeThreadId: undefined,
      openThread,
      realtimeConversation: {
        attachHeadlessTranscript,
        headlessParentThreadId: undefined,
        recording: false,
        start,
        stop,
      },
      setThreads: (
        update:
          | ThreadSummary[]
          | ((current: ThreadSummary[]) => ThreadSummary[]),
      ) => {
        threads = typeof update === "function" ? update(threads) : update;
      },
      translate: defaultTranslate,
      voice: "juniper" as const,
    },
    start,
    stop,
    attachHeadlessTranscript,
    openThread,
    setDefaultThreadId,
    threads: () => threads,
  };
}

describe("session Realtime headless", () => {
  it("mémorise un parent persistant puis démarre un fork sans transcript visible", async () => {
    requestMock.mockReset().mockResolvedValue({
      thread: { id: "thread-default", cwd: "/home/user" },
      cwd: "/home/user",
      model: "gpt-5.4",
      approvalPolicy: "never",
      activePermissionProfile: { id: ":danger-full-access" },
    });
    const state = options();

    await expect(handleTrayRealtimeRequest(state.controller, {
      action: "start",
      home: "/home/user",
      windowVisible: false,
    })).resolves.toBe("thread-default");

    expect(state.setDefaultThreadId).toHaveBeenCalledWith("thread-default");
    expect(state.threads()).toEqual([
      { id: "thread-default", cwd: "/home/user", status: undefined },
    ]);
    expect(state.start).toHaveBeenCalledWith(
      expect.objectContaining({
        parentThreadId: "thread-default",
        cwd: "/home/user",
        permission: ":danger-full-access",
        approvalPolicy: "never",
        displayTranscript: false,
      }),
    );
  });

  it("arrête la session active sans résoudre de nouveau parent", async () => {
    requestMock.mockReset();
    const state = options();

    await handleTrayRealtimeRequest(state.controller, {
      action: "stop",
      home: "/home/user",
      windowVisible: false,
    });

    expect(state.stop).toHaveBeenCalledOnce();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("ouvre le parent avant de rattacher le transcript headless", async () => {
    const state = options();

    await expect(
      revealHeadlessRealtimeSession(state.controller, "thread-default"),
    ).resolves.toBe(true);

    expect(state.openThread).toHaveBeenCalledWith("thread-default");
    expect(state.attachHeadlessTranscript).toHaveBeenCalledOnce();
    expect(
      state.openThread.mock.invocationCallOrder[0],
    ).toBeLessThan(state.attachHeadlessTranscript.mock.invocationCallOrder[0]);
  });

  it("rattrape une ouverture de fenêtre survenue pendant le démarrage", async () => {
    requestMock.mockReset().mockResolvedValue({
      thread: { id: "thread-default", cwd: "/home/user" },
      cwd: "/home/user",
      model: "gpt-5.4",
    });
    trayHookMock.mockReset();
    let windowShown: (() => void) | undefined;
    nativeMocks.listen.mockReset().mockImplementation(async (event, handler) => {
      if (event === "window-shown") windowShown = handler;
      return () => {};
    });
    const state = options();
    const { rerender } = renderHook(
      ({ headlessParentThreadId }) =>
        useTrayRealtimeConversation({
          ...state.controller,
          realtimeConversation: {
            ...state.controller.realtimeConversation,
            headlessParentThreadId,
          },
        }),
      { initialProps: { headlessParentThreadId: undefined as string | undefined } },
    );
    await waitFor(() => expect(windowShown).toBeDefined());
    const onToggle = trayHookMock.mock.calls.at(-1)?.[0].onToggle;

    await act(() =>
      onToggle({
        action: "start",
        home: "/home/user",
        windowVisible: false,
      }),
    );
    act(() => windowShown?.());
    rerender({ headlessParentThreadId: "thread-default" });

    await waitFor(() =>
      expect(state.openThread).toHaveBeenCalledWith("thread-default"),
    );
    expect(state.attachHeadlessTranscript).toHaveBeenCalledOnce();
  });
});
