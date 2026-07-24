import { useCallback, useEffect, useRef, useState } from "react";
import type { AppInfo, AppsListResponse } from "./appServerTypes";
import { isTauri, request, subscribeAppServerMessages } from "./codex";
import { appsListParams } from "./protocol";
import { useI18n } from "../i18n/I18nProvider";

export type AppsController = {
  apps: AppInfo[];
  error?: string;
  loading: boolean;
  refresh: () => Promise<void>;
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
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!isTauri()) {
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
        setApps(selectAccessible(response.data));
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
    if (!enabled || !isTauri()) return;
    return subscribeAppServerMessages((message) => {
      if (message.method !== "app/list/updated") return;
      const data = appListFromNotification(message.params);
      if (data) setApps(selectAccessible(data));
    });
  }, [enabled]);

  return { apps, error, loading, refresh };
}

function selectAccessible(apps: AppInfo[]) {
  return apps.filter((app) => app.isAccessible && app.isEnabled).slice(0, 100);
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
