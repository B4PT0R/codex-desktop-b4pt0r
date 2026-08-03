// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeTray } from "../../src/lib/useRealtimeTray";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: mocks.invoke,
  isDesktopApp: () => true,
  listen: mocks.listen,
}));

beforeEach(() => {
  mocks.invoke.mockReset().mockResolvedValue(undefined);
  mocks.listen.mockReset();
});

describe("contrôle Realtime du tray", () => {
  it("arme le menu après le listener et reflète l’état audio", async () => {
    let toggle:
      | ((event: {
          payload: {
            action: "start";
            home: string;
            windowVisible: boolean;
          };
        }) => void)
      | undefined;
    mocks.listen.mockImplementation(async (_event, handler) => {
      toggle = handler;
      return () => {};
    });
    const onToggle = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ recording }) =>
        useRealtimeTray({ connected: true, recording, onToggle }),
      { initialProps: { recording: false } },
    );

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("set_tray_realtime_state", {
        state: "idle",
      }),
    );
    act(() =>
      toggle?.({
        payload: {
          action: "start",
          home: "/home/user",
          windowVisible: false,
        },
      }),
    );
    await waitFor(() =>
      expect(onToggle).toHaveBeenCalledWith({
        action: "start",
        home: "/home/user",
        windowVisible: false,
      }),
    );

    rerender({ recording: true });
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("set_tray_realtime_state", {
        state: "active",
      }),
    );
  });

  it("rend un échec de lancement visible au niveau natif", async () => {
    let toggle:
      | ((event: {
          payload: {
            action: "start";
            home: string;
            windowVisible: boolean;
          };
        }) => void)
      | undefined;
    mocks.listen.mockImplementation(async (_event, handler) => {
      toggle = handler;
      return () => {};
    });
    renderHook(() =>
      useRealtimeTray({
        connected: true,
        recording: false,
        onToggle: vi.fn().mockRejectedValue(new Error("microphone denied")),
      }),
    );
    await waitFor(() => expect(toggle).toBeDefined());

    act(() =>
      toggle?.({
        payload: {
          action: "start",
          home: "/home/user",
          windowVisible: false,
        },
      }),
    );
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("set_tray_realtime_state", {
        state: "error",
        message: "microphone denied",
      }),
    );
  });

  it("rend un échec d’abonnement au tray visible au niveau natif", async () => {
    mocks.listen.mockRejectedValue(new Error("tray listener unavailable"));

    renderHook(() =>
      useRealtimeTray({
        connected: true,
        recording: false,
        onToggle: vi.fn(),
      }),
    );

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("set_tray_realtime_state", {
        state: "error",
        message: "tray listener unavailable",
      }),
    );
  });
});
