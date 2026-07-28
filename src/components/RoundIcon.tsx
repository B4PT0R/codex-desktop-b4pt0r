import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
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

type RoundIconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  enabled?: boolean;
  gap?: "small" | "medium" | "large";
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
  label?: ReactNode;
  size?: "small" | "medium" | "large";
  variant?: "primary" | "secondary" | "tertiary";
};

export const RoundIconButton = forwardRef<
  HTMLButtonElement,
  RoundIconButtonProps
>(function RoundIconButton(
  {
    className = "",
    enabled,
    gap = "medium",
    icon: Icon,
    iconClassName,
    label,
    size = "medium",
    variant = "secondary",
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      className={`round-icon-button round-icon-${size} round-icon-${variant} round-icon-gap-${gap}${label !== undefined ? " round-icon-button-labeled" : ""}${!Icon ? " round-icon-button-label-only" : ""} ${className}`.trim()}
      data-enabled={enabled}
      ref={ref}
      type={type}
      {...props}
    >
      {Icon && (
        <span className="round-icon-button-glyph">
          <Icon className={iconClassName} />
        </span>
      )}
      {label !== undefined && (
        <span className="round-icon-button-label">{label}</span>
      )}
    </button>
  );
});
