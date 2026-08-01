import type { ReactNode } from "react";

export function Note({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
}) {
  return (
    <aside className={`settings-note ${className}`.trim()}>
      {title !== undefined && <strong>{title}</strong>}
      <div>{children}</div>
    </aside>
  );
}
