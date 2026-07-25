import { lazy, Suspense } from "react";

const MarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer").then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

const StreamingLatexRenderer = lazy(() =>
  import("./MarkdownRenderer").then((module) => ({
    default: module.StreamingLatexRenderer,
  })),
);

/** Keeps streaming Markdown cheap while progressively rendering stable math. */
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
        <StreamingLatexRenderer>{children}</StreamingLatexRenderer>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<span className="markdown-fallback">{children}</span>}>
      <MarkdownRenderer>{children}</MarkdownRenderer>
    </Suspense>
  );
}
