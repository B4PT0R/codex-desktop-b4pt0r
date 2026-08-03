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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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

  it("ne laisse pas le chargement initial remplacer un choix sauvegardé", async () => {
    const persisted = deferred<{ version: number; realtimeVoice: string }>();
    loadMock.mockReturnValueOnce(persisted.promise);
    requestMock.mockResolvedValue({
      voices: {
        v1: ["juniper", "maple"],
        v2: [],
        defaultV1: "juniper",
        defaultV2: "marin",
      },
    });
    const { result } = renderHook(() => useRealtimeSettings(true), {
      wrapper: I18nProvider,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.setVoice("maple"));
    persisted.resolve({ version: 1, realtimeVoice: "juniper" });
    await act(async () => persisted.promise);

    expect(result.current.voice).toBe("maple");
  });

  it("sérialise les choix de voix dans un même rendu", async () => {
    const update = deferred<{ version: number; realtimeVoice: string }>();
    updateMock.mockReturnValueOnce(update.promise);
    requestMock.mockResolvedValue({
      voices: {
        v1: ["juniper", "maple"],
        v2: [],
        defaultV1: "juniper",
        defaultV2: "marin",
      },
    });
    const { result } = renderHook(() => useRealtimeSettings(true), {
      wrapper: I18nProvider,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.voice).toBe("maple"));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.setVoice("juniper");
      await result.current.setVoice("maple");
      await result.current.refresh();
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(1);

    update.resolve({ version: 1, realtimeVoice: "juniper" });
    await act(async () => first);
    expect(result.current.voice).toBe("juniper");
  });

  it("relit le catalogue après une déconnexion pendant le chargement", async () => {
    const stale = deferred<{ voices: { v1: string[]; defaultV1: string } }>();
    requestMock
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({
        voices: { v1: ["juniper", "maple"], defaultV1: "juniper" },
      });
    const { result, rerender } = renderHook(
      ({ enabled }) => useRealtimeSettings(enabled),
      { initialProps: { enabled: true }, wrapper: I18nProvider },
    );
    expect(result.current.loading).toBe(true);

    rerender({ enabled: false });
    rerender({ enabled: true });
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.voices).toEqual(["juniper", "maple"]),
    );

    stale.resolve({ voices: { v1: ["maple"], defaultV1: "maple" } });
    await act(async () => stale.promise);

    expect(result.current.voices).toEqual(["juniper", "maple"]);
    expect(result.current.loading).toBe(false);
  });
});
