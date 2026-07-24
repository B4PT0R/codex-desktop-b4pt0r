import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppServerSkill,
  AppServerHook,
  HooksListResponse,
  ListMcpServerStatusResponse,
  McpServerStatus,
  SkillsListResponse,
} from "./appServerTypes";
import { isDesktopApp, request, subscribeAppServerMessages } from "./codex";
import {
  mcpServerOauthLoginParams,
  mcpServerStatusListParams,
  skillsConfigWriteParams,
  skillsListParams,
  hooksListParams,
} from "./protocol";
import { useI18n } from "../i18n/I18nProvider";
import type { Translate } from "../i18n/translate";
import { openExternalTarget, safeExternalHttpUrl } from "./externalTarget";

export type IntegrationInventory<T> = {
  data: T[];
  error?: string;
  loading: boolean;
};

export type IntegrationsController = {
  hooks: IntegrationInventory<AppServerHook> & { warnings: string[] };
  mcpServers: IntegrationInventory<McpServerStatus>;
  skills: IntegrationInventory<AppServerSkill>;
  refreshMcp: () => Promise<void>;
  refreshSkills: () => Promise<void>;
  refreshHooks: () => Promise<void>;
  authenticateMcp: (server: McpServerStatus) => Promise<void>;
  authenticatingMcp: string[];
  mcpAuthNotice?: string;
  setSkillEnabled: (skill: AppServerSkill, enabled: boolean) => Promise<void>;
  updatingSkills: string[];
};

type UseIntegrationsOptions = {
  cwd: string;
  enabled: boolean;
  threadId?: string;
  hooksEnabled?: boolean;
};

export function useIntegrations({
  cwd,
  enabled,
  threadId,
  hooksEnabled = false,
}: UseIntegrationsOptions): IntegrationsController {
  const { t } = useI18n();
  const [skills, setSkills] = useState<IntegrationInventory<AppServerSkill>>({
    data: [],
    loading: false,
  });
  const [hooks, setHooks] = useState<
    IntegrationInventory<AppServerHook> & { warnings: string[] }
  >({ data: [], loading: false, warnings: [] });
  const [mcpServers, setMcpServers] = useState<
    IntegrationInventory<McpServerStatus>
  >({ data: [], loading: false });
  const [updatingSkills, setUpdatingSkills] = useState<string[]>([]);
  const [authenticatingMcp, setAuthenticatingMcp] = useState<string[]>([]);
  const [mcpAuthNotice, setMcpAuthNotice] = useState<string>();
  const skillsGeneration = useRef(0);
  const hooksGeneration = useRef(0);
  const mcpGeneration = useRef(0);
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
      if (generation === mcpGeneration.current) {
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

  const setSkillEnabled = useCallback(
    async (skill: AppServerSkill, nextEnabled: boolean) => {
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
        setUpdatingSkills((paths) =>
          paths.filter((path) => path !== skill.path),
        );
      }
    },
    [],
  );

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
    if (!enabled || !isDesktopApp()) return;
    return subscribeAppServerMessages((message) => {
      if (message.method === "skills/changed") void refreshSkills();
      if (message.method === "mcpServer/startupStatus/updated")
        void refreshMcp();
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
  }, [enabled, refreshMcp, refreshSkills, t]);

  return {
    authenticateMcp,
    authenticatingMcp,
    hooks,
    mcpAuthNotice,
    mcpServers,
    refreshMcp,
    refreshHooks,
    refreshSkills,
    setSkillEnabled,
    skills,
    updatingSkills,
  };
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
