// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
const openChromiumMock = vi.hoisted(() => vi.fn());
const openUrlMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isTauri: () => true,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));
vi.mock("../../src/lib/useChromium", () => ({
  openInChromium: openChromiumMock,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock }));

import { useIntegrations } from "../../src/lib/useIntegrations";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  requestMock.mockReset();
  subscribeMock.mockReset();
  subscribeMock.mockReturnValue(vi.fn());
  openChromiumMock.mockReset().mockResolvedValue(undefined);
  openUrlMock.mockReset().mockResolvedValue(undefined);
});

describe("inventaire des intégrations", () => {
  it("charge et normalise les hooks sans charger les autres intégrations", async () => {
    requestMock.mockResolvedValue({
      data: [
        {
          cwd: "/project",
          hooks: [
            {
              key: "lint",
              eventName: "postToolUse",
              handlerType: "command",
              matcher: "shell",
              command: "npm run lint",
              timeoutSec: 30,
              statusMessage: "Vérification",
              sourcePath: "/project/.codex/hooks.json",
              source: "project",
              pluginId: null,
              displayOrder: 1,
              enabled: true,
              isManaged: false,
              currentHash: "abc",
              trustStatus: "trusted",
            },
          ],
          warnings: ["Configuration héritée"],
          errors: [],
        },
      ],
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false, hooksEnabled: true }),
    );
    await waitFor(() => expect(result.current.hooks.loading).toBe(false));
    expect(requestMock).toHaveBeenCalledWith("hooks/list", {
      cwds: ["/project"],
    });
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(result.current.hooks.data[0]).toMatchObject({
      key: "lint",
      command: "npm run lint",
      trustStatus: "trusted",
    });
    expect(result.current.hooks.warnings).toEqual(["Configuration héritée"]);
  });

  it("charge les skills et toutes les pages MCP à l’ouverture", async () => {
    requestMock.mockImplementation(
      (method: string, params?: { cursor?: string }) => {
        if (method === "skills/list") {
          return Promise.resolve({
            data: [
              {
                cwd: "/project",
                skills: [
                  {
                    name: "review",
                    description: "Review",
                    path: "/skills/review/SKILL.md",
                    scope: "user",
                    enabled: true,
                  },
                ],
                errors: [],
              },
            ],
          });
        }
        return Promise.resolve({
          data: [{ name: params?.cursor ? "second" : "first", tools: {} }],
          nextCursor: params?.cursor ? null : "page-2",
        });
      },
    );
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: true, threadId: "thread-1" }),
    );
    await waitFor(() => expect(result.current.mcpServers.loading).toBe(false));
    expect(result.current.skills.data.map((skill) => skill.name)).toEqual([
      "review",
    ]);
    expect(result.current.mcpServers.data.map((server) => server.name)).toEqual(
      ["first", "second"],
    );
    expect(requestMock).toHaveBeenCalledWith("skills/list", {
      cwds: ["/project"],
      forceReload: true,
    });
  });

  it("applique l’état effectif renvoyé lors d’une modification", async () => {
    requestMock.mockImplementation((method: string) => {
      if (method === "skills/list") {
        return Promise.resolve({
          data: [
            {
              cwd: "/project",
              skills: [
                {
                  name: "review",
                  description: "Review",
                  path: "/skills/review/SKILL.md",
                  scope: "user",
                  enabled: true,
                },
              ],
              errors: [],
            },
          ],
        });
      }
      if (method === "skills/config/write")
        return Promise.resolve({ effectiveEnabled: false });
      return Promise.resolve({ data: [], nextCursor: null });
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: true }),
    );
    await waitFor(() => expect(result.current.skills.data).toHaveLength(1));
    await act(() =>
      result.current.setSkillEnabled(result.current.skills.data[0], false),
    );
    expect(result.current.skills.data[0].enabled).toBe(false);
    expect(result.current.updatingSkills).toEqual([]);
  });

  it("réactualise l’inventaire après les notifications App Server", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "skills/list"
          ? { data: [] }
          : { data: [], nextCursor: null },
      ),
    );
    renderHook(() => useIntegrations({ cwd: "/project", enabled: true }));
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    const handler = subscribeMock.mock.calls[0][0];
    const initialSkillCalls = requestMock.mock.calls.filter(
      ([method]) => method === "skills/list",
    ).length;
    act(() => handler({ method: "skills/changed" }));
    await waitFor(() =>
      expect(
        requestMock.mock.calls.filter(([method]) => method === "skills/list"),
      ).toHaveLength(initialSkillCalls + 1),
    );
  });

  it("ouvre OAuth dans Chromium puis traite la notification de réussite", async () => {
    requestMock.mockImplementation((method: string) => {
      if (method === "skills/list") return Promise.resolve({ data: [] });
      if (method === "mcpServer/oauth/login")
        return Promise.resolve({ authorizationUrl: "https://auth.test/start" });
      return Promise.resolve({ data: [], nextCursor: null });
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: true, threadId: "thread-1" }),
    );
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    const server = {
      name: "github",
      serverInfo: null,
      tools: {},
      resources: [],
      resourceTemplates: [],
      authStatus: "notLoggedIn" as const,
    };
    await act(() => result.current.authenticateMcp(server));
    expect(requestMock).toHaveBeenCalledWith("mcpServer/oauth/login", {
      name: "github",
      threadId: "thread-1",
      scopes: null,
      timeoutSecs: null,
    });
    expect(openChromiumMock).toHaveBeenCalledWith("https://auth.test/start");
    expect(result.current.authenticatingMcp).toEqual(["github"]);

    act(() =>
      subscribeMock.mock.calls[0][0]({
        method: "mcpServer/oauthLogin/completed",
        params: { name: "github", success: true },
      }),
    );
    await waitFor(() => expect(result.current.authenticatingMcp).toEqual([]));
    expect(result.current.mcpAuthNotice).toBe(
      "Serveur MCP connecté avec succès.",
    );
  });

  it("utilise le navigateur système si Chromium ne peut pas s’ouvrir", async () => {
    openChromiumMock.mockRejectedValueOnce(new Error("absent"));
    requestMock.mockResolvedValueOnce({
      authorizationUrl: "https://auth.test/fallback",
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    await act(() =>
      result.current.authenticateMcp({
        name: "calendar",
        serverInfo: null,
        tools: {},
        resources: [],
        resourceTemplates: [],
        authStatus: "notLoggedIn",
      }),
    );
    expect(openUrlMock).toHaveBeenCalledWith("https://auth.test/fallback");
    expect(result.current.mcpAuthNotice).toContain("navigateur système");
  });

  it("ignore un rafraîchissement de skills devenu obsolète", async () => {
    const first = deferred<{ data: [] }>();
    const second = deferred<{
      data: Array<{
        cwd: string;
        errors: [];
        skills: Array<{
          name: string;
          description: string;
          path: string;
          scope: string;
          enabled: boolean;
        }>;
      }>;
    }>();
    requestMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    let firstRefresh!: Promise<void>;
    let secondRefresh!: Promise<void>;
    act(() => {
      firstRefresh = result.current.refreshSkills();
      secondRefresh = result.current.refreshSkills();
    });
    second.resolve({
      data: [
        {
          cwd: "/project",
          errors: [],
          skills: [
            {
              name: "recent",
              description: "Récent",
              path: "/recent/SKILL.md",
              scope: "user",
              enabled: true,
            },
          ],
        },
      ],
    });
    await act(() => secondRefresh);
    first.resolve({ data: [] });
    await act(() => firstRefresh);
    expect(result.current.skills.data.map((skill) => skill.name)).toEqual([
      "recent",
    ]);
  });
});
