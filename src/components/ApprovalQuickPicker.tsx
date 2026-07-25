import { Check, LoaderCircle, ShieldQuestion } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { ApprovalPolicy } from "../lib/protocol";

type Props = {
  allowed?: ApprovalPolicy[];
  onChange: (policy: ApprovalPolicy) => Promise<boolean>;
  policy: ApprovalPolicy;
};

const policies: ApprovalPolicy[] = ["untrusted", "on-request", "never"];

export function ApprovalQuickPicker({ allowed, onChange, policy }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState<ApprovalPolicy>();
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
      className="approval-quick-picker-shell"
      ref={shell}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open && !updating) {
          event.preventDefault();
          closePicker();
        }
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        ref={trigger}
      >
        <ShieldQuestion />
        {t(`approvalPolicy.short.${policy}`)}
      </button>
      {open && (
        <div
          aria-label={t("approvalPolicy.title")}
          aria-modal="false"
          className="approval-quick-picker"
          role="dialog"
        >
          <div className="permission-quick-picker-heading">
            <ShieldQuestion />
            <div>
              <strong>{t("approvalPolicy.title")}</strong>
              <small>{t("approvalPolicy.detail")}</small>
            </div>
          </div>
          <div className="permission-quick-picker-list" role="listbox">
            {policies.map((candidate) => {
              const selected = candidate === policy;
              return (
                <button
                  aria-selected={selected}
                  className={selected ? "selected" : ""}
                  disabled={
                    Boolean(updating) ||
                    (allowed !== undefined && !allowed.includes(candidate))
                  }
                  key={candidate}
                  onClick={async () => {
                    setUpdating(candidate);
                    const changed = await onChange(candidate);
                    setUpdating(undefined);
                    if (changed) closePicker();
                  }}
                  role="option"
                  type="button"
                >
                  <span className="permission-quick-picker-icon">
                    <ShieldQuestion />
                  </span>
                  <span>
                    <strong>{t(`approvalPolicy.${candidate}`)}</strong>
                    <small>{t(`approvalPolicy.${candidate}.detail`)}</small>
                  </span>
                  {updating === candidate ? (
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
