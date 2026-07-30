import {
  Check,
  ChevronDown,
  LoaderCircle,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { PermissionProfileSummary } from "../lib/appServerTypes";
import type { ApprovalPolicy, Permission } from "../lib/protocol";
import { RoundIcon } from "./RoundIcon";
import {
  normalizePermission,
  permissionDetail,
  permissionIcon,
  permissionLabel,
} from "./permissionPresentation";

type Props = {
  allowedApprovalPolicies?: ApprovalPolicy[];
  approvalPolicy: ApprovalPolicy;
  onChangeApprovalPolicy: (policy: ApprovalPolicy) => Promise<boolean>;
  onChangePermission: (permission: Permission) => Promise<boolean>;
  permission: Permission;
  permissionProfiles: PermissionProfileSummary[];
};

const policies: ApprovalPolicy[] = ["untrusted", "on-request", "never"];

export function SecurityQuickPicker({
  allowedApprovalPolicies,
  approvalPolicy,
  onChangeApprovalPolicy,
  onChangePermission,
  permission,
  permissionProfiles,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [updatingPermission, setUpdatingPermission] = useState<string>();
  const [updatingApproval, setUpdatingApproval] =
    useState<ApprovalPolicy>();
  const shell = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const updating = Boolean(updatingPermission || updatingApproval);

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
      className="security-quick-picker-shell"
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
        className="footer-expander-trigger security-select"
        onClick={() => setOpen((current) => !current)}
        ref={trigger}
        type="button"
      >
        {t("securityPicker.trigger")}
        <ChevronDown />
      </button>
      {open && (
        <div
          aria-label={t("securityPicker.title")}
          aria-modal="false"
          className="security-quick-picker"
          role="dialog"
        >
          <div className="permission-quick-picker-heading">
            <ShieldCheck />
            <div>
              <strong>{t("securityPicker.title")}</strong>
              <small>{t("securityPicker.detail")}</small>
            </div>
          </div>
          <section className="security-quick-picker-section">
            <div className="security-quick-picker-section-heading">
              <strong>{t("permissionPicker.title")}</strong>
              <small>{permissionLabel(permission, t)}</small>
            </div>
            <div
              aria-label={t("permissionPicker.title")}
              className="permission-quick-picker-list"
              role="listbox"
            >
              {permissionProfiles.map((profile) => {
                const selected =
                  normalizePermission(profile.id) ===
                  normalizePermission(permission);
                const Icon = permissionIcon(profile.id);
                return (
                  <button
                    aria-selected={selected}
                    className={selected ? "selected" : ""}
                    disabled={!profile.allowed || updating}
                    key={profile.id}
                    onClick={async () => {
                      setUpdatingPermission(profile.id);
                      await onChangePermission(profile.id);
                      setUpdatingPermission(undefined);
                    }}
                    role="option"
                    type="button"
                  >
                    <RoundIcon
                      className="permission-quick-picker-icon"
                      icon={Icon}
                      size="small"
                      variant="secondary"
                    />
                    <span>
                      <strong>{permissionLabel(profile.id, t)}</strong>
                      <small>
                        {profile.description ||
                          permissionDetail(profile.id, t)}
                      </small>
                    </span>
                    {updatingPermission === profile.id ? (
                      <LoaderCircle className="spin" />
                    ) : (
                      selected && <Check />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="security-quick-picker-section">
            <div className="security-quick-picker-section-heading">
              <strong>{t("approvalPolicy.title")}</strong>
              <small>{t(`approvalPolicy.short.${approvalPolicy}`)}</small>
            </div>
            <div
              aria-label={t("approvalPolicy.title")}
              className="permission-quick-picker-list"
              role="listbox"
            >
              {policies.map((candidate) => {
                const selected = candidate === approvalPolicy;
                return (
                  <button
                    aria-selected={selected}
                    className={selected ? "selected" : ""}
                    disabled={
                      updating ||
                      (allowedApprovalPolicies !== undefined &&
                        !allowedApprovalPolicies.includes(candidate))
                    }
                    key={candidate}
                    onClick={async () => {
                      setUpdatingApproval(candidate);
                      await onChangeApprovalPolicy(candidate);
                      setUpdatingApproval(undefined);
                    }}
                    role="option"
                    type="button"
                  >
                    <RoundIcon
                      className="permission-quick-picker-icon"
                      icon={ShieldQuestion}
                      size="small"
                      variant="secondary"
                    />
                    <span>
                      <strong>{t(`approvalPolicy.${candidate}`)}</strong>
                      <small>
                        {t(`approvalPolicy.${candidate}.detail`)}
                      </small>
                    </span>
                    {updatingApproval === candidate ? (
                      <LoaderCircle className="spin" />
                    ) : (
                      selected && <Check />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
