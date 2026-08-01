import type { ReactNode } from "react";

export function IconSubheader({
  className = "",
  headingLevel,
  icon,
  subtitle,
  title,
}: {
  className?: string;
  headingLevel?: 2 | 3;
  icon?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "strong";

  return (
    <div
      className={`icon-subheader${icon !== undefined ? " has-icon" : ""} ${className}`.trim()}
    >
      {icon !== undefined && (
        <span className="icon-subheader-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="icon-subheader-copy">
        <Heading>{title}</Heading>
        {subtitle !== undefined && <small>{subtitle}</small>}
      </span>
    </div>
  );
}
