// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";
import { Markdown } from "../../src/components/Markdown";
import { ToolGroup } from "../../src/components/ToolGroup";
import { SignalCards } from "../../src/components/SignalCards";
afterEach(cleanup);
describe("rendu du chat", () => {
  it("rend le Markdown GFM", async () => {
    render(
      <Markdown>{"## Résultat\n\n- [x] terminé\n\n`cargo test`"}</Markdown>,
    );
    expect(
      await screen.findByRole("heading", { name: "Résultat" }),
    ).toBeVisible();
    expect(screen.getByText("cargo test")).toBeVisible();
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
});
