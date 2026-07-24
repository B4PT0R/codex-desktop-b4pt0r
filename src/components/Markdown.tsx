import { lazy, Suspense } from "react";

const MarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer").then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

/** Keeps streaming text cheap, then enables full GFM once the item is complete. */
export function Markdown({
  children,
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  if (streaming)
    return <span className="markdown-fallback">{children}</span>;
  return (
    <Suspense fallback={<span className="markdown-fallback">{children}</span>}>
      <MarkdownRenderer>{children}</MarkdownRenderer>
    </Suspense>
  );
}
