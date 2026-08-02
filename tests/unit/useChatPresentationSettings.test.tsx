// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => false,
}));

beforeEach(() => {
  vi.resetModules();
  invokeMock.mockReset();
  localStorage.clear();
});

describe("présentation du chat", () => {
  it("charge et persiste la limite des actions visibles", async () => {
    localStorage.setItem("codex-desktop.maxVisibleActionsPerGroup", "4");
    const { useChatPresentationSettings } =
      await import("../../src/lib/useChatPresentationSettings");
    const { result } = renderHook(() => useChatPresentationSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.maxVisibleActions).toBe(4);

    await act(() => result.current.setMaxVisibleActions(2));
    expect(result.current.maxVisibleActions).toBe(2);
    expect(
      localStorage.getItem("codex-desktop.maxVisibleActionsPerGroup"),
    ).toBe("2");
  });

  it("ignore une limite persistée hors bornes", async () => {
    localStorage.setItem("codex-desktop.maxVisibleActionsPerGroup", "12");
    const {
      DEFAULT_MAX_VISIBLE_ACTIONS,
      useChatPresentationSettings,
    } = await import("../../src/lib/useChatPresentationSettings");
    const { result } = renderHook(() => useChatPresentationSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.maxVisibleActions).toBe(
      DEFAULT_MAX_VISIBLE_ACTIONS,
    );
  });

  it("charge et persiste les préférences de densité du chat", async () => {
    localStorage.setItem("codex-desktop.showReasoningItems", "false");
    localStorage.setItem("codex-desktop.keepActionGroupsCollapsed", "true");
    const { useChatPresentationSettings } =
      await import("../../src/lib/useChatPresentationSettings");
    const { result } = renderHook(() => useChatPresentationSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.showReasoningItems).toBe(false);
    expect(result.current.keepActionGroupsCollapsed).toBe(true);

    await act(() => result.current.setShowReasoningItems(true));
    await act(() => result.current.setKeepActionGroupsCollapsed(false));
    expect(localStorage.getItem("codex-desktop.showReasoningItems")).toBe(
      "true",
    );
    expect(
      localStorage.getItem("codex-desktop.keepActionGroupsCollapsed"),
    ).toBe("false");
  });
});
