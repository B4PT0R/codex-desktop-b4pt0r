import {
  Children,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export function CardStack({
  children,
  className = "",
  controlBar,
  max_cards,
  style,
  ...props
}: {
  children: ReactNode;
  className?: string;
  controlBar?: ReactNode;
  max_cards?: number;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  const scrollable = max_cards !== undefined && Children.count(children) > max_cards;
  const stackStyle = max_cards === undefined ? style : {
    ...style,
    "--card-stack-max-height": `${max_cards * 58}px`,
    "--card-stack-compact-max-height": `${max_cards * 34}px`,
  } as CSSProperties;

  return (
    <div className={`card-stack ${className}`.trim()} style={stackStyle} {...props}>
      {controlBar}
      {scrollable ? (
        <div className="card-stack-scroll-region" tabIndex={0}>
          {children}
        </div>
      ) : children}
    </div>
  );
}
