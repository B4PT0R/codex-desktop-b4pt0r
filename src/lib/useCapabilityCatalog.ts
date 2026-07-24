import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CollaborationModeListResponse,
  CollaborationModePreset,
  PermissionProfileListResponse,
  PermissionProfileSummary,
} from "./appServerTypes";
import { isTauri, request } from "./codex";
import {
  collaborationModeListParams,
  permissionProfileListParams,
} from "./protocol";
import { useI18n } from "../i18n/I18nProvider";
import type { Translate } from "../i18n/translate";

export type CatalogState<T> = {
  data: T[];
  error?: string;
  loading: boolean;
};

export type CapabilityCatalog = {
  collaborationModes: CatalogState<CollaborationModePreset>;
  permissionProfiles: CatalogState<PermissionProfileSummary>;
  refresh: () => Promise<void>;
};

const fallbackProfiles: PermissionProfileSummary[] = [
  { id: ":read-only", description: null, allowed: true },
  { id: ":workspace", description: null, allowed: true },
  { id: ":danger-full-access", description: null, allowed: true },
];

export function useCapabilityCatalog({
  cwd,
  enabled,
}: {
  cwd: string;
  enabled: boolean;
}): CapabilityCatalog {
  const { t } = useI18n();
  const [collaborationModes, setCollaborationModes] = useState<
    CatalogState<CollaborationModePreset>
  >({ data: fallbackModes(t), loading: false });
  const [permissionProfiles, setPermissionProfiles] = useState<
    CatalogState<PermissionProfileSummary>
  >({ data: fallbackProfiles, loading: false });
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!isTauri()) {
      const error = t("capabilities.nativeOnly");
      setCollaborationModes({
        data: fallbackModes(t),
        error,
        loading: false,
      });
      setPermissionProfiles({ data: fallbackProfiles, error, loading: false });
      return;
    }
    setCollaborationModes((state) => ({
      ...state,
      error: undefined,
      loading: true,
    }));
    setPermissionProfiles((state) => ({
      ...state,
      error: undefined,
      loading: true,
    }));
    const [modes, profiles] = await Promise.all([
      settle(
        request<CollaborationModeListResponse>(
          "collaborationMode/list",
          collaborationModeListParams(),
        ),
      ),
      settle(loadPermissionProfiles(cwd, t)),
    ]);
    if (current !== generation.current) return;
    setCollaborationModes({
      data:
        modes.ok && modes.value.data.length > 0
          ? modes.value.data
          : fallbackModes(t),
      error: !modes.ok ? errorMessage(modes.error) : undefined,
      loading: false,
    });
    setPermissionProfiles({
      data:
        profiles.ok && profiles.value.length > 0
          ? profiles.value
          : fallbackProfiles,
      error: !profiles.ok ? errorMessage(profiles.error) : undefined,
      loading: false,
    });
  }, [cwd, t]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { collaborationModes, permissionProfiles, refresh };
}

function fallbackModes(t: Translate): CollaborationModePreset[] {
  return [
    {
      name: t("capabilities.mode.agent"),
      mode: "default",
      model: null,
      reasoning_effort: null,
    },
    {
      name: t("capabilities.mode.plan"),
      mode: "plan",
      model: null,
      reasoning_effort: "medium",
    },
  ];
}

async function loadPermissionProfiles(cwd: string, t: Translate) {
  const data: PermissionProfileSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const response = await request<PermissionProfileListResponse>(
      "permissionProfile/list",
      permissionProfileListParams(cwd, cursor),
    );
    data.push(...response.data);
    cursor = response.nextCursor ?? undefined;
    if (!cursor) return data;
  }
  throw new Error(t("capabilities.permissions.limit"));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function settle<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}
