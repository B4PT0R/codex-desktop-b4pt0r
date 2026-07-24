import {
  Check,
  Eye,
  FolderPen,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { PermissionProfileSummary } from "../lib/appServerTypes";
import type { Permission } from "../lib/protocol";

type PermissionQuickPickerProps = {
  onChange: (permission: Permission) => Promise<boolean>;
  permission: Permission;
  profiles: PermissionProfileSummary[];
};

export function PermissionQuickPicker({
  onChange,
  permission,
  profiles,
}: PermissionQuickPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState<string>();
  const shell = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!shell.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function closePicker() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div
      className="permission-quick-picker-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open && !updating) {
          event.preventDefault();
          closePicker();
        }
      }}
      ref={shell}
    >
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        ref={trigger}
      >
        <ShieldCheck />
        {permissionLabel(permission, t)}
      </button>
      {open && (
        <div
          aria-label={t("permissionPicker.title")}
          aria-modal="false"
          className="permission-quick-picker"
          role="dialog"
        >
          <div className="permission-quick-picker-heading">
            <ShieldCheck />
            <div>
              <strong>{t("permissionPicker.title")}</strong>
              <small>{t("permissionPicker.detail")}</small>
            </div>
          </div>
          <div className="permission-quick-picker-list" role="listbox">
            {profiles.map((profile) => {
              const selected = equivalentPermission(
                profile.id,
                permission,
              );
              const Icon = permissionIcon(profile.id);
              return (
                <button
                  aria-selected={selected}
                  className={selected ? "selected" : ""}
                  disabled={!profile.allowed || Boolean(updating)}
                  key={profile.id}
                  onClick={async () => {
                    setUpdating(profile.id);
                    const changed = await onChange(profile.id);
                    setUpdating(undefined);
                    if (changed) closePicker();
                  }}
                  role="option"
                  type="button"
                >
                  <span className="permission-quick-picker-icon">
                    <Icon />
                  </span>
                  <span>
                    <strong>{permissionLabel(profile.id, t)}</strong>
                    <small>
                      {profile.description ||
                        permissionDetail(profile.id, t)}
                    </small>
                  </span>
                  {updating === profile.id ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    selected && <Check />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function equivalentPermission(profile: string, permission: string) {
  return normalizePermission(profile) === normalizePermission(permission);
}

function normalizePermission(permission: string) {
  if (permission === "read-only") return ":read-only";
  if (permission === "workspace-write") return ":workspace";
  if (permission === "danger-full-access") return ":danger-full-access";
  return permission;
}

function permissionIcon(permission: string) {
  const normalized = normalizePermission(permission);
  if (normalized === ":read-only") return Eye;
  if (normalized === ":workspace") return FolderPen;
  return ShieldAlert;
}

function permissionLabel(
  permission: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  const normalized = normalizePermission(permission);
  if (normalized === ":read-only") return t("chat.permission.readOnly");
  if (normalized === ":workspace") return t("chat.permission.workspace");
  return t("chat.permission.fullAccess");
}

function permissionDetail(
  permission: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  const normalized = normalizePermission(permission);
  if (normalized === ":read-only")
    return t("permissionPicker.readOnlyDetail");
  if (normalized === ":workspace")
    return t("permissionPicker.workspaceDetail");
  return t("permissionPicker.fullAccessDetail");
}
