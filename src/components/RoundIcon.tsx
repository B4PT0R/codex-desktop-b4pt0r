import {
  type ComponentType,
  type HTMLAttributes,
} from "react";

type RoundIconProps = HTMLAttributes<HTMLSpanElement> & {
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  size?: "small" | "medium" | "large";
  variant?: "primary" | "secondary" | "tertiary";
};

export function RoundIcon({
  className = "",
  icon: Icon,
  iconClassName,
  size = "medium",
  variant = "secondary",
  ...props
}: RoundIconProps) {
  return (
    <span
      className={`round-icon round-icon-${size} round-icon-${variant} ${className}`.trim()}
      {...props}
    >
      <Icon className={iconClassName} />
    </span>
  );
}
