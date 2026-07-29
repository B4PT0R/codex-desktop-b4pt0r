// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutomationsController } from "../../src/lib/automations";

const respondMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ respond: respondMock }));

import { useSchedulerTools } from "../../src/lib/useSchedulerTools";

const task = {
  id: "task-1",
  name: "Veille",
  prompt: "Inspecte",
  enabled: true,
  schedule: { type: "interval" as const, intervalMinutes: 60 },
  target: { type: "newThread" as const },
};

function controller(
  overrides: Partial<AutomationsController> = {},
): AutomationsController {
  return {
    automations: [task],
    loading: false,
    deleteAutomation: vi.fn().mockResolvedValue(true),
    refresh: vi.fn().mockResolvedValue(undefined),
    runNow: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue(task),
    ...overrides,
  };
}

function call(tool: string, arguments_: Record<string, unknown>) {
  return {
    id: `request-${tool}`,
    method: "item/tool/call",
    params: {
      namespace: "scheduler",
      threadId: "thread-1",
      turnId: "turn-1",
      callId: `call-${tool}`,
      tool,
      arguments: arguments_,
    },
  };
}

beforeEach(() => respondMock.mockReset().mockResolvedValue(undefined));

describe("contrôleur agentique du scheduler", () => {
  it("liste les tâches dans une réponse dynamic tool", async () => {
    const { result } = renderHook(() =>
      useSchedulerTools({ automations: controller(), onError: vi.fn() }),
    );
    act(() => {
      expect(result.current.handleMessage(call("list", {}))).toBe(true);
    });
    await waitFor(() =>
      expect(respondMock).toHaveBeenCalledWith(
        "request-list",
        expect.objectContaining({ success: true }),
      ),
    );
  });

  it("crée une tâche en ciblant le thread appelant", async () => {
    const automations = controller();
    const { result } = renderHook(() =>
      useSchedulerTools({ automations, onError: vi.fn() }),
    );
    act(() => {
      result.current.handleMessage(
        call("create", {
          name: "Rapport",
          prompt: "Prépare un rapport",
          schedule: { type: "interval", intervalMinutes: 30 },
        }),
      );
    });
    await waitFor(() =>
      expect(automations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { type: "thread", threadId: "thread-1" },
        }),
      ),
    );
    expect(respondMock).toHaveBeenCalledWith(
      "request-create",
      expect.objectContaining({ success: true }),
    );
  });

  it("attend la confirmation utilisateur avant une suppression", async () => {
    const automations = controller();
    const { result } = renderHook(() =>
      useSchedulerTools({ automations, onError: vi.fn() }),
    );
    act(() => {
      result.current.handleMessage(call("delete", { id: "task-1" }));
    });
    expect(result.current.confirmation?.task).toEqual(task);
    expect(automations.deleteAutomation).not.toHaveBeenCalled();
    expect(respondMock).not.toHaveBeenCalled();

    await act(() => result.current.confirmDelete());

    expect(automations.deleteAutomation).toHaveBeenCalledWith("task-1");
    expect(respondMock).toHaveBeenCalledWith(
      "request-delete",
      expect.objectContaining({ success: true }),
    );
    expect(result.current.confirmation).toBeUndefined();
  });

  it("signale au modèle une suppression annulée", async () => {
    const automations = controller();
    const { result } = renderHook(() =>
      useSchedulerTools({ automations, onError: vi.fn() }),
    );
    act(() => {
      result.current.handleMessage(call("delete", { id: "task-1" }));
    });
    await act(() => result.current.cancelDelete());

    expect(automations.deleteAutomation).not.toHaveBeenCalled();
    expect(respondMock).toHaveBeenCalledWith(
      "request-delete",
      expect.objectContaining({ success: false }),
    );
  });

  it("laisse les autres namespaces à leurs propriétaires", () => {
    const { result } = renderHook(() =>
      useSchedulerTools({ automations: controller(), onError: vi.fn() }),
    );
    expect(
      result.current.handleMessage({
        id: "other-1",
        method: "item/tool/call",
        params: {
          namespace: "other",
          threadId: "thread-1",
          tool: "list",
          arguments: {},
        },
      }),
    ).toBe(false);
  });
});
