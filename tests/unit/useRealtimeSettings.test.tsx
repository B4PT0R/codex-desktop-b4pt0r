// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const loadMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
}));
vi.mock("../../src/lib/desktopSettings", () => ({
  loadDesktopSettings: loadMock,
  updateDesktopSettings: updateMock,
}));

import { I18nProvider } from "../../src/i18n/I18nProvider";
import { useRealtimeSettings } from "../../src/lib/useRealtimeSettings";

beforeEach(() => {
  requestMock.mockReset();
  loadMock.mockReset().mockResolvedValue({ version: 1, realtimeVoice: "maple" });
  updateMock.mockReset().mockResolvedValue({
    version: 1,
    realtimeVoice: "juniper",
  });
});

describe("préférences Realtime v3", () => {
  it("charge la voix persistée et le catalogue v1 utilisé par v3", async () => {
    requestMock.mockResolvedValue({
      voices: {
        v1: ["juniper", "maple"],
        v2: ["marin"],
        defaultV1: "juniper",
        defaultV2: "marin",
      },
    });
    const { result } = renderHook(() => useRealtimeSettings(true), {
      wrapper: I18nProvider,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.voice).toBe("maple"));
    expect(result.current.voices).toEqual(["juniper", "maple"]);
    expect(requestMock).toHaveBeenCalledWith(
      "thread/realtime/listVoices",
      {},
    );
  });

  it("revient à la voix précédente si la persistance échoue", async () => {
    requestMock.mockResolvedValue({
      voices: {
        v1: ["juniper", "maple"],
        v2: [],
        defaultV1: "juniper",
        defaultV2: "marin",
      },
    });
    updateMock.mockRejectedValue(new Error("write denied"));
    const { result } = renderHook(() => useRealtimeSettings(true), {
      wrapper: I18nProvider,
    });
    await waitFor(() => expect(result.current.voice).toBe("maple"));
    await act(() => result.current.setVoice("juniper"));
    expect(result.current.voice).toBe("maple");
    expect(result.current.persistenceError).toBe("write denied");
  });

});
