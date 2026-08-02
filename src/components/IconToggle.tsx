import type {
  ButtonHTMLAttributes,
  ComponentType,
  ReactNode,
} from "react";

type ToggleIcon = ComponentType<{ className?: string }>;

export type IconToggleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onChange" | "onClick"
> & {
  checked: boolean;
  checkedIcon?: ToggleIcon;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  size?: "small" | "medium" | "large";
  text?: ReactNode;
  uncheckedIcon?: ToggleIcon;
  variant?: "primary" | "secondary" | "tertiary";
};

export function IconToggle({
  checked,
  checkedIcon: CheckedIcon,
  className = "",
  disabled,
  label,
  onCheckedChange,
  size = "medium",
  text,
  type = "button",
  uncheckedIcon: UncheckedIcon,
  variant = "secondary",
  ...props
}: IconToggleProps) {
  const Icon = checked ? CheckedIcon : UncheckedIcon;
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`icon-toggle icon-toggle-${size} round-icon-${variant}${text !== undefined ? " icon-toggle-labeled" : ""} ${className}`.trim()}
      data-enabled={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      role="switch"
      type={type}
      {...props}
    >
      {text !== undefined && <span className="icon-toggle-text">{text}</span>}
      <span aria-hidden="true" className="icon-toggle-track">
        <span className="icon-toggle-thumb">
          {Icon && <Icon className="icon-toggle-glyph" />}
        </span>
      </span>
    </button>
  );
}
