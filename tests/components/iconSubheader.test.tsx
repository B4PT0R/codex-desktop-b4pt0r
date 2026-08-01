// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Brain } from "lucide-react";
import { IconSubheader } from "../../src/components/IconSubheader";

afterEach(cleanup);

describe("sous-en-tête à icône commun", () => {
  it("compose une icône optionnelle, un titre et un sous-titre", () => {
    const { container } = render(
      <IconSubheader
        icon={<Brain data-testid="icon" />}
        title="Mémoire locale"
        subtitle="Conservée entre les conversations"
      />,
    );

    expect(container.querySelector(".icon-subheader.has-icon")).not.toBeNull();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Mémoire locale")).toBeVisible();
    expect(screen.getByText("Conservée entre les conversations")).toBeVisible();
  });

  it("n'ajoute aucune colonne d'icône lorsqu'elle est absente", () => {
    const { container } = render(<IconSubheader title="Interface" />);
    expect(container.querySelector(".icon-subheader")).not.toHaveClass("has-icon");
    expect(container.querySelector(".icon-subheader-icon")).toBeNull();
  });
});
