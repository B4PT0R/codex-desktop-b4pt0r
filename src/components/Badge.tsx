import type {
  ComponentType,
  HTMLAttributes,
  ReactNode,
} from "react";

type BadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  label: ReactNode;
  size?: "small" | "medium" | "large";
  tone?: "neutral" | "success" | "warning" | "danger" | "experimental";
  variant?: "primary" | "secondary" | "tertiary";
};

export function Badge({
  className = "",
  icon: Icon,
  iconClassName,
  label,
  size = "small",
  tone = "neutral",
  variant = "secondary",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`badge badge-${size} badge-${variant} badge-${tone} ${className}`.trim()}
      {...props}
    >
      {Icon && <Icon className={iconClassName} />}
      <span className="badge-label">{label}</span>
    </span>
  );
}
