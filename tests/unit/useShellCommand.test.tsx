// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { useShellCommand } from "../../src/lib/useShellCommand";

beforeEach(() => requestMock.mockReset().mockResolvedValue({}));

describe("commande shell locale", () => {
  it("confirme puis exécute dans le thread courant", async () => {
    const options = {
      busy: false,
      threadId: "thread-1",
      createThread: vi.fn(),
      onError: vi.fn(),
      onStarted: vi.fn(),
    };
    const { result } = renderHook(() => useShellCommand(options));
    act(() => result.current.requestExecution("  git status  "));
    expect(result.current.pending).toBe("git status");

    await act(() => result.current.confirm());

    expect(requestMock).toHaveBeenCalledWith("thread/shellCommand", {
      threadId: "thread-1",
      command: "git status",
    });
    expect(options.onStarted).toHaveBeenCalledWith("git status", "thread-1");
    expect(result.current.pending).toBeUndefined();
  });

  it("crée un thread au besoin et bloque pendant un tour", async () => {
    const createThread = vi
      .fn()
      .mockResolvedValue({ id: "thread-new", activated: true });
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      ({ busy }) =>
        useShellCommand({
          busy,
          createThread,
          onError,
          onStarted: vi.fn(),
        }),
      { initialProps: { busy: false } },
    );
    act(() => result.current.requestExecution("pwd"));
    await act(() => result.current.confirm());
    expect(createThread).toHaveBeenCalledOnce();
    expect(requestMock).toHaveBeenCalledWith(
      "thread/shellCommand",
      expect.objectContaining({ threadId: "thread-new" }),
    );

    rerender({ busy: true });
    act(() => result.current.requestExecution("ls"));
    expect(onError).toHaveBeenCalledWith(
      "Commande shell indisponible",
      expect.any(String),
      undefined,
    );
  });

  it("n’exécute rien lorsqu’une création tardive n’est plus affichée", async () => {
    const onStarted = vi.fn();
    const { result } = renderHook(() =>
      useShellCommand({
        busy: false,
        createThread: vi.fn().mockResolvedValue({
          id: "detached-thread",
          activated: false,
        }),
        onError: vi.fn(),
        onStarted,
      }),
    );

    act(() => result.current.requestExecution("pwd"));
    await act(() => result.current.confirm());

    expect(requestMock).not.toHaveBeenCalled();
    expect(onStarted).not.toHaveBeenCalled();
    expect(result.current.pending).toBeUndefined();
  });
});
