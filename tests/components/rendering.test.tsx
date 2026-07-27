// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { afterEach } from "vitest";
import { Markdown } from "../../src/components/Markdown";
import { ToolGroup } from "../../src/components/ToolGroup";
import { SignalCards } from "../../src/components/SignalCards";
import { MarkdownLinkProvider } from "../../src/components/MarkdownLinkContext";
afterEach(cleanup);
describe("rendu du chat", () => {
  it("rend le Markdown GFM", async () => {
    render(
      <Markdown>{"## Résultat\n\n- [x] terminé\n\n`cargo test`"}</Markdown>,
    );
    expect(
      await screen.findByRole(
        "heading",
        { name: "Résultat" },
        { timeout: 5_000 },
      ),
    ).toBeVisible();
    expect(screen.getByText("cargo test")).toBeVisible();
  });
  it("réserve la justification aux paragraphes assez longs", async () => {
    const longParagraph = "Texte suffisamment développé pour la lecture. ".repeat(
      6,
    );
    const { rerender } = render(<Markdown>{"Texte court."}</Markdown>);
    expect(await screen.findByText("Texte court.")).not.toHaveClass("justified");

    rerender(<Markdown>{longParagraph}</Markdown>);
    expect(await screen.findByText(longParagraph.trim())).toHaveClass(
      "justified",
    );
  });
  it("route explicitement les liens web au lieu de demander une nouvelle fenêtre Electron", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <MarkdownLinkProvider
        value={{ fileOpener: "none", onError: vi.fn() }}
      >
        <Markdown>{"[Documentation](https://example.com/docs)"}</Markdown>
      </MarkdownLinkProvider>,
    );

    fireEvent.click(
      await screen.findByRole("link", { name: "Documentation" }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://example.com/docs",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });
  it("diffère l’analyse Markdown pendant le streaming", async () => {
    const { rerender } = render(
      <Markdown streaming>{"## Résultat partiel"}</Markdown>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("## Résultat partiel")).toBeVisible();

    rerender(<Markdown>{"## Résultat final"}</Markdown>);
    expect(
      await screen.findByRole("heading", { name: "Résultat final" }),
    ).toBeVisible();
  });
  it("rend les formules fermées pendant le stream sans interpréter la fin incomplète", async () => {
    const { container, rerender } = render(
      <Markdown streaming>
        {"Énergie $E=mc^2$, puis bloc incomplet $$\\frac{a"}
      </Markdown>,
    );

    await screen.findByText("Énergie", { exact: false });
    expect(container.querySelectorAll(".katex")).toHaveLength(1);
    expect(container.textContent).toContain("$$\\frac{a");

    rerender(
      <Markdown streaming>
        {"Énergie $E=mc^2$, puis bloc complet $$\\frac{a}{b}$$"}
      </Markdown>,
    );
    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelector(".streaming-math-display")).toBeVisible();
  });
  it("rend les syntaxes LaTeX inline et bloc avec KaTeX", async () => {
    const { container } = render(
      <Markdown>
        {
          "Dollar $E=mc^2$ et parenthèses \\(a^2+b^2=c^2\\).\n\n$$\\sum_{n=1}^{\\infty} n^{-2}$$\n\n\\[\\int_0^1 x\\,dx\\]"
        }
      </Markdown>,
    );

    await screen.findByText("Dollar", { exact: false });
    expect(container.querySelectorAll(".katex")).toHaveLength(4);
    expect(container.querySelectorAll(".katex-display")).toHaveLength(2);
  });
  it("affiche une formule LaTeX invalide sans faire tomber le message", async () => {
    const { container } = render(
      <Markdown>{"Avant $\\frac{$ après"}</Markdown>,
    );
    expect(await screen.findByText("Avant", { exact: false })).toBeVisible();
    expect(container.querySelector(".katex-error")).toBeVisible();
  });
  it("rend les environnements alignés, matrices et définitions par morceaux", async () => {
    const { container } = render(
      <Markdown>
        {
          "\\[\n\\begin{aligned}a &= b + c \\\\ d &= e\\end{aligned}\n\\]\n\n\\[\nA=\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}\n\\]\n\n\\[\nf(x)=\\begin{cases}x^2,&x\\ge0\\\\-x,&x<0\\end{cases}\n\\]"
        }
      </Markdown>,
    );

    await screen.findAllByText("a", { exact: true });
    expect(container.querySelectorAll(".katex-display")).toHaveLength(3);
    expect(container.querySelector(".katex-error")).toBeNull();
    expect(container.textContent).toContain("f(x)");
  });
  it("regroupe les outils", () => {
    render(
      <ToolGroup
        tools={[
          {
            id: "1",
            kind: "commandExecution",
            title: "Commande",
            detail: "cargo test",
            status: "done",
          },
        ]}
      />,
    );
    const summary = screen.getByText("1 action effectuée");
    expect(summary).toBeVisible();
    fireEvent.click(summary);
    expect(screen.getByText("cargo test")).toBeVisible();
  });
  it("affiche un plan structuré hors des outils", () => {
    render(
      <SignalCards
        signals={[
          {
            id: "p",
            kind: "plan",
            title: "Plan",
            status: "running",
            steps: [
              { step: "Analyser", status: "completed" },
              { step: "Implémenter", status: "inProgress" },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.getByText("Implémenter")).toBeVisible();
    expect(screen.queryByText(/action effectuée/)).not.toBeInTheDocument();
  });
  it("masque un raisonnement vide mais affiche son résumé disponible", () => {
    const { rerender } = render(
      <SignalCards
        signals={[
          {
            id: "reasoning",
            kind: "reasoning",
            title: "Réflexion",
            detail: "",
            status: "running",
          },
        ]}
      />,
    );
    expect(screen.queryByText("Réflexion")).toBeNull();

    rerender(
      <SignalCards
        signals={[
          {
            id: "reasoning",
            kind: "reasoning",
            title: "Réflexion",
            detail: "Analyse du problème",
            status: "running",
          },
        ]}
      />,
    );
    expect(screen.getByText("Réflexion")).toBeVisible();
    expect(screen.getByText("Analyse du problème")).toBeInTheDocument();
  });
  it("n’affiche pas une coche de succès pour un avertissement terminal", () => {
    render(
      <SignalCards
        signals={[
          {
            id: "warning",
            kind: "warning",
            title: "Le tour s’est interrompu",
            status: "error",
          },
        ]}
      />,
    );
    expect(screen.getByLabelText("Erreur")).toBeVisible();
    expect(screen.queryByLabelText("Terminé")).toBeNull();
  });
  it("masque l’item pendant la compaction puis affiche une fin discrète", () => {
    const { rerender } = render(
      <SignalCards
        signals={[
          {
            id: "compact",
            kind: "compaction",
            title: "Compaction du contexte",
            status: "running",
          },
        ]}
      />,
    );
    expect(screen.queryByText("Compaction du contexte")).toBeNull();
    expect(screen.queryByLabelText("En cours")).toBeNull();

    rerender(
      <SignalCards
        signals={[
          {
            id: "compact",
            kind: "compaction",
            title: "Contexte compacté",
            status: "done",
          },
        ]}
      />,
    );
    const note = screen.getByText("Contexte compacté").closest(".signal-note");
    expect(note).toBeVisible();
    expect(note).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Terminé")).toBeVisible();
  });
});
