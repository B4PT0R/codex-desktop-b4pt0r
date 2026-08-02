import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppServerSkill,
  AppServerPlugin,
  AppServerHook,
  HooksListResponse,
  ListMcpServerStatusResponse,
  McpServerStatus,
  McpServerStartupStatus,
  SkillsListResponse,
  PluginInstalledResponse,
} from "./appServerTypes";
import { isDesktopApp, request, subscribeAppServerMessages } from "./codex";
import {
  mcpServerOauthLoginParams,
  mcpServerStatusListParams,
  skillsConfigWriteParams,
  skillsListParams,
  hooksListParams,
  mcpServerConfigWriteParams,
  mcpServerConfigRemoveParams,
  configReadParams,
  pluginEnabledWriteParams,
  pluginInstalledParams,
  type McpServerDraft,
} from "./protocol";
import { useI18n } from "../i18n/I18nProvider";
import type { Translate } from "../i18n/translate";
import { openExternalTarget, safeExternalHttpUrl } from "./externalTarget";
import { invoke } from "./nativeBridge";
import {
  normalizeInstalledPlugins,
  pluginMarketplaceErrorCount,
} from "./pluginInventory";

export type SkillDraft = {
  name: string;
  description: string;
  instructions: string;
  scope: "user" | "repo";
};

export type IntegrationInventory<T> = {
  data: T[];
  error?: string;
  loading: boolean;
};

export type IntegrationsController = {
  hooks: IntegrationInventory<AppServerHook> & { warnings: string[] };
  mcpServers: IntegrationInventory<McpServerStatus>;
  mcpStartup: Record<string, McpServerStartupStatus>;
  skills: IntegrationInventory<AppServerSkill>;
  plugins: IntegrationInventory<AppServerPlugin>;
  refreshMcp: () => Promise<void>;
  reloadMcp: () => Promise<void>;
  reloadingMcp: boolean;
  refreshSkills: () => Promise<void>;
  refreshHooks: () => Promise<void>;
  authenticateMcp: (server: McpServerStatus) => Promise<void>;
  authenticatingMcp: string[];
  mcpAuthNotice?: string;
  addMcpServer: (draft: McpServerDraft) => Promise<boolean>;
  addingMcpServer: boolean;
  removeMcpServer: (name: string) => Promise<boolean>;
  removingMcpServers: string[];
  removableMcpServers: string[];
  setSkillEnabled: (skill: AppServerSkill, enabled: boolean) => Promise<void>;
  updatingSkills: string[];
  refreshPlugins: () => Promise<void>;
  setPluginEnabled: (plugin: AppServerPlugin, enabled: boolean) => Promise<void>;
  updatingPlugins: string[];
  createSkill: (draft: SkillDraft) => Promise<boolean>;
  creatingSkill: boolean;
};

type UseIntegrationsOptions = {
  cwd: string;
  enabled: boolean;
  threadId?: string;
  hooksEnabled?: boolean;
  pluginsEnabled?: boolean;
};

export function useIntegrations({
  cwd,
  enabled,
  threadId,
  hooksEnabled = false,
  pluginsEnabled = false,
}: UseIntegrationsOptions): IntegrationsController {
  const { t } = useI18n();
  const [skills, setSkills] = useState<IntegrationInventory<AppServerSkill>>({
    data: [],
    loading: false,
  });
  const [plugins, setPlugins] = useState<IntegrationInventory<AppServerPlugin>>({
    data: [],
    loading: false,
  });
  const [removingMcpServers, setRemovingMcpServers] = useState<string[]>([]);
  const [removableMcpServers, setRemovableMcpServers] = useState<string[]>([]);
  const [hooks, setHooks] = useState<
    IntegrationInventory<AppServerHook> & { warnings: string[] }
  >({ data: [], loading: false, warnings: [] });
  const [mcpServers, setMcpServers] = useState<
    IntegrationInventory<McpServerStatus>
  >({ data: [], loading: false });
  const [updatingSkills, setUpdatingSkills] = useState<string[]>([]);
  const [updatingPlugins, setUpdatingPlugins] = useState<string[]>([]);
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [authenticatingMcp, setAuthenticatingMcp] = useState<string[]>([]);
  const [mcpAuthNotice, setMcpAuthNotice] = useState<string>();
  const [reloadingMcp, setReloadingMcp] = useState(false);
  const [addingMcpServer, setAddingMcpServer] = useState(false);
  const [mcpStartup, setMcpStartup] = useState<
    Record<string, McpServerStartupStatus>
  >({});
  const skillsGeneration = useRef(0);
  const pluginsGeneration = useRef(0);
  const hooksGeneration = useRef(0);
  const mcpGeneration = useRef(0);
  // Every MCP mutation owns a write/reload/refresh transaction.
  const mcpMutationInFlight = useRef(false);
  // Skill toggles conflict only when they target the same file.
  const updatingSkillPaths = useRef(new Set<string>());
  const updatingPluginIds = useRef(new Set<string>());
  const creatingSkillInFlight = useRef(false);
  const mcpAuthInFlight = useRef(new Set<string>());

  const refreshSkills = useCallback(async () => {
    const generation = ++skillsGeneration.current;
    if (!isDesktopApp()) {
      setSkills({
        data: [],
        error: t("integrations.nativeOnly"),
        loading: false,
      });
      return;
    }
    setSkills((state) => ({ ...state, error: undefined, loading: true }));
    try {
      const response = await request<SkillsListResponse>(
        "skills/list",
        skillsListParams(cwd, true),
      );
      if (generation === skillsGeneration.current) {
        setSkills({
          data: response.data.flatMap((entry) => entry.skills),
          error: skillErrors(response, t),
          loading: false,
        });
      }
    } catch (error) {
      if (generation === skillsGeneration.current) {
        setSkills((state) => ({
          ...state,
          error: errorMessage(error),
          loading: false,
        }));
      }
    }
  }, [cwd, t]);

  const refreshPlugins = useCallback(async () => {
    const generation = ++pluginsGeneration.current;
    if (!isDesktopApp()) {
      setPlugins({ data: [], error: t("integrations.nativeOnly"), loading: false });
      return;
    }
    setPlugins((state) => ({ ...state, error: undefined, loading: true }));
    try {
      const response = await request<PluginInstalledResponse>(
        "plugin/installed",
        pluginInstalledParams(cwd),
      );
      if (generation !== pluginsGeneration.current) return;
      setPlugins({
        data: normalizeInstalledPlugins(response),
        error: pluginErrors(response, t),
        loading: false,
      });
    } catch (error) {
      if (generation === pluginsGeneration.current) {
        setPlugins((state) => ({
          ...state,
          error: errorMessage(error),
          loading: false,
        }));
      }
    }
  }, [cwd, t]);

  const refreshHooks = useCallback(async () => {
    const generation = ++hooksGeneration.current;
    if (!isDesktopApp()) {
      setHooks({
        data: [],
        error: t("integrations.nativeOnly"),
        loading: false,
        warnings: [],
      });
      return;
    }
    setHooks((state) => ({ ...state, error: undefined, loading: true }));
    try {
      const response = await request<HooksListResponse>(
        "hooks/list",
        hooksListParams(cwd),
      );
      if (generation !== hooksGeneration.current) return;
      const entry = response.data.find((candidate) => candidate.cwd === cwd) ??
        response.data[0];
      setHooks({
        data: normalizeHooks(entry?.hooks),
        error: hookErrors(entry?.errors, t),
        loading: false,
        warnings: stringList(entry?.warnings, 50, 2_000),
      });
    } catch (error) {
      if (generation === hooksGeneration.current)
        setHooks((state) => ({
          ...state,
          error: errorMessage(error),
          loading: false,
        }));
    }
  }, [cwd, t]);

  const refreshMcp = useCallback(async () => {
    const generation = ++mcpGeneration.current;
    if (!isDesktopApp()) {
      setMcpServers({
        data: [],
        error: t("integrations.nativeOnly"),
        loading: false,
      });
      return;
    }
    setMcpServers((state) => ({ ...state, error: undefined, loading: true }));
    try {
      const data: McpServerStatus[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const response = await request<ListMcpServerStatusResponse>(
          "mcpServerStatus/list",
          mcpServerStatusListParams(threadId, cursor),
        );
        data.push(...response.data);
        cursor = response.nextCursor ?? undefined;
        if (!cursor) break;
      }
      const removable = await request("config/read", configReadParams(undefined, true))
        .then(removableMcpServerNames)
        .catch(() => []);
      if (generation === mcpGeneration.current) {
        setRemovableMcpServers(removable);
        setMcpServers({
          data,
          error: cursor ? t("integrations.mcp.limit") : undefined,
          loading: false,
        });
      }
    } catch (error) {
      if (generation === mcpGeneration.current) {
        setMcpServers((state) => ({
          ...state,
          error: errorMessage(error),
          loading: false,
        }));
      }
    }
  }, [t, threadId]);

  const reloadMcp = useCallback(async () => {
    if (mcpMutationInFlight.current) return;
    mcpMutationInFlight.current = true;
    setReloadingMcp(true);
    setMcpAuthNotice(undefined);
    setMcpStartup({});
    setMcpServers((state) => ({ ...state, error: undefined }));
    try {
      await request("config/mcpServer/reload");
      await refreshMcp();
      setMcpAuthNotice(t("integrations.mcp.reloaded"));
    } catch (error) {
      setMcpServers((state) => ({
        ...state,
        error: t("integrations.mcp.reloadError", {
          detail: errorMessage(error),
        }),
      }));
    } finally {
      mcpMutationInFlight.current = false;
      setReloadingMcp(false);
    }
  }, [refreshMcp, t]);

  const addMcpServer = useCallback(async (draft: McpServerDraft) => {
    if (mcpMutationInFlight.current) return false;
    mcpMutationInFlight.current = true;
    setAddingMcpServer(true);
    setMcpServers((state) => ({ ...state, error: undefined }));
    try {
      await request("config/value/write", mcpServerConfigWriteParams(draft));
      await request("config/mcpServer/reload");
      await refreshMcp();
      setMcpAuthNotice(t("integrations.mcp.added", { name: draft.name }));
      return true;
    } catch (error) {
      setMcpServers((state) => ({
        ...state,
        error: t("integrations.mcp.addError", { detail: errorMessage(error) }),
      }));
      return false;
    } finally {
      mcpMutationInFlight.current = false;
      setAddingMcpServer(false);
    }
  }, [refreshMcp, t]);

  const removeMcpServer = useCallback(async (name: string) => {
    if (mcpMutationInFlight.current) return false;
    mcpMutationInFlight.current = true;
    setRemovingMcpServers((names) => [...names, name]);
    setMcpServers((state) => ({ ...state, error: undefined }));
    try {
      await request("config/value/write", mcpServerConfigRemoveParams(name));
      await request("config/mcpServer/reload");
      await refreshMcp();
      setMcpAuthNotice(t("integrations.mcp.removed", { name }));
      return true;
    } catch (error) {
      setMcpServers((state) => ({
        ...state,
        error: t("integrations.mcp.removeError", { detail: errorMessage(error) }),
      }));
      return false;
    } finally {
      mcpMutationInFlight.current = false;
      setRemovingMcpServers((names) =>
        names.filter((candidate) => candidate !== name),
      );
    }
  }, [refreshMcp, t]);

  const setSkillEnabled = useCallback(
    async (skill: AppServerSkill, nextEnabled: boolean) => {
      if (updatingSkillPaths.current.has(skill.path)) return;
      updatingSkillPaths.current.add(skill.path);
      setUpdatingSkills((paths) => [...paths, skill.path]);
      try {
        const response = await request<{ effectiveEnabled: boolean }>(
          "skills/config/write",
          skillsConfigWriteParams(skill.path, nextEnabled),
        );
        setSkills((state) => ({
          ...state,
          error: undefined,
          data: state.data.map((item) =>
            item.path === skill.path
              ? { ...item, enabled: response.effectiveEnabled }
              : item,
          ),
        }));
      } catch (error) {
        setSkills((state) => ({ ...state, error: errorMessage(error) }));
      } finally {
        updatingSkillPaths.current.delete(skill.path);
        setUpdatingSkills((paths) =>
          paths.filter((path) => path !== skill.path),
        );
      }
    },
    [],
  );

  const setPluginEnabled = useCallback(
    async (plugin: AppServerPlugin, nextEnabled: boolean) => {
      if (
        plugin.availability === "DISABLED_BY_ADMIN" ||
        updatingPluginIds.current.has(plugin.id)
      ) return;
      updatingPluginIds.current.add(plugin.id);
      setUpdatingPlugins((ids) => [...ids, plugin.id]);
      try {
        await request(
          "config/value/write",
          pluginEnabledWriteParams(plugin.id, nextEnabled),
        );
        setPlugins((state) => ({
          ...state,
          error: undefined,
          data: state.data.map((item) =>
            item.id === plugin.id ? { ...item, enabled: nextEnabled } : item,
          ),
        }));
        await Promise.all([refreshSkills(), refreshMcp()]);
      } catch (error) {
        setPlugins((state) => ({ ...state, error: errorMessage(error) }));
      } finally {
        updatingPluginIds.current.delete(plugin.id);
        setUpdatingPlugins((ids) => ids.filter((id) => id !== plugin.id));
      }
    },
    [refreshMcp, refreshSkills],
  );

  const createSkill = useCallback(async (draft: SkillDraft) => {
    if (creatingSkillInFlight.current || !isDesktopApp()) return false;
    creatingSkillInFlight.current = true;
    setCreatingSkill(true);
    setSkills((state) => ({ ...state, error: undefined }));
    try {
      await invoke("create_skill_scaffold", { ...draft, workspace: cwd });
      await refreshSkills();
      return true;
    } catch (error) {
      setSkills((state) => ({ ...state, error: errorMessage(error) }));
      return false;
    } finally {
      creatingSkillInFlight.current = false;
      setCreatingSkill(false);
    }
  }, [cwd, refreshSkills]);

  const authenticateMcp = useCallback(
    async (server: McpServerStatus) => {
      if (mcpAuthInFlight.current.has(server.name)) return;
      mcpAuthInFlight.current.add(server.name);
      setAuthenticatingMcp((names) => [...names, server.name]);
      setMcpAuthNotice(undefined);
      setMcpServers((state) => ({ ...state, error: undefined }));
      try {
        const response = await request<{ authorizationUrl?: unknown }>(
          "mcpServer/oauth/login",
          mcpServerOauthLoginParams(server.name, threadId),
        );
        const authorizationUrl = safeExternalHttpUrl(response.authorizationUrl);
        if (!authorizationUrl) throw new Error(t("integrations.auth.invalidUrl"));
        const openMode = await openExternalTarget(authorizationUrl);
        if (openMode === "chromium") {
          setMcpAuthNotice(t("integrations.auth.browserOpened"));
        } else {
          setMcpAuthNotice(t("integrations.auth.systemBrowserOpened"));
        }
      } catch (error) {
        mcpAuthInFlight.current.delete(server.name);
        setAuthenticatingMcp((names) =>
          names.filter((name) => name !== server.name),
        );
        setMcpServers((state) => ({
          ...state,
          error: t("integrations.auth.startError", {
            detail: errorMessage(error),
          }),
        }));
      }
    },
    [t, threadId],
  );

  useEffect(() => {
    if (!enabled) return;
    void Promise.all([refreshSkills(), refreshMcp()]);
  }, [enabled, refreshMcp, refreshSkills]);

  useEffect(() => {
    if (hooksEnabled) void refreshHooks();
  }, [hooksEnabled, refreshHooks]);

  useEffect(() => {
    if (pluginsEnabled) void refreshPlugins();
  }, [pluginsEnabled, refreshPlugins]);

  useEffect(() => {
    setMcpStartup({});
  }, [threadId]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    return subscribeAppServerMessages((message) => {
      if (message.method === "skills/changed" && enabled) void refreshSkills();
      if (message.method === "mcpServer/startupStatus/updated") {
        const update = normalizeMcpStartupUpdate(message.params, threadId);
        if (update) {
          setMcpStartup((statuses) => ({
            ...statuses,
            [update.name]: update.status,
          }));
        }
      }
      if (message.method === "mcpServer/oauthLogin/completed") {
        const params = recordValue(message.params);
        const name = typeof params?.name === "string" ? params.name : undefined;
        if (!name) return;
        mcpAuthInFlight.current.delete(name);
        setAuthenticatingMcp((names) =>
          names.filter((candidate) => candidate !== name),
        );
        if (params?.success === true) {
          setMcpAuthNotice(t("integrations.auth.success"));
          void refreshMcp();
        } else {
          setMcpAuthNotice(undefined);
          setMcpServers((state) => ({
            ...state,
            error: t("integrations.auth.completeError", {
              detail:
                typeof params?.error === "string"
                  ? params.error
                  : t("integrations.auth.unknownError"),
            }),
          }));
        }
      }
    });
  }, [enabled, refreshMcp, refreshSkills, t, threadId]);

  return {
    addMcpServer,
    addingMcpServer,
    createSkill,
    creatingSkill,
    authenticateMcp,
    authenticatingMcp,
    hooks,
    mcpAuthNotice,
    mcpServers,
    mcpStartup,
    plugins,
    refreshMcp,
    removeMcpServer,
    removingMcpServers,
    removableMcpServers,
    reloadMcp,
    reloadingMcp,
    refreshHooks,
    refreshPlugins,
    refreshSkills,
    setSkillEnabled,
    setPluginEnabled,
    skills,
    updatingSkills,
    updatingPlugins,
  };
}

function pluginErrors(response: PluginInstalledResponse, t: Translate) {
  const count = pluginMarketplaceErrorCount(response);
  if (!count) return undefined;
  return t(
    count === 1
      ? "integrations.plugins.errorOne"
      : "integrations.plugins.errorMany",
    { count },
  );
}

function removableMcpServerNames(response: unknown) {
  const root = recordValue(response);
  if (!Array.isArray(root?.layers)) return [];
  const userLayer = root.layers.find((candidate) => {
    const layer = recordValue(candidate);
    const source = recordValue(layer?.name);
    return source?.type === "user" && (source.profile === null || source.profile === undefined);
  });
  const config = recordValue(recordValue(userLayer)?.config);
  const servers = recordValue(config?.mcp_servers);
  return servers ? Object.keys(servers) : [];
}

function normalizeHooks(value: unknown): AppServerHook[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 500)
    .filter(
      (hook): hook is AppServerHook =>
        !!hook &&
        typeof hook === "object" &&
        typeof hook.key === "string" &&
        typeof hook.eventName === "string" &&
        typeof hook.handlerType === "string" &&
        typeof hook.sourcePath === "string" &&
        typeof hook.source === "string" &&
        typeof hook.trustStatus === "string" &&
        typeof hook.enabled === "boolean",
    )
    .map((hook) => ({
      ...hook,
      key: hook.key.slice(0, 512),
      eventName: hook.eventName.slice(0, 128),
      handlerType: hook.handlerType.slice(0, 128),
      matcher:
        typeof hook.matcher === "string" ? hook.matcher.slice(0, 2_000) : null,
      command: typeof hook.command === "string" ? hook.command.slice(0, 8_192) : null,
      sourcePath: hook.sourcePath.slice(0, 32_768),
      source: hook.source.slice(0, 128),
      trustStatus: hook.trustStatus.slice(0, 128),
      pluginId:
        typeof hook.pluginId === "string" ? hook.pluginId.slice(0, 512) : null,
      statusMessage:
        typeof hook.statusMessage === "string"
          ? hook.statusMessage.slice(0, 2_000)
          : null,
    }));
}

function normalizeMcpStartupUpdate(
  value: unknown,
  currentThreadId: string | undefined,
): { name: string; status: McpServerStartupStatus } | undefined {
  const update = recordValue(value);
  if (
    !currentThreadId ||
    update?.threadId !== currentThreadId ||
    typeof update.name !== "string" ||
    !["starting", "ready", "failed", "cancelled"].includes(
      String(update.status),
    )
  ) {
    return undefined;
  }
  const error =
    typeof update.error === "string" ? update.error.slice(0, 2_000) : undefined;
  const failureReason =
    update.failureReason === "reauthenticationRequired"
      ? update.failureReason
      : undefined;
  return {
    name: update.name.slice(0, 512),
    status: {
      status: update.status as McpServerStartupStatus["status"],
      ...(error ? { error } : {}),
      ...(failureReason ? { failureReason } : {}),
    },
  };
}

function hookErrors(
  errors: Array<{ message?: unknown }> | undefined,
  t: Translate,
) {
  if (!errors?.length) return undefined;
  return t(
    errors.length === 1
      ? "integrations.hooks.errorOne"
      : "integrations.hooks.errorMany",
    { count: Math.min(errors.length, 50) },
  );
}

function stringList(value: unknown, limit: number, maxLength: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .slice(0, limit)
        .map((item) => item.slice(0, maxLength))
    : [];
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function skillErrors(response: SkillsListResponse, t: Translate) {
  const errors = response.data.flatMap((entry) => entry.errors);
  return errors.length > 0
    ? t(
        errors.length === 1
          ? "integrations.skills.errorOne"
          : "integrations.skills.errorMany",
        { count: errors.length },
      )
    : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
