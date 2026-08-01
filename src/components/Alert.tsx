import type { HTMLAttributes, ReactNode } from "react";

export type AlertTone = "error" | "neutral" | "success" | "warning";

export function Alert({
  children,
  className = "",
  tone = "warning",
  ...props
}: {
  children: ReactNode;
  tone?: AlertTone;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  const role = props.role ?? (tone === "error" ? "alert" : "status");
  return (
    <div
      {...props}
      className={`settings-alert ${tone} ${className}`.trim()}
      role={role}
    >
      {children}
    </div>
  );
}
