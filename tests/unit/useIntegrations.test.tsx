// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
const openChromiumMock = vi.hoisted(() => vi.fn());
const openUrlMock = vi.hoisted(() => vi.fn());
const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/codex", () => ({
  isDesktopApp: () => true,
  request: requestMock,
  subscribeAppServerMessages: subscribeMock,
}));
vi.mock("../../src/lib/useChromium", () => ({
  openInChromium: openChromiumMock,
}));
vi.mock("../../src/lib/nativeBridge", () => ({ invoke: invokeMock, openUrl: openUrlMock }));

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
  invokeMock.mockReset().mockResolvedValue(undefined);
});

describe("inventaire des intégrations", () => {
  it("crée un skill borné puis recharge l’inventaire App Server", async () => {
    requestMock.mockResolvedValue({ data: [{ cwd: "/project", skills: [], errors: [] }] });
    const { result } = renderHook(() => useIntegrations({ cwd: "/project", enabled: false }));
    let created = false;
    await act(async () => {
      created = await result.current.createSkill({
        name: "review-changes",
        description: "Relire les changements.",
        instructions: "# Workflow\n\nInspecter le diff.",
        scope: "repo",
      });
    });
    expect(created).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("create_skill_scaffold", {
      name: "review-changes",
      description: "Relire les changements.",
      instructions: "# Workflow\n\nInspecter le diff.",
      scope: "repo",
      workspace: "/project",
    });
    expect(requestMock).toHaveBeenCalledWith("skills/list", { cwds: ["/project"], forceReload: true });
  });

  it("ignore une seconde création de Skill tant que la première est en cours", async () => {
    const create = deferred<void>();
    invokeMock.mockReturnValue(create.promise);
    requestMock.mockResolvedValue({
      data: [{ cwd: "/project", skills: [], errors: [] }],
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    const draft = {
      name: "review-changes",
      description: "Relire les changements.",
      instructions: "# Workflow\n\nInspecter le diff.",
      scope: "repo" as const,
    };
    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    act(() => {
      first = result.current.createSkill(draft);
      duplicate = result.current.createSkill(draft);
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    await expect(duplicate).resolves.toBe(false);
    create.resolve();
    await act(() => first);
  });

  it("écrit puis recharge un nouveau serveur MCP", async () => {
    requestMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({ layers: [] });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    let added = false;
    await act(async () => {
      added = await result.current.addMcpServer({
        name: "docs",
        transport: "http",
        url: "https://mcp.example.test",
      });
    });
    expect(added).toBe(true);
    expect(requestMock).toHaveBeenNthCalledWith(1, "config/value/write", {
      keyPath: 'mcp_servers."docs"',
      value: { url: "https://mcp.example.test" },
      mergeStrategy: "upsert",
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, "config/mcpServer/reload");
    expect(requestMock).toHaveBeenNthCalledWith(3, "mcpServerStatus/list", {
      cursor: null,
      detail: "toolsAndAuthOnly",
      limit: 100,
      threadId: null,
    });
  });

  it("ignore un second ajout MCP tant que le premier est en cours", async () => {
    const write = deferred<void>();
    requestMock.mockImplementation((method: string) => {
      if (method === "config/value/write") return write.promise;
      if (method === "mcpServerStatus/list")
        return Promise.resolve({ data: [], nextCursor: null });
      if (method === "config/read") return Promise.resolve({ layers: [] });
      return Promise.resolve({});
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    const draft = {
      name: "docs",
      transport: "http" as const,
      url: "https://mcp.example.test",
    };
    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    act(() => {
      first = result.current.addMcpServer(draft);
      duplicate = result.current.addMcpServer(draft);
    });
    expect(
      requestMock.mock.calls.filter(([method]) => method === "config/value/write"),
    ).toHaveLength(1);
    await expect(duplicate).resolves.toBe(false);
    write.resolve();
    await act(() => first);
  });

  it("supprime puis recharge un serveur MCP de la configuration utilisateur", async () => {
    requestMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ data: [], nextCursor: null })
      .mockResolvedValueOnce({ layers: [] });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    let removed = false;
    await act(async () => {
      removed = await result.current.removeMcpServer("docs");
    });
    expect(removed).toBe(true);
    expect(requestMock).toHaveBeenNthCalledWith(1, "config/value/write", {
      keyPath: 'mcp_servers."docs"',
      value: null,
      mergeStrategy: "replace",
    });
    expect(requestMock).toHaveBeenNthCalledWith(2, "config/mcpServer/reload");
  });

  it("ignore une seconde suppression simultanée du même serveur MCP", async () => {
    const write = deferred<void>();
    requestMock.mockImplementation((method: string) => {
      if (method === "config/value/write") return write.promise;
      if (method === "mcpServerStatus/list")
        return Promise.resolve({ data: [], nextCursor: null });
      if (method === "config/read") return Promise.resolve({ layers: [] });
      return Promise.resolve({});
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    act(() => {
      first = result.current.removeMcpServer("docs");
      duplicate = result.current.removeMcpServer("docs");
    });
    expect(
      requestMock.mock.calls.filter(([method]) => method === "config/value/write"),
    ).toHaveLength(1);
    await expect(duplicate).resolves.toBe(false);
    write.resolve();
    await act(() => first);
  });
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
        if (method === "config/read") {
          return Promise.resolve({
            layers: [
              {
                name: { type: "user", file: "/home/alice/.codex/config.toml", profile: null },
                config: { mcp_servers: { first: {}, second: {} } },
                version: "1",
              },
              {
                name: { type: "system", file: "/etc/codex/config.toml" },
                config: { mcp_servers: { builtin: {} } },
                version: "1",
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
    expect(result.current.removableMcpServers).toEqual(["first", "second"]);
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

  it("ignore une seconde modification simultanée du même Skill", async () => {
    const write = deferred<{ effectiveEnabled: boolean }>();
    requestMock.mockImplementation((method: string) => {
      if (method === "skills/config/write") return write.promise;
      return Promise.resolve({ data: [], nextCursor: null });
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    const skill = {
      name: "review",
      description: "Review",
      path: "/skills/review/SKILL.md",
      scope: "user",
      enabled: true,
    };
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = result.current.setSkillEnabled(skill, false);
      duplicate = result.current.setSkillEnabled(skill, false);
    });
    expect(
      requestMock.mock.calls.filter(([method]) => method === "skills/config/write"),
    ).toHaveLength(1);
    await expect(duplicate).resolves.toBeUndefined();
    write.resolve({ effectiveEnabled: false });
    await act(() => first);
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

  it("conserve seulement l’état de démarrage MCP du thread courant", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "skills/list"
          ? { data: [] }
          : { data: [], nextCursor: null },
      ),
    );
    const { result, rerender } = renderHook(
      ({ threadId }) =>
        useIntegrations({ cwd: "/project", enabled: true, threadId }),
      { initialProps: { threadId: "thread-1" as string | undefined } },
    );
    await waitFor(() => expect(subscribeMock).toHaveBeenCalledOnce());
    const handler = subscribeMock.mock.calls[0][0];

    act(() => {
      handler({
        method: "mcpServer/startupStatus/updated",
        params: {
          threadId: "another-thread",
          name: "ignored",
          status: "failed",
          error: "wrong thread",
        },
      });
      handler({
        method: "mcpServer/startupStatus/updated",
        params: {
          threadId: "thread-1",
          name: "github",
          status: "failed",
          error: "token expired",
          failureReason: "reauthenticationRequired",
        },
      });
    });
    expect(result.current.mcpStartup).toEqual({
      github: {
        status: "failed",
        error: "token expired",
        failureReason: "reauthenticationRequired",
      },
    });

    rerender({ threadId: "thread-2" });
    await waitFor(() => expect(result.current.mcpStartup).toEqual({}));
  });

  it("recharge explicitement la configuration MCP avant l’inventaire", async () => {
    requestMock.mockImplementation((method: string) =>
      Promise.resolve(
        method === "skills/list"
          ? { data: [] }
          : method === "config/mcpServer/reload"
            ? {}
            : { data: [], nextCursor: null },
      ),
    );
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    await act(() => result.current.reloadMcp());
    expect(requestMock.mock.calls.slice(0, 2)).toEqual([
      ["config/mcpServer/reload"],
      [
        "mcpServerStatus/list",
        {
          cursor: null,
          detail: "toolsAndAuthOnly",
          limit: 100,
          threadId: null,
        },
      ],
    ]);
    expect(result.current.mcpAuthNotice).toBe(
      "Configuration MCP rechargée.",
    );
  });

  it("ignore un second reload MCP tant que le premier est en cours", async () => {
    const reload = deferred<void>();
    requestMock.mockImplementation((method: string) => {
      if (method === "config/mcpServer/reload") return reload.promise;
      if (method === "mcpServerStatus/list")
        return Promise.resolve({ data: [], nextCursor: null });
      if (method === "config/read") return Promise.resolve({ layers: [] });
      return Promise.resolve({ data: [] });
    });
    const { result } = renderHook(() =>
      useIntegrations({ cwd: "/project", enabled: false }),
    );
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = result.current.reloadMcp();
      duplicate = result.current.reloadMcp();
    });
    expect(
      requestMock.mock.calls.filter(
        ([method]) => method === "config/mcpServer/reload",
      ),
    ).toHaveLength(1);
    await expect(duplicate).resolves.toBeUndefined();
    reload.resolve();
    await act(() => first);
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
