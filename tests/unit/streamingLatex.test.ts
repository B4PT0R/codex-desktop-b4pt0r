import { describe, expect, it } from "vitest";
import { splitStableStreamingLatex } from "../../src/lib/streamingLatex";

describe("LaTeX pendant le streaming", () => {
  it("extrait les formules fermées et conserve la fin incomplète littérale", () => {
    expect(
      splitStableStreamingLatex(
        "Énergie $E=mc^2$, puis \\(a+b\\). Enfin $$\\frac{a",
      ),
    ).toEqual([
      { kind: "text", value: "Énergie " },
      { kind: "math", display: false, value: "E=mc^2" },
      { kind: "text", value: ", puis " },
      { kind: "math", display: false, value: "a+b" },
      { kind: "text", value: ". Enfin $$\\frac{a" },
    ]);
  });

  it("gère les blocs complets sans interpréter les exemples de code", () => {
    expect(
      splitStableStreamingLatex(
        "`$brut$`\n\\[A=\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}\\]",
      ),
    ).toEqual([
      { kind: "text", value: "`$brut$`\n" },
      {
        kind: "math",
        display: true,
        value: "A=\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}",
      },
    ]);
  });

  it("laisse les dollars échappés et les doubles dollars séparés", () => {
    expect(splitStableStreamingLatex("\\$5 puis $$x^2$$")).toEqual([
      { kind: "text", value: "\\$5 puis " },
      { kind: "math", display: true, value: "x^2" },
    ]);
  });
});
