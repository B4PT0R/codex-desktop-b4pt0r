import {
  type ComponentPropsWithoutRef,
  isValidElement,
  memo,
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
} from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { normalizeLatexDelimiters } from "../lib/normalizeLatexDelimiters";
import { classifyMarkdownLink } from "../lib/linkRouting";
import { openMarkdownLink } from "../lib/markdownLinks";
import { useMarkdownLinkRouting } from "./MarkdownLinkContext";

export const STREAMING_MARKDOWN_INTERVAL_MS = 32;

export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
}: {
  children: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[
        remarkGfm,
        [remarkMath, { singleDollarTextMath: true }],
      ]}
      rehypePlugins={[
        [
          rehypeKatex,
          {
            strict: false,
            trust: false,
            errorColor: "#c77777",
          },
        ],
      ]}
      components={MARKDOWN_COMPONENTS}
    >
      {normalizeLatexDelimiters(children)}
    </ReactMarkdown>
  );
});

const MARKDOWN_COMPONENTS: Components = {
  a: MarkdownAnchor,
  code: MarkdownCode,
  img: MarkdownImage,
  p: MarkdownParagraph,
  table: MarkdownTable,
};

function MarkdownAnchor({
  children,
  href,
  node: _,
  ...props
}: ComponentPropsWithoutRef<"a"> & ExtraProps) {
  const routing = useMarkdownLinkRouting();
  const target = classifyMarkdownLink(href ?? "");
  return (
    <a
      {...props}
      href={href}
      rel={target.kind === "web" ? "noreferrer" : undefined}
      onClick={(event) => {
        if (target.kind === "anchor") return;
        event.preventDefault();
        void openMarkdownLink(href ?? "", routing).catch(routing.onError);
      }}
    >
      {children}
    </a>
  );
}

function MarkdownCode({
  children,
  className,
  node: _,
  ...props
}: ComponentPropsWithoutRef<"code"> & ExtraProps) {
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

function MarkdownImage({
  alt,
  loading,
  node: _,
  ...props
}: ComponentPropsWithoutRef<"img"> & ExtraProps) {
  return (
    <img
      {...props}
      alt={alt ?? ""}
      decoding="async"
      loading={loading ?? "lazy"}
      referrerPolicy="no-referrer"
    />
  );
}

function MarkdownParagraph({
  children,
  node: _,
  ...props
}: ComponentPropsWithoutRef<"p"> & ExtraProps) {
  const justify = markdownTextLength(children) >= 180;
  return (
    <p
      className={`markdown-paragraph${justify ? " justified" : ""}`}
      {...props}
    >
      {children}
    </p>
  );
}

function MarkdownTable({
  children,
  node: _,
  ...props
}: ComponentPropsWithoutRef<"table"> & ExtraProps) {
  return (
    <div className="markdown-table-shell">
      <table {...props}>{children}</table>
    </div>
  );
}

function markdownTextLength(node: ReactNode): number {
  if (typeof node === "string" || typeof node === "number") {
    return String(node).length;
  }
  if (Array.isArray(node)) {
    return node.reduce(
      (length: number, child: ReactNode) =>
        length + markdownTextLength(child),
      0,
    );
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return markdownTextLength(node.props.children);
  }
  return 0;
}

export const StreamingMarkdownRenderer = memo(
  function StreamingMarkdownRenderer({ children }: { children: string }) {
    const source = useThrottledMarkdown(children);
    return <MarkdownRenderer>{source}</MarkdownRenderer>;
  },
);

/**
 * Keeps rapid token deltas from reparsing the complete Markdown tree more than
 * once per visual frame budget. The latest source is never dropped, and the
 * non-streaming renderer receives the final value immediately on completion.
 */
function useThrottledMarkdown(source: string) {
  const [rendered, setRendered] = useState(source);
  const latest = useRef(source);
  const lastRenderAt = useRef(Date.now());
  const cancelPending = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (latest.current === source) return;
    latest.current = source;
    const elapsed = Date.now() - lastRenderAt.current;

    const commit = () => {
      cancelPending.current = undefined;
      lastRenderAt.current = Date.now();
      startTransition(() => {
        setRendered((current) =>
          current === latest.current ? current : latest.current,
        );
      });
    };

    if (elapsed >= STREAMING_MARKDOWN_INTERVAL_MS) {
      cancelPending.current?.();
      cancelPending.current = scheduleMarkdownCommit(commit, 0);
      return;
    }
    cancelPending.current ??= scheduleMarkdownCommit(
      commit,
      STREAMING_MARKDOWN_INTERVAL_MS - elapsed,
    );
  }, [source]);

  useEffect(
    () => () => {
      cancelPending.current?.();
    },
    [],
  );

  return rendered;
}

type BrowserTaskScheduler = {
  postTask: (
    callback: () => void,
    options: {
      delay: number;
      priority: "user-visible";
      signal: AbortSignal;
    },
  ) => Promise<unknown>;
};

/**
 * Chromium's scheduler lets keyboard and pointer input run ahead of Markdown
 * parsing. Tests and browsers without the API retain the same timer semantics.
 */
function scheduleMarkdownCommit(callback: () => void, delay: number) {
  const scheduler = (
    window as typeof window & { scheduler?: BrowserTaskScheduler }
  ).scheduler;
  if (scheduler?.postTask) {
    const controller = new AbortController();
    let fallbackTimer: number | undefined;
    void scheduler
      .postTask(callback, {
        delay,
        priority: "user-visible",
        signal: controller.signal,
      })
      .catch((error: unknown) => {
        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        if (!aborted && !controller.signal.aborted) {
          fallbackTimer = window.setTimeout(callback, 0);
        }
      });
    return () => {
      controller.abort();
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    };
  }

  const timer = window.setTimeout(callback, delay);
  return () => window.clearTimeout(timer);
}
