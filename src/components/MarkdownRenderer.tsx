import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const remarkPlugins = [remarkGfm];

export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
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
      {children}
    </ReactMarkdown>
  );
}
