import type { HTMLAttributes, ReactNode } from "react";

export function CardStack({
  children,
  className = "",
  controlBar,
  ...props
}: {
  children: ReactNode;
  className?: string;
  controlBar?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    <div className={`card-stack ${className}`.trim()} {...props}>
      {controlBar}
      {children}
    </div>
  );
}
