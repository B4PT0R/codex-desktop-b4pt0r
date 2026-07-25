// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "../../src/lib/nativeBridge";
import {
  type AgentsDocument,
  useWorkspaceAgents,
} from "../../src/lib/useWorkspaceAgents";

vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: vi.fn(),
}));

afterEach(() => vi.mocked(invoke).mockReset());

describe("document AGENTS.md du workspace", () => {
  it("ignore une lecture obsolète après un changement de workspace", async () => {
    const first = deferred<AgentsDocument>();
    const second = deferred<AgentsDocument>();
    vi.mocked(invoke)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ workspace }) =>
        useWorkspaceAgents({
          enabled: true,
          nativeApp: true,
          workspace,
        }),
      { initialProps: { workspace: "/work/first" } },
    );

    rerender({ workspace: "/work/second" });
    await act(() =>
      second.resolve({
        content: "second",
        exists: true,
        filePath: "/work/second/AGENTS.md",
        version: "second",
      }),
    );
    await waitFor(() => expect(result.current.draft).toBe("second"));

    await act(() =>
      first.resolve({
        content: "first",
        exists: true,
        filePath: "/work/first/AGENTS.md",
        version: "first",
      }),
    );
    expect(result.current.draft).toBe("second");
    expect(result.current.document?.filePath).toBe(
      "/work/second/AGENTS.md",
    );
  });

  it("efface le document et invalide les requêtes à la fermeture", async () => {
    const pending = deferred<AgentsDocument>();
    vi.mocked(invoke).mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useWorkspaceAgents({
          enabled,
          nativeApp: true,
          workspace: "/work/project",
        }),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    await act(() =>
      pending.resolve({
        content: "late",
        exists: true,
        filePath: "/work/project/AGENTS.md",
        version: "late",
      }),
    );
    expect(result.current.document).toBeUndefined();
    expect(result.current.draft).toBe("");
    expect(result.current.loading).toBe(false);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
