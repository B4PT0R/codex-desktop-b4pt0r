import { Eye, FolderPen, ShieldAlert } from "lucide-react";
import type { Translate } from "../i18n/I18nProvider";

export function normalizePermission(permission: string) {
  if (permission === "read-only") return ":read-only";
  if (permission === "workspace-write") return ":workspace";
  if (permission === "danger-full-access") return ":danger-full-access";
  return permission;
}

export function permissionIcon(permission: string) {
  const normalized = normalizePermission(permission);
  if (normalized === ":read-only") return Eye;
  if (normalized === ":workspace") return FolderPen;
  return ShieldAlert;
}

export function permissionLabel(permission: string, t: Translate) {
  const normalized = normalizePermission(permission);
  if (normalized === ":read-only") return t("permissionPicker.readOnly");
  if (normalized === ":workspace") return t("permissionPicker.workspace");
  if (normalized === ":danger-full-access")
    return t("permissionPicker.fullAccess");
  return permission;
}

export function permissionDetail(permission: string, t: Translate) {
  const normalized = normalizePermission(permission);
  if (normalized === ":read-only")
    return t("permissionPicker.readOnlyDetail");
  if (normalized === ":workspace")
    return t("permissionPicker.workspaceDetail");
  if (normalized === ":danger-full-access")
    return t("permissionPicker.fullAccessDetail");
  return t("settings.config.value.custom");
}
