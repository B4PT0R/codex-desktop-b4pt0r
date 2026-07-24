import type { Approval } from "../types";
import type { AppServerMessage } from "./codex";
import { defaultTranslate, type Translate } from "../i18n/translate";

type ApprovalDecision = "accept" | "session" | "decline";
type PermissionProfile = Record<string, unknown>;

export function approvalFromMessage(
  message: AppServerMessage,
  t: Translate = defaultTranslate,
): Approval | undefined {
  if (message.id == null) return undefined;
  const params = objectValue(message.params);
  if (!params) return undefined;

  if (message.method === "item/commandExecution/requestApproval") {
    const cwd = stringValue(params.cwd);
    const decisions = stringArray(params.availableDecisions);
    return {
      requestId: message.id,
      kind: "command",
      title: t("approval.command.title"),
      description:
        stringValue(params.reason) ??
        t("approval.command.description", {
          workspace: cwd ?? t("approval.command.workspace"),
        }),
      command: stringValue(params.command),
      allowSession:
        decisions === undefined || decisions.includes("acceptForSession"),
    };
  }

  if (message.method === "item/fileChange/requestApproval") {
    const grantRoot = stringValue(params.grantRoot);
    return {
      requestId: message.id,
      kind: "file",
      title: t("approval.file.title"),
      description:
        stringValue(params.reason) ??
        (grantRoot
          ? t("approval.file.descriptionPath", { path: grantRoot })
          : t("approval.file.description")),
      allowSession: true,
    };
  }

  if (message.method === "item/permissions/requestApproval") {
    const permissions = objectValue(params.permissions) ?? {};
    return {
      requestId: message.id,
      kind: "permissions",
      title: t("approval.permissions.title"),
      description:
        stringValue(params.reason) ?? t("approval.permissions.description"),
      command: permissionSummary(permissions, t),
      permissions,
      allowSession: true,
    };
  }

  return undefined;
}

export function approvalResponse(
  approval: Approval,
  decision: ApprovalDecision,
) {
  if (approval.kind !== "permissions") {
    return { decision: decision === "session" ? "acceptForSession" : decision };
  }
  const permissions =
    decision === "decline"
      ? {}
      : Object.fromEntries(
          Object.entries(approval.permissions ?? {}).filter(
            ([, value]) => value != null,
          ),
        );
  return {
    permissions,
    scope: decision === "session" ? "session" : "turn",
  };
}

function permissionSummary(profile: PermissionProfile, t: Translate) {
  const parts: string[] = [];
  if (profile.network != null) parts.push(t("approval.permissions.network"));
  if (profile.fileSystem != null) parts.push(t("approval.permissions.files"));
  return parts.join(" · ") || undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}
