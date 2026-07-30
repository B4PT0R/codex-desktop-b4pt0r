import { Check, LoaderCircle } from "lucide-react";
import type { ComponentType } from "react";
import { RoundIcon } from "./RoundIcon";

export function SettingsChoiceOption({
  description,
  disabled = false,
  icon,
  label,
  onClick,
  selected = false,
  unavailable = false,
  updating = false,
}: {
  description: string;
  disabled?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void | Promise<void>;
  selected?: boolean;
  unavailable?: boolean;
  updating?: boolean;
}) {
  return (
    <button
      aria-selected={selected}
      className={`settings-option-card${selected ? " selected" : ""}`}
      disabled={disabled}
      onClick={() => void onClick()}
      role="option"
      type="button"
    >
      <RoundIcon
        className="settings-option-icon"
        icon={icon}
        size="medium"
        variant="secondary"
      />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      {updating ? (
        <LoaderCircle className="spin" />
      ) : selected ? (
        <Check />
      ) : unavailable ? (
        <small className="settings-option-unavailable">×</small>
      ) : null}
    </button>
  );
}
