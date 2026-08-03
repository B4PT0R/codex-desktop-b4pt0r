import { useEffect, useState } from "react";
import { isDesktopApp, request } from "./codex";
import { appServerRecord } from "./appServerValues";
import type {
  ApprovalPolicy,
  ApprovalsReviewer,
  WebSearchMode,
} from "./protocol";

export type ConfigRequirements = {
  managed: boolean;
  managedHooksOnly: boolean;
  allowRemoteControl?: boolean;
  allowedPermissionProfiles?: Record<string, boolean>;
  defaultPermission?: string;
  allowedApprovalPolicies?: ApprovalPolicy[];
  allowedApprovalsReviewers?: ApprovalsReviewer[];
  allowedWebSearchModes?: WebSearchMode[];
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
    if (!enabled || !isDesktopApp()) {
      setRequirements(emptyRequirements);
      setError(undefined);
      setLoading(false);
      return;
    }
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
  const allowedApprovalsReviewers = Array.isArray(
    value.allowedApprovalsReviewers,
  )
    ? value.allowedApprovalsReviewers.flatMap((reviewer) => {
        if (reviewer === "user") return ["user" as const];
        if (reviewer === "auto_review" || reviewer === "guardian_subagent")
          return ["auto_review" as const];
        return [];
      })
    : undefined;
  const allowedWebSearchModes = Array.isArray(value.allowedWebSearchModes)
    ? value.allowedWebSearchModes.filter(isWebSearchMode)
    : undefined;
  return {
    managed: true,
    managedHooksOnly: value.allowManagedHooksOnly === true,
    allowRemoteControl:
      typeof value.allowRemoteControl === "boolean"
        ? value.allowRemoteControl
        : undefined,
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
    allowedApprovalsReviewers: allowedApprovalsReviewers?.length
      ? [...new Set(allowedApprovalsReviewers)]
      : undefined,
    allowedWebSearchModes: allowedWebSearchModes?.length
      ? allowedWebSearchModes
      : undefined,
  };
}

function isWebSearchMode(value: unknown): value is WebSearchMode {
  return (
    value === "disabled" ||
    value === "cached" ||
    value === "indexed" ||
    value === "live"
  );
}

function isApprovalPolicy(value: unknown): value is ApprovalPolicy {
  return value === "untrusted" || value === "on-request" || value === "never";
}
