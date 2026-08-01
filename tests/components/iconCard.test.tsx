// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Server } from "lucide-react";
import { IconCard } from "../../src/components/IconCard";
import { CardStack } from "../../src/components/CardStack";

afterEach(cleanup);

describe("carte à icône commune", () => {
  it("compose icône, titre, sous-titre, détail et widget de fin", () => {
    const action = vi.fn();
    const { container } = render(
      <IconCard
        icon={<Server data-testid="icon" />}
        subtitle="2 outils"
        title="GitHub"
        trailing={<button onClick={action}>Activer</button>}
      >
        <code>github</code>
      </IconCard>,
    );

    expect(container.querySelector(".icon-card")).not.toBeNull();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toHaveClass("icon-card-title");
    expect(screen.getByText("2 outils")).toHaveClass("icon-card-subtitle");
    expect(screen.getByText("github")).toBeInTheDocument();
    screen.getByRole("button", { name: "Activer" }).click();
    expect(action).toHaveBeenCalledOnce();
  });

  it("rend le contenu principal actionnable sans imposer d'icône", () => {
    const open = vi.fn();
    render(
      <IconCard
        contentButtonProps={{
          "aria-expanded": false,
          "aria-haspopup": "dialog",
          "aria-label": "Modifier la tâche",
        }}
        title="Tâche"
        onContentClick={open}
      />,
    );
    const button = screen.getByRole("button", { name: "Modifier la tâche" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    button.click();
    expect(open).toHaveBeenCalledOnce();
  });

  it("joint plusieurs cartes et accepte une barre de contrôle", () => {
    const { container } = render(
      <CardStack controlBar={<div className="settings-controls-bar">État</div>}>
        <IconCard title="Modèle" />
        <IconCard title="Effort" />
      </CardStack>,
    );
    expect(container.querySelectorAll(".card-stack > .icon-card")).toHaveLength(2);
    expect(container.querySelector(".card-stack > .settings-controls-bar"))
      .toHaveTextContent("État");
  });
});
