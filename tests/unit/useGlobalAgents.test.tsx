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
});
