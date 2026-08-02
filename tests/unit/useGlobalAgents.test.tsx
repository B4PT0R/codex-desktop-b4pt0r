// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => true,
}));

import { useGlobalAgents } from "../../src/lib/useGlobalAgents";

beforeEach(() => invokeMock.mockReset());

describe("éditeur AGENTS.md global", () => {
  it("relit puis sauvegarde avec la version attendue", async () => {
    invokeMock
      .mockResolvedValueOnce({
        content: "# Old rules\n",
        exists: true,
        filePath: "/home/test/.codex/AGENTS.md",
        overrideActive: false,
        overrideFilePath: "/home/test/.codex/AGENTS.override.md",
        version: "v1",
      })
      .mockResolvedValueOnce({
        content: "# New rules\n",
        exists: true,
        filePath: "/home/test/.codex/AGENTS.md",
        overrideActive: false,
        overrideFilePath: "/home/test/.codex/AGENTS.override.md",
        version: "v2",
      });

    const { result } = renderHook(useGlobalAgents);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setDraft("# New rules\n"));
    await act(result.current.save);

    expect(invokeMock).toHaveBeenLastCalledWith("write_global_agents", {
      content: "# New rules\n",
      expectedVersion: "v1",
    });
    expect(result.current.saved).toBe(true);
    expect(result.current.dirty).toBe(false);
  });

  it("conserve le brouillon après un conflit externe", async () => {
    invokeMock
      .mockResolvedValueOnce({
        content: "",
        exists: false,
        filePath: "/home/test/.codex/AGENTS.md",
        overrideActive: true,
        overrideFilePath: "/home/test/.codex/AGENTS.override.md",
        version: "empty",
      })
      .mockRejectedValueOnce(new Error("Global AGENTS.md changed outside"));

    const { result } = renderHook(useGlobalAgents);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setDraft("Personal rule\n"));
    await act(result.current.save);

    expect(result.current.draft).toBe("Personal rule\n");
    expect(result.current.error).toContain("changed outside");
    expect(result.current.dirty).toBe(true);
  });

  it("sérialise sauvegarde et relecture dans un même rendu", async () => {
    const pending = deferred<{
      content: string;
      exists: boolean;
      filePath: string;
      overrideActive: boolean;
      overrideFilePath: string;
      version: string;
    }>();
    invokeMock
      .mockResolvedValueOnce({
        content: "old",
        exists: true,
        filePath: "/home/test/.codex/AGENTS.md",
        overrideActive: false,
        overrideFilePath: "/home/test/.codex/AGENTS.override.md",
        version: "v1",
      })
      .mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useGlobalAgents);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setDraft("new"));

    let saving!: Promise<void>;
    await act(async () => {
      saving = result.current.save();
      await result.current.save();
      await result.current.load();
    });
    expect(invokeMock).toHaveBeenCalledTimes(2);

    pending.resolve({
      content: "new",
      exists: true,
      filePath: "/home/test/.codex/AGENTS.md",
      overrideActive: false,
      overrideFilePath: "/home/test/.codex/AGENTS.override.md",
      version: "v2",
    });
    await act(async () => saving);
    expect(result.current.saved).toBe(true);
  });

  it("sérialise deux relectures et bloque la sauvegarde pendant leur exécution", async () => {
    const pending = deferred<{
      content: string;
      exists: boolean;
      filePath: string;
      overrideActive: boolean;
      overrideFilePath: string;
      version: string;
    }>();
    invokeMock
      .mockResolvedValueOnce({
        content: "old",
        exists: true,
        filePath: "/home/test/.codex/AGENTS.md",
        overrideActive: false,
        overrideFilePath: "/home/test/.codex/AGENTS.override.md",
        version: "v1",
      })
      .mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useGlobalAgents);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setDraft("draft"));

    let loading!: Promise<void>;
    await act(async () => {
      loading = result.current.load();
      await result.current.load();
      await result.current.save();
    });
    expect(invokeMock).toHaveBeenCalledTimes(2);

    pending.resolve({
      content: "external",
      exists: true,
      filePath: "/home/test/.codex/AGENTS.md",
      overrideActive: false,
      overrideFilePath: "/home/test/.codex/AGENTS.override.md",
      version: "v2",
    });
    await act(() => loading);
    expect(result.current.draft).toBe("external");
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
