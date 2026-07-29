import { lazy, Suspense } from "react";

const MarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer").then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

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
  if (streaming) {
    return (
      <Suspense fallback={<span className="markdown-fallback">{children}</span>}>
        <StreamingMarkdownRenderer>{children}</StreamingMarkdownRenderer>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<span className="markdown-fallback">{children}</span>}>
      <MarkdownRenderer>{children}</MarkdownRenderer>
    </Suspense>
  );
}
