import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";

type IconButtonProps = Omit<
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

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
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
        className={`icon-button round-icon-${size} round-icon-${variant} icon-button-gap-${gap}${label !== undefined ? " icon-button-labeled" : ""}${!Icon ? " icon-button-label-only" : ""} ${className}`.trim()}
        data-enabled={enabled}
        ref={ref}
        type={type}
        {...props}
      >
        {Icon && (
          <span className="icon-button-glyph">
            <Icon className={iconClassName} />
          </span>
        )}
        {label !== undefined && (
          <span className="icon-button-label">{label}</span>
        )}
      </button>
    );
  },
);
