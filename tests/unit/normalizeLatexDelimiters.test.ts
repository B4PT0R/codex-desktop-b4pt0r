import { describe, expect, it } from "vitest";
import { normalizeLatexDelimiters } from "../../src/lib/normalizeLatexDelimiters";

describe("normalisation des délimiteurs LaTeX", () => {
  it("accepte les syntaxes parenthèses et crochets des modèles", () => {
    expect(
      normalizeLatexDelimiters(
        "Inline \\(x^2\\).\n\n\\[\nE = mc^2\n\\]",
      ),
    ).toBe("Inline $x^2$.\n\n$$\nE = mc^2\n$$");
    expect(normalizeLatexDelimiters("\\[a+b\\]")).toBe("$$\na+b\n$$");
    expect(normalizeLatexDelimiters("$$a+b$$")).toBe("$$\na+b\n$$");
  });

  it("préserve les délimiteurs montrés dans du code", () => {
    expect(
      normalizeLatexDelimiters(
        "Utiliser `\\(x\\)` ici.\n\n```tex\n\\[x\\]\n```\n\n    \\(y\\)",
      ),
    ).toBe(
      "Utiliser `\\(x\\)` ici.\n\n```tex\n\\[x\\]\n```\n\n    \\(y\\)",
    );
  });
});
