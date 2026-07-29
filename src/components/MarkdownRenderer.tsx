import {
  isValidElement,
  memo,
  startTransition,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { normalizeLatexDelimiters } from "../lib/normalizeLatexDelimiters";
import { classifyMarkdownLink } from "../lib/linkRouting";
import { openMarkdownLink } from "../lib/markdownLinks";
import { useMarkdownLinkRouting } from "./MarkdownLinkContext";

const STREAMING_RENDER_INTERVAL_MS = 50;

export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
}: {
  children: string;
}) {
  const routing = useMarkdownLinkRouting();
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
      components={{
        a: ({ children: content, href, node: _, ...props }) => {
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
              {content}
            </a>
          );
        },
        code: ({ children: content, className, node: _, ...props }) => (
          <code className={className} {...props}>
            {content}
          </code>
        ),
        p: ({ children: content, node: _, ...props }) => {
          const justify = markdownTextLength(content) >= 180;
          return (
            <p
              className={`markdown-paragraph${justify ? " justified" : ""}`}
              {...props}
            >
              {content}
            </p>
          );
        },
      }}
    >
      {normalizeLatexDelimiters(children)}
    </ReactMarkdown>
  );
});

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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (latest.current === source) return;
    latest.current = source;
    const elapsed = Date.now() - lastRenderAt.current;

    const commit = () => {
      timer.current = undefined;
      lastRenderAt.current = Date.now();
      startTransition(() => {
        setRendered((current) =>
          current === latest.current ? current : latest.current,
        );
      });
    };

    if (elapsed >= STREAMING_RENDER_INTERVAL_MS) {
      if (timer.current) clearTimeout(timer.current);
      commit();
      return;
    }
    if (!timer.current) {
      timer.current = setTimeout(
        commit,
        STREAMING_RENDER_INTERVAL_MS - elapsed,
      );
    }
  }, [source]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return rendered;
}
