// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalAgentMigrationItem } from "../../src/lib/appServerTypes";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));

import { useExternalAgentImport } from "../../src/lib/useExternalAgentImport";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockReset().mockReturnValue(vi.fn());
});

describe("contrôleur d’import d’agents", () => {
  it("détecte le profil et le workspace avec des paramètres bornés", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "externalAgentConfig/detect"
          ? {
              items: [
                {
                  itemType: "CONFIG",
                  description: "Configuration Claude",
                  cwd: null,
                },
              ],
            }
          : { data: [] },
      ),
    );
    const { result } = renderHook(() =>
      useExternalAgentImport({ cwd: "/project", enabled: true }),
    );
    await waitFor(() => expect(result.current.historyLoading).toBe(false));
    await act(() => result.current.detect("cursor"));
    expect(requestMock).toHaveBeenCalledWith("externalAgentConfig/detect", {
      includeHome: true,
      cwds: ["/project"],
      source: null,
      migrationSource: "cursor",
    });
    expect(result.current.items[0].itemType).toBe("CONFIG");
  });

  it("ne perd pas une fin d’import reçue avant la réponse", async () => {
    let resolveImport!: (value: { importId: string }) => void;
    const importResponse = new Promise<{ importId: string }>((resolve) => {
      resolveImport = resolve;
    });
    requestMock.mockImplementation((method: string) => {
      if (method === "externalAgentConfig/import") return importResponse;
      return Promise.resolve({ data: [] });
    });
    const { result } = renderHook(() =>
      useExternalAgentImport({ cwd: "/project", enabled: true }),
    );
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.importItems([
        { itemType: "SKILLS", description: "Skills", cwd: null },
      ]);
    });
    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "externalAgentConfig/import/completed",
        params: {
          importId: "import-1",
          itemTypeResults: [
            {
              itemType: "SKILLS",
              successes: [{ itemType: "SKILLS" }],
              failures: [],
            },
          ],
        },
      }),
    );
    resolveImport({ importId: "import-1" });
    await act(() => pending);
    await waitFor(() => expect(result.current.completed).toBe(true));
    expect(result.current.importing).toBe(false);
    expect(result.current.results[0].successes).toHaveLength(1);
    expect(requestMock).toHaveBeenCalledWith(
      "externalAgentConfig/import",
      expect.objectContaining({
        source: "codex-desktop-linux",
        migrationItems: [expect.objectContaining({ itemType: "SKILLS" })],
      }),
    );
  });

  it("refuse les doubles soumissions pendant un import", async () => {
    requestMock.mockImplementation((method: string) =>
      method === "externalAgentConfig/import"
        ? new Promise(() => undefined)
        : Promise.resolve({ data: [] }),
    );
    const { result } = renderHook(() =>
      useExternalAgentImport({ cwd: "", enabled: true }),
    );
    const item = { itemType: "CONFIG" as const, description: "Config" };
    act(() => {
      void result.current.importItems([item]);
      void result.current.importItems([item]);
    });
    await waitFor(() =>
      expect(
        requestMock.mock.calls.filter(
          ([method]) => method === "externalAgentConfig/import",
        ),
      ).toHaveLength(1),
    );
  });

  it("retire l’inventaire précédent avant une nouvelle détection", async () => {
    requestMock
      .mockResolvedValueOnce({
        items: [{ itemType: "CONFIG", description: "Ancienne config" }],
      })
      .mockRejectedValueOnce(new Error("detection failed"));
    const { result } = renderHook(() =>
      useExternalAgentImport({ cwd: "/project", enabled: false }),
    );
    await act(() => result.current.detect("claude-code"));
    expect(result.current.items).toHaveLength(1);

    await act(() => result.current.detect("cursor"));

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe("detection failed");
  });

  it("ignore une détection terminée pour l’ancien workspace", async () => {
    const pending = deferred<{ items: ExternalAgentMigrationItem[] }>();
    requestMock.mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(
      ({ cwd }) => useExternalAgentImport({ cwd, enabled: false }),
      { initialProps: { cwd: "/old-project" } },
    );
    let detection!: Promise<void>;
    act(() => {
      detection = result.current.detect("claude-code");
    });

    rerender({ cwd: "/new-project" });
    pending.resolve({
      items: [{ itemType: "CONFIG", description: "Ancienne config" }],
    });
    await act(() => detection);

    expect(result.current.detecting).toBe(false);
    expect(result.current.items).toEqual([]);
  });
});
