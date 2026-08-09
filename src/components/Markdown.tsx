import { lazy, Suspense } from "react";

const StreamingMarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer").then((module) => ({
    default: module.StreamingMarkdownRenderer,
  })),
);

/** Coalesces streaming deltas while progressively rendering full Markdown. */
export function Markdown({
  children,
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  return (
    <Suspense fallback={<span className="markdown-fallback">{children}</span>}>
      <StreamingMarkdownRenderer streaming={streaming}>
        {children}
      </StreamingMarkdownRenderer>
    </Suspense>
  );
}
