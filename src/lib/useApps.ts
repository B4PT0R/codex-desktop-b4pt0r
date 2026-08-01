import { useCallback, useEffect, useRef, useState } from "react";
import type { AppInfo, AppsListResponse } from "./appServerTypes";
import { isDesktopApp, request, subscribeAppServerMessages } from "./codex";
import { appEnabledConfigWriteParams, appsListParams } from "./protocol";
import { useI18n } from "../i18n/I18nProvider";

export type AppsController = {
  apps: AppInfo[];
  configurableApps: AppInfo[];
  error?: string;
  loading: boolean;
  updatingApps: string[];
  refresh: () => Promise<void>;
  setEnabled: (app: AppInfo, enabled: boolean) => Promise<void>;
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
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [updatingApps, setUpdatingApps] = useState<string[]>([]);
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
      const response = await request<AppsListResponse>(
        "app/list",
        appsListParams(threadId),
      );
      if (current === generation.current)
        setApps(response.data.slice(0, 100));
    } catch (cause) {
      if (current === generation.current)
        setError(cause instanceof Error ? cause.message : String(cause));
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
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setUpdatingApps((ids) => ids.filter((id) => id !== app.id));
      }
    },
    [refresh, t],
  );

  return {
    apps: selectActive(apps),
    configurableApps: selectConfigurable(apps),
    error,
    loading,
    updatingApps,
    refresh,
    setEnabled,
  };
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
  ) {
    return [];
  }
  return [
    {
      id: app.id,
      name: app.name,
      description: typeof app.description === "string" ? app.description : null,
      installUrl: typeof app.installUrl === "string" ? app.installUrl : null,
      isAccessible: app.isAccessible,
      isEnabled: app.isEnabled,
      pluginDisplayNames: Array.isArray(app.pluginDisplayNames)
        ? app.pluginDisplayNames.filter(
            (name): name is string => typeof name === "string",
          )
        : [],
    },
  ];
}
