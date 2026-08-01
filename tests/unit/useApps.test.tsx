// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));

import { useApps } from "../../src/lib/useApps";

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockReset();
  subscribeMock.mockReturnValue(vi.fn());
});

describe("apps connectées", () => {
  it("parcourt tout le catalogue au-delà des quatre premières pages", async () => {
    requestMock.mockImplementation((method: string, params: { cursor?: string | null }) => {
      if (method === "app/installed") return Promise.resolve({ apps: [] });
      const page = params.cursor ? Number(params.cursor) : 0;
      return Promise.resolve({
        data: [app(`app-${page}`, page === 0, true)],
        nextCursor: page < 5 ? String(page + 1) : null,
      });
    });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalogApps.map(({ id }) => id)).toEqual([
      "app-0", "app-1", "app-2", "app-3", "app-4", "app-5",
    ]);
    expect(requestMock).toHaveBeenCalledWith("app/list", expect.objectContaining({ cursor: "5", forceRefetch: false, limit: 200 }));
  });

  it("sépare les Apps configurables de celles proposées au compositeur", async () => {
    requestMock.mockImplementation((method: string) => Promise.resolve(
      method === "app/installed"
        ? { apps: [{ id: "github", runtimeName: "GitHub", enabled: true, callable: true }] }
        : { data: [app("github", true, true), app("inactive", true, false), app("private", false, true)], nextCursor: null },
    ));
    const { result } = renderHook(() =>
      useApps({ enabled: true, threadId: "thr" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps.map(({ id }) => id)).toEqual(["github"]);
    expect(result.current.configurableApps.map(({ id }) => id)).toEqual([
      "github",
      "inactive",
    ]);
    expect(requestMock).toHaveBeenCalledWith("app/list", {
      cursor: null,
      limit: 200,
      threadId: "thr",
      forceRefetch: true,
    });
    expect(result.current.installedApps.github.callable).toBe(true);
  });

  it("écrit l’activation globale puis relit l’état effectif", async () => {
    let appEnabled = true;
    requestMock.mockImplementation((method: string) => {
      if (method === "app/installed") return Promise.resolve({ apps: [] });
      if (method === "config/value/write") {
        appEnabled = false;
        return Promise.resolve({});
      }
      return Promise.resolve({ data: [app("google.drive", true, appEnabled)], nextCursor: null });
    });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(result.current.apps).toHaveLength(1));

    await act(async () => {
      await result.current.setEnabled(result.current.apps[0], false);
    });

    expect(requestMock).toHaveBeenCalledWith("config/value/write", {
      keyPath: 'apps."google.drive".enabled',
      value: false,
      mergeStrategy: "upsert",
    });
    expect(result.current.apps).toEqual([]);
    expect(result.current.configurableApps[0].isEnabled).toBe(false);
    expect(result.current.updatingApps).toEqual([]);
  });

  it("conserve l’état App Server et expose une erreur d’écriture", async () => {
    requestMock.mockImplementation((method: string) => {
      if (method === "app/installed") return Promise.resolve({ apps: [] });
      if (method === "config/value/write") return Promise.reject(new Error("Configuration administrée"));
      return Promise.resolve({ data: [app("github", true, true)], nextCursor: null });
    });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(result.current.apps).toHaveLength(1));

    await act(async () => {
      await result.current.setEnabled(result.current.apps[0], false);
    });

    expect(result.current.apps[0].isEnabled).toBe(true);
    expect(result.current.error).toBe("Configuration administrée");
    expect(result.current.updatingApps).toEqual([]);
  });

  it("n’envoie pas deux activations simultanées pour la même App", async () => {
    const write = deferred<void>();
    requestMock.mockImplementation((method: string) => {
      if (method === "app/installed") return Promise.resolve({ apps: [] });
      if (method === "config/value/write") return write.promise;
      return Promise.resolve({ data: [app("github", true, true)], nextCursor: null });
    });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(result.current.apps).toHaveLength(1));

    let first: Promise<void>;
    let duplicate: Promise<void>;
    act(() => {
      first = result.current.setEnabled(result.current.apps[0], false);
      duplicate = result.current.setEnabled(result.current.apps[0], false);
    });

    expect(
      requestMock.mock.calls.filter(([method]) => method === "config/value/write"),
    ).toHaveLength(1);
    await expect(duplicate!).resolves.toBeUndefined();
    write.resolve();
    await act(async () => first!);
    expect(result.current.updatingApps).toEqual([]);
  });

  it("normalise les mises à jour et ignore les entrées malformées", async () => {
    requestMock.mockImplementation((method: string) => Promise.resolve(
      method === "app/installed" ? { apps: [] } : { data: [], nextCursor: null },
    ));
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "app/list/updated",
        params: {
          data: [
            ...Array.from({ length: 150 }, (_, index) => ({
              id: `docs-${index}`,
              name: `Documents ${index}`,
              isAccessible: true,
              isEnabled: true,
            })),
            { id: 42 },
          ],
        },
      }),
    );
    expect(result.current.catalogApps).toHaveLength(150);
    expect(result.current.catalogApps[149].id).toBe("docs-149");
  });

  it("lit la politique et les outils puis enregistre une configuration atomique", async () => {
    requestMock.mockImplementation((method: string) => {
      if (method === "app/installed") return Promise.resolve({ apps: [] });
      if (method === "app/list") return Promise.resolve({ data: [app("github", true, true)], nextCursor: null });
      if (method === "config/read") return Promise.resolve({ config: { apps: { _default: { enabled: true, destructive_enabled: false, open_world_enabled: true }, github: { enabled: true, default_tools_enabled: false, tools: { search: { enabled: true } } } } } });
      if (method === "app/read") return Promise.resolve({ apps: [{ id: "github", name: "GitHub", description: null, toolSummaries: [{ name: "search", title: "Search", description: "Search repos", isEnabled: true, disabledReason: null, isReadOnly: true }] }], missingAppIds: [] });
      return Promise.resolve({});
    });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(result.current.configurableApps).toHaveLength(1));
    let editor = null;
    await act(async () => {
      editor = await result.current.readConfiguration(result.current.configurableApps[0]);
    });
    expect(editor).toMatchObject({ config: { default_tools_enabled: false }, tools: [{ name: "search" }] });
    await act(async () => {
      await result.current.saveConfiguration({
        appId: "github",
        enabled: true,
        approvalsReviewer: null,
        destructiveEnabled: false,
        openWorldEnabled: true,
        defaultToolsApprovalMode: "prompt",
        defaultToolsEnabled: false,
        tools: { search: { enabled: true, approvalMode: "auto" } },
      });
    });
    expect(requestMock).toHaveBeenCalledWith("config/batchWrite", expect.objectContaining({
      reloadUserConfig: true,
      edits: expect.arrayContaining([
        { keyPath: 'apps."github".default_tools_enabled', value: false, mergeStrategy: "replace" },
        { keyPath: 'apps."github".tools."search".approval_mode', value: "auto", mergeStrategy: "replace" },
      ]),
    }));
  });

  it("n’envoie pas deux sauvegardes simultanées pour la même configuration", async () => {
    const write = deferred<void>();
    requestMock.mockImplementation((method: string) => {
      if (method === "app/installed") return Promise.resolve({ apps: [] });
      if (method === "app/list") return Promise.resolve({ data: [], nextCursor: null });
      if (method === "config/batchWrite") return write.promise;
      return Promise.resolve({});
    });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const draft = {
      enabled: true,
      approvalsReviewer: null,
      destructiveEnabled: true,
      openWorldEnabled: true,
      defaultToolsApprovalMode: null,
    };

    let first: Promise<boolean>;
    let duplicate: Promise<boolean>;
    act(() => {
      first = result.current.saveConfiguration(draft);
      duplicate = result.current.saveConfiguration(draft);
    });

    expect(
      requestMock.mock.calls.filter(([method]) => method === "config/batchWrite"),
    ).toHaveLength(1);
    await expect(duplicate!).resolves.toBe(false);
    write.resolve();
    await act(async () => first!);
    expect(result.current.savingConfigurations).toEqual([]);
  });
});

function app(id: string, isAccessible: boolean, isEnabled: boolean) {
  return {
    id,
    name: id,
    description: null,
    installUrl: null,
    isAccessible,
    isEnabled,
    pluginDisplayNames: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
