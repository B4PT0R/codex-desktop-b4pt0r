import katex from "katex";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { normalizeLatexDelimiters } from "../lib/normalizeLatexDelimiters";
import { splitStableStreamingLatex } from "../lib/streamingLatex";
import { classifyMarkdownLink } from "../lib/linkRouting";
import { openMarkdownLink } from "../lib/markdownLinks";
import { useMarkdownLinkRouting } from "./MarkdownLinkContext";

export function MarkdownRenderer({ children }: { children: string }) {
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
      }}
    >
      {normalizeLatexDelimiters(children)}
    </ReactMarkdown>
  );
}

export function StreamingLatexRenderer({ children }: { children: string }) {
  return (
    <span className="streaming-latex">
      {splitStableStreamingLatex(children).map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <StableStreamingMath
            display={segment.display}
            key={index}
            value={segment.value}
          />
        ),
      )}
    </span>
  );
}

const StableStreamingMath = memo(function StableStreamingMath({
  display,
  value,
}: {
  display: boolean;
  value: string;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(value, {
        displayMode: display,
        errorColor: "#c77777",
        strict: false,
        throwOnError: false,
        trust: false,
      }),
    [display, value],
  );
  return (
    <span
      className={display ? "streaming-math-display" : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
