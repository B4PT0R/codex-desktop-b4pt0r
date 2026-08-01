// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => true,
}));

import { useCodexConfig } from "../../src/lib/useCodexConfig";

beforeEach(() => invokeMock.mockReset());

describe("éditeur de configuration Codex", () => {
  it("relit puis sauvegarde avec la version attendue", async () => {
    invokeMock
      .mockResolvedValueOnce({
        content: 'model = "old"\n',
        filePath: "/home/test/.codex/config.toml",
        version: "v1",
      })
      .mockResolvedValueOnce({
        content: 'model = "new"\n',
        filePath: "/home/test/.codex/config.toml",
        version: "v2",
      });
    const { result } = renderHook(useCodexConfig);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setDraft('model = "new"\n'));
    await act(result.current.save);
    expect(invokeMock).toHaveBeenLastCalledWith("write_codex_config", {
      content: 'model = "new"\n',
      expectedVersion: "v1",
    });
    expect(result.current.saved).toBe(true);
    expect(result.current.dirty).toBe(false);
  });

  it("conserve le brouillon si une sauvegarde échoue", async () => {
    invokeMock
      .mockResolvedValueOnce({
        content: "",
        filePath: "/home/test/.codex/config.toml",
        version: "empty",
      })
      .mockRejectedValueOnce(new Error("Invalid TOML: missing bracket"));
    const { result } = renderHook(useCodexConfig);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setDraft("[broken"));
    await act(result.current.save);
    expect(result.current.draft).toBe("[broken");
    expect(result.current.error).toContain("Invalid TOML");
    expect(result.current.dirty).toBe(true);
  });

  it("sérialise sauvegarde et relecture dans un même rendu", async () => {
    const pending = deferred<{
      content: string;
      filePath: string;
      version: string;
    }>();
    invokeMock
      .mockResolvedValueOnce({
        content: 'model = "old"\n',
        filePath: "/home/test/.codex/config.toml",
        version: "v1",
      })
      .mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useCodexConfig);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setDraft('model = "new"\n'));

    let saving!: Promise<boolean>;
    await act(async () => {
      saving = result.current.save();
      expect(await result.current.save()).toBe(false);
      await result.current.load();
    });
    expect(invokeMock).toHaveBeenCalledTimes(2);

    pending.resolve({
      content: 'model = "new"\n',
      filePath: "/home/test/.codex/config.toml",
      version: "v2",
    });
    await act(async () => expect(await saving).toBe(true));
    expect(result.current.saved).toBe(true);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
