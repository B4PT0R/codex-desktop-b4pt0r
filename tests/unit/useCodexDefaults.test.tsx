// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({ request: requestMock }));

import { useCodexDefaults } from "../../src/lib/useCodexDefaults";

beforeEach(() => requestMock.mockReset());

describe("valeurs Codex d'un nouveau thread", () => {
  it("hydrate le modèle et l'effort depuis la configuration effective", async () => {
    requestMock.mockResolvedValue({
      config: {
        model: "gpt-5.6",
        model_reasoning_effort: "high",
        approval_policy: "never",
      },
    });
    const onDefaults = vi.fn();
    const { rerender } = renderHook(
      ({ cwd }) =>
        useCodexDefaults({
          connected: true,
          cwd,
          enabled: true,
          onDefaults,
          onError: vi.fn(),
        }),
      { initialProps: { cwd: "/project" } },
    );

    await act(async () => undefined);
    expect(requestMock).toHaveBeenCalledWith("config/read", {
      cwd: "/project",
      includeLayers: false,
    });
    expect(onDefaults).toHaveBeenLastCalledWith({
      model: "gpt-5.6",
      effort: "high",
      approvalPolicy: "never",
    });

    rerender({ cwd: "/other" });
    await act(async () => undefined);
    expect(requestMock).toHaveBeenLastCalledWith("config/read", {
      cwd: "/other",
      includeLayers: false,
    });
  });

  it("ne lit rien pour un thread déjà actif", () => {
    renderHook(() =>
      useCodexDefaults({
        connected: true,
        cwd: "/project",
        enabled: false,
        onDefaults: vi.fn(),
        onError: vi.fn(),
      }),
    );
    expect(requestMock).not.toHaveBeenCalled();
  });
});
