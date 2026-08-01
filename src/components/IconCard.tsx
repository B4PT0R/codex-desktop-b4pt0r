import type { ButtonHTMLAttributes, ReactNode } from "react";

export function IconCard({
  as = "div",
  children,
  className = "",
  contentDisabled = false,
  contentButtonProps,
  density = "regular",
  icon,
  onContentClick,
  subtitle,
  title,
  trailing,
}: {
  as?: "article" | "div" | "label" | "section";
  children?: ReactNode;
  className?: string;
  contentDisabled?: boolean;
  contentButtonProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "className" | "disabled" | "onClick"
  >;
  density?: "compact" | "regular";
  icon?: ReactNode;
  onContentClick?: () => void;
  subtitle?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
}) {
  const Component = as;
  const content = (
    <>
      <strong className="icon-card-title">{title}</strong>
      {subtitle !== undefined && (
        <div className="icon-card-subtitle">{subtitle}</div>
      )}
      {children}
    </>
  );

  return (
    <Component
      className={`icon-card${icon !== undefined ? " has-icon" : ""}${density === "compact" ? " compact" : ""} ${className}`.trim()}
    >
      {icon !== undefined && <span className="icon-card-icon">{icon}</span>}
      {onContentClick ? (
        <button
          className="icon-card-content icon-card-content-action"
          disabled={contentDisabled}
          onClick={onContentClick}
          type="button"
          {...contentButtonProps}
        >
          {content}
        </button>
      ) : (
        <div className="icon-card-content">{content}</div>
      )}
      {trailing !== undefined && (
        <div className="icon-card-trailing">{trailing}</div>
      )}
    </Component>
  );
}
