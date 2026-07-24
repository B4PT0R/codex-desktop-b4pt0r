import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { normalizeLatexDelimiters } from "../lib/normalizeLatexDelimiters";

export function MarkdownRenderer({ children }: { children: string }) {
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
        a: ({ children: content, node: _, ...props }) => (
          <a {...props} target="_blank" rel="noreferrer">
            {content}
          </a>
        ),
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
