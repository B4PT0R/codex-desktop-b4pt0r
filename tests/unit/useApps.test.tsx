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
  it("parcourt le catalogue paginé dans une limite bornée", async () => {
    requestMock.mockImplementation((method: string, params: { cursor?: string | null }) => {
      if (method === "app/installed") return Promise.resolve({ apps: [] });
      return Promise.resolve(params.cursor
        ? { data: [app("second", false, true)], nextCursor: null }
        : { data: [app("first", true, true)], nextCursor: "page-2" });
    });
    const { result } = renderHook(() => useApps({ enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalogApps.map(({ id }) => id)).toEqual(["first", "second"]);
    expect(requestMock).toHaveBeenCalledWith("app/list", expect.objectContaining({ cursor: "page-2", forceRefetch: false }));
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
      limit: 50,
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
            {
              id: "docs",
              name: "Documents",
              isAccessible: true,
              isEnabled: true,
            },
            { id: 42 },
          ],
        },
      }),
    );
    expect(result.current.configurableApps).toEqual([
      {
        id: "docs",
        name: "Documents",
        description: null,
        logoUrl: null,
        logoUrlDark: null,
        distributionChannel: null,
        branding: null,
        appMetadata: null,
        installUrl: null,
        isAccessible: true,
        isEnabled: true,
        pluginDisplayNames: [],
      },
    ]);
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
