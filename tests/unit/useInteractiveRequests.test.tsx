// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const respondMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/lib/codex", () => ({ respond: respondMock }));

import { useInteractiveRequests } from "../../src/lib/useInteractiveRequests";

beforeEach(() => respondMock.mockReset());

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("requêtes interactives", () => {
  it("répond automatiquement aux demandes d’heure externe", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00Z"));
    respondMock.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useInteractiveRequests({ onError: vi.fn() }),
    );
    act(() => {
      expect(
        result.current.handleMessage({
          id: "clock-1",
          method: "currentTime/read",
          params: { threadId: "thread-1" },
        }),
      ).toBe(true);
    });
    await vi.runAllTimersAsync();
    expect(respondMock).toHaveBeenCalledWith("clock-1", {
      currentTimeAt: 1_784_462_400,
    });
    vi.useRealTimers();
  });

  it("répond à une approbation puis la ferme", async () => {
    respondMock.mockResolvedValue(undefined);
    const onError = vi.fn();
    const { result } = renderHook(() => useInteractiveRequests({ onError }));
    act(() => {
      expect(
        result.current.handleMessage({
          id: 7,
          method: "item/commandExecution/requestApproval",
          params: { command: "cargo test" },
        }),
      ).toBe(true);
    });

    await act(() => result.current.decideApproval("accept"));

    expect(respondMock).toHaveBeenCalledWith(7, { decision: "accept" });
    expect(result.current.approval).toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });

  it("n’envoie qu’une décision pour deux clics d’approbation synchrones", async () => {
    const response = deferred<void>();
    respondMock.mockReturnValue(response.promise);
    const { result } = renderHook(() =>
      useInteractiveRequests({ onError: vi.fn() }),
    );
    act(() => {
      result.current.handleMessage({
        id: 7,
        method: "item/commandExecution/requestApproval",
        params: { command: "cargo test" },
      });
    });

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.decideApproval("accept");
      second = result.current.decideApproval("accept");
    });
    expect(respondMock).toHaveBeenCalledOnce();
    response.resolve();
    await act(() => Promise.all([first, second]));
  });

  it("ferme une question résolue automatiquement", () => {
    const { result } = renderHook(() =>
      useInteractiveRequests({ onError: vi.fn() }),
    );
    act(() => {
      result.current.handleMessage({
        id: "question-1",
        method: "item/tool/requestUserInput",
        params: {
          questions: [
            { id: "scope", header: "Portée", question: "Quelle portée ?" },
          ],
        },
      });
    });
    expect(result.current.userInput).toBeDefined();

    act(() => {
      result.current.handleMessage({
        method: "serverRequest/resolved",
        params: { requestId: "question-1", threadId: "thread-1" },
      });
    });

    expect(result.current.userInput).toBeUndefined();
  });

  it("répond à une elicitation MCP et la nettoie", async () => {
    respondMock.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useInteractiveRequests({ onError: vi.fn() }),
    );
    act(() => {
      expect(
        result.current.handleMessage({
          id: "mcp-1",
          method: "mcpServer/elicitation/request",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            serverName: "calendar",
            mode: "form",
            message: "Confirmer ?",
            requestedSchema: { type: "object", properties: {} },
          },
        }),
      ).toBe(true);
    });
    await waitFor(() =>
      expect(result.current.mcpElicitation).toMatchObject({
        requestId: "mcp-1",
        mode: "form",
      }),
    );

    await act(() =>
      result.current.answerMcpElicitation({
        action: "accept",
        content: {},
        _meta: null,
      }),
    );

    expect(respondMock).toHaveBeenCalledWith("mcp-1", {
      action: "accept",
      content: {},
      _meta: null,
    });
    expect(result.current.mcpElicitation).toBeUndefined();
  });

  it("ne rouvre pas une elicitation résolue pendant son chargement", async () => {
    const { result } = renderHook(() =>
      useInteractiveRequests({ onError: vi.fn() }),
    );
    act(() => {
      result.current.handleMessage({
        id: "mcp-fast",
        method: "mcpServer/elicitation/request",
        params: {
          serverName: "calendar",
          mode: "form",
          message: "Confirmer ?",
          requestedSchema: { type: "object", properties: {} },
        },
      });
      result.current.handleMessage({
        method: "serverRequest/resolved",
        params: { requestId: "mcp-fast", threadId: "thread-1" },
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.mcpElicitation).toBeUndefined();
  });
});
