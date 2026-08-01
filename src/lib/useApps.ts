import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppConfiguration,
  AppInfo,
  AppsConfiguration,
  AppsInstalledResponse,
  AppsListResponse,
  AppsReadResponse,
  AppToolSummary,
  ConfigReadResponse,
  InstalledApp,
} from "./appServerTypes";
import { isDesktopApp, request, subscribeAppServerMessages } from "./codex";
import { openExternalTarget, safeExternalHttpUrl } from "./externalTarget";
import {
  appEnabledConfigWriteParams,
  appsConfigBatchWriteParams,
  appsInstalledParams,
  appsListParams,
  appsReadParams,
  configReadParams,
  type AppConfigurationDraft,
} from "./protocol";
import { useI18n } from "../i18n/I18nProvider";

export type AppConfigurationEditorData = {
  app?: AppInfo;
  config: AppConfiguration;
  defaults: AppConfiguration;
  tools: AppToolSummary[];
};

export type AppsController = {
  apps: AppInfo[];
  catalogApps: AppInfo[];
  configurableApps: AppInfo[];
  installedApps: Record<string, InstalledApp>;
  error?: string;
  loading: boolean;
  updatingApps: string[];
  savingConfigurations: string[];
  refresh: () => Promise<void>;
  setEnabled: (app: AppInfo, enabled: boolean) => Promise<void>;
  readConfiguration: (app?: AppInfo) => Promise<AppConfigurationEditorData | null>;
  saveConfiguration: (draft: AppConfigurationDraft) => Promise<boolean>;
  openInstall: (app: AppInfo) => Promise<boolean>;
};

export function useApps({
  enabled,
  threadId,
}: {
  enabled: boolean;
  threadId?: string;
}): AppsController {
  const { t } = useI18n();
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [installedApps, setInstalledApps] = useState<Record<string, InstalledApp>>({});
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [updatingApps, setUpdatingApps] = useState<string[]>([]);
  const [savingConfigurations, setSavingConfigurations] = useState<string[]>([]);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!isDesktopApp()) {
      setError(t("apps.nativeOnly"));
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const [catalog, installed] = await Promise.all([
        readAppsCatalog(threadId),
        request<AppsInstalledResponse>(
          "app/installed",
          appsInstalledParams(threadId),
        ).catch(() => ({ apps: [] })),
      ]);
      if (current === generation.current) {
        setApps(catalog);
        const runtimeApps = Array.isArray(installed.apps) ? installed.apps : [];
        setInstalledApps(Object.fromEntries(runtimeApps.map((app) => [app.id, app])));
      }
    } catch (cause) {
      if (current === generation.current) setError(errorMessage(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [t, threadId]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !isDesktopApp()) return;
    return subscribeAppServerMessages((message) => {
      if (message.method !== "app/list/updated") return;
      const data = appListFromNotification(message.params);
      if (data) setApps(data.slice(0, 100));
    });
  }, [enabled]);

  const setEnabled = useCallback(
    async (app: AppInfo, appEnabled: boolean) => {
      if (!isDesktopApp()) {
        setError(t("apps.nativeOnly"));
        return;
      }
      setUpdatingApps((ids) => [...new Set([...ids, app.id])]);
      setError(undefined);
      try {
        await request(
          "config/value/write",
          appEnabledConfigWriteParams(app.id, appEnabled),
        );
        await refresh();
      } catch (cause) {
        setError(errorMessage(cause));
      } finally {
        setUpdatingApps((ids) => ids.filter((id) => id !== app.id));
      }
    },
    [refresh, t],
  );

  const readConfiguration = useCallback(async (app?: AppInfo) => {
    if (!isDesktopApp()) {
      setError(t("apps.nativeOnly"));
      return null;
    }
    setError(undefined);
    try {
      const [configResponse, metadata] = await Promise.all([
        request<ConfigReadResponse>("config/read", configReadParams()),
        app
          ? request<AppsReadResponse>("app/read", appsReadParams([app.id]))
          : Promise.resolve({ apps: [], missingAppIds: [] }),
      ]);
      const appsConfig = normalizeAppsConfiguration(configResponse.config.apps);
      return {
        ...(app ? { app } : {}),
        config: app
          ? normalizeAppConfiguration(appsConfig[app.id], app.isEnabled)
          : normalizeDefaultConfiguration(appsConfig._default),
        defaults: normalizeDefaultConfiguration(appsConfig._default),
        tools: normalizeToolSummaries(metadata.apps[0]?.toolSummaries),
      };
    } catch (cause) {
      setError(errorMessage(cause));
      return null;
    }
  }, [t]);

  const saveConfiguration = useCallback(async (draft: AppConfigurationDraft) => {
    const key = draft.appId ?? "_default";
    if (savingConfigurations.includes(key)) return false;
    setSavingConfigurations((ids) => [...ids, key]);
    setError(undefined);
    try {
      await request("config/batchWrite", appsConfigBatchWriteParams(draft));
      await refresh();
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setSavingConfigurations((ids) => ids.filter((id) => id !== key));
    }
  }, [refresh, savingConfigurations]);

  const openInstall = useCallback(async (app: AppInfo) => {
    const target = safeExternalHttpUrl(app.installUrl);
    if (!target) {
      setError(t("integrations.apps.installUnavailable"));
      return false;
    }
    setError(undefined);
    try {
      await openExternalTarget(target);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }, [t]);

  return {
    apps: selectActive(apps),
    catalogApps: apps,
    configurableApps: selectConfigurable(apps),
    installedApps,
    error,
    loading,
    updatingApps,
    savingConfigurations,
    refresh,
    setEnabled,
    readConfiguration,
    saveConfiguration,
    openInstall,
  };
}

async function readAppsCatalog(threadId?: string) {
  const result: AppInfo[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 4; page += 1) {
    const response = await request<AppsListResponse>(
      "app/list",
      appsListParams(threadId, page === 0, cursor),
    );
    result.push(...response.data.flatMap(normalizeAppInfo));
    if (!response.nextCursor || result.length >= 200) break;
    cursor = response.nextCursor;
  }
  return result.slice(0, 200);
}

function selectActive(apps: AppInfo[]) {
  return apps.filter((app) => app.isAccessible && app.isEnabled).slice(0, 100);
}

function selectConfigurable(apps: AppInfo[]) {
  return apps.filter((app) => app.isAccessible).slice(0, 100);
}

function appListFromNotification(value: unknown): AppInfo[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;
  return data.flatMap(normalizeAppInfo);
}

function normalizeAppInfo(value: unknown): AppInfo[] {
  if (!value || typeof value !== "object") return [];
  const app = value as Partial<AppInfo>;
  if (
    typeof app.id !== "string" ||
    typeof app.name !== "string" ||
    typeof app.isAccessible !== "boolean" ||
    typeof app.isEnabled !== "boolean"
  ) return [];
  return [{
    id: app.id,
    name: app.name,
    description: typeof app.description === "string" ? app.description : null,
    logoUrl: typeof app.logoUrl === "string" ? app.logoUrl : null,
    logoUrlDark: typeof app.logoUrlDark === "string" ? app.logoUrlDark : null,
    distributionChannel: typeof app.distributionChannel === "string" ? app.distributionChannel : null,
    branding: normalizeBranding(app.branding),
    appMetadata: normalizeAppMetadata(app.appMetadata),
    installUrl: typeof app.installUrl === "string" ? app.installUrl : null,
    isAccessible: app.isAccessible,
    isEnabled: app.isEnabled,
    pluginDisplayNames: Array.isArray(app.pluginDisplayNames)
      ? app.pluginDisplayNames.filter((name): name is string => typeof name === "string")
      : [],
  }];
}

function normalizeBranding(value: AppInfo["branding"] | undefined): AppInfo["branding"] {
  if (!value || typeof value !== "object") return null;
  return {
    category: typeof value.category === "string" ? value.category : null,
    developer: typeof value.developer === "string" ? value.developer : null,
    website: typeof value.website === "string" ? value.website : null,
    isDiscoverableApp: value.isDiscoverableApp === true,
  };
}

function normalizeAppMetadata(value: AppInfo["appMetadata"] | undefined): AppInfo["appMetadata"] {
  if (!value || typeof value !== "object") return null;
  return {
    categories: Array.isArray(value.categories) ? value.categories.filter((item): item is string => typeof item === "string") : null,
    seoDescription: typeof value.seoDescription === "string" ? value.seoDescription : null,
    developer: typeof value.developer === "string" ? value.developer : null,
    version: typeof value.version === "string" ? value.version : null,
  };
}

function normalizeAppsConfiguration(value: AppsConfiguration | null | undefined) {
  return value && typeof value === "object" ? value : {};
}

function normalizeDefaultConfiguration(value: AppConfiguration | null | undefined): AppConfiguration {
  return {
    enabled: value?.enabled ?? true,
    approvals_reviewer: value?.approvals_reviewer ?? null,
    destructive_enabled: value?.destructive_enabled ?? true,
    open_world_enabled: value?.open_world_enabled ?? true,
    default_tools_approval_mode: value?.default_tools_approval_mode ?? null,
  };
}

function normalizeAppConfiguration(value: AppConfiguration | null | undefined, enabled: boolean): AppConfiguration {
  return {
    enabled: value?.enabled ?? enabled,
    approvals_reviewer: value?.approvals_reviewer ?? null,
    destructive_enabled: value?.destructive_enabled ?? null,
    open_world_enabled: value?.open_world_enabled ?? null,
    default_tools_approval_mode: value?.default_tools_approval_mode ?? null,
    default_tools_enabled: value?.default_tools_enabled ?? null,
    tools: value?.tools ?? {},
  };
}

function normalizeToolSummaries(value: AppToolSummary[] | null | undefined) {
  return Array.isArray(value) ? value.slice(0, 200) : [];
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}
