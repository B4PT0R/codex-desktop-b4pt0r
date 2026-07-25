import { useEffect, useState } from "react";
import { isDesktopApp, request } from "./codex";
import { appServerRecord } from "./appServerValues";
import type { ApprovalPolicy } from "./protocol";

export type ConfigRequirements = {
  managed: boolean;
  managedHooksOnly: boolean;
  allowedPermissionProfiles?: Record<string, boolean>;
  defaultPermission?: string;
  allowedApprovalPolicies?: ApprovalPolicy[];
};

const emptyRequirements: ConfigRequirements = {
  managed: false,
  managedHooksOnly: false,
};

export function useConfigRequirements(enabled: boolean) {
  const [requirements, setRequirements] =
    useState<ConfigRequirements>(emptyRequirements);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !isDesktopApp()) return;
    let disposed = false;
    setLoading(true);
    setError(undefined);
    void request("configRequirements/read")
      .then((response) => {
        if (!disposed) setRequirements(normalizeConfigRequirements(response));
      })
      .catch((cause) => {
        if (!disposed)
          setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [enabled]);

  return { ...requirements, error, loading };
}

export function normalizeConfigRequirements(
  response: unknown,
): ConfigRequirements {
  const envelope = appServerRecord(response);
  const value = appServerRecord(envelope?.requirements);
  if (!value) return emptyRequirements;
  const allowed = appServerRecord(value.allowedPermissionProfiles);
  const allowedApprovals = Array.isArray(value.allowedApprovalPolicies)
    ? value.allowedApprovalPolicies.filter(isApprovalPolicy)
    : undefined;
  return {
    managed: true,
    managedHooksOnly: value.allowManagedHooksOnly === true,
    allowedPermissionProfiles: allowed
      ? Object.fromEntries(
          Object.entries(allowed).flatMap(([id, enabled]) =>
            typeof enabled === "boolean" ? [[id, enabled]] : [],
          ),
        )
      : undefined,
    defaultPermission:
      typeof value.defaultPermissions === "string"
        ? value.defaultPermissions
        : undefined,
    allowedApprovalPolicies: allowedApprovals?.length
      ? allowedApprovals
      : undefined,
  };
}

function isApprovalPolicy(value: unknown): value is ApprovalPolicy {
  return value === "untrusted" || value === "on-request" || value === "never";
}
