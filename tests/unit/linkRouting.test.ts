import { describe, expect, it } from "vitest";
import { classifyMarkdownLink } from "../../src/lib/linkRouting";

describe("classification des liens Markdown", () => {
  it("distingue le web, les ancres et les protocoles refusés", () => {
    expect(classifyMarkdownLink("https://example.com/docs")).toEqual({
      kind: "web",
      url: "https://example.com/docs",
    });
    expect(classifyMarkdownLink("#résultat")).toEqual({ kind: "anchor" });
    expect(classifyMarkdownLink("javascript:alert(1)")).toEqual({
      kind: "unsupported",
    });
  });

  it("extrait les positions des références de fichiers", () => {
    expect(classifyMarkdownLink("src/App.tsx:42:7")).toEqual({
      kind: "file",
      path: "src/App.tsx",
      line: 42,
      column: 7,
    });
    expect(classifyMarkdownLink("file:///tmp/example.rs#L8-L12")).toEqual({
      kind: "file",
      path: "/tmp/example.rs",
      line: 8,
    });
  });
});
