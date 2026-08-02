// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ShieldCheck } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconButton } from "../../src/components/IconButton";
import { RoundIcon } from "../../src/components/RoundIcon";

describe("primitives d’icône", () => {
  it("partage tailles et niveaux d’accent entre icônes et boutons", () => {
    const { container } = render(
      <>
        <RoundIcon icon={ShieldCheck} size="small" variant="secondary" />
        <IconButton
          aria-label="Sécurité"
          gap="large"
          icon={ShieldCheck}
          label="Sécurité"
          size="medium"
          variant="primary"
        />
        <IconButton label="Élevé" size="medium" variant="secondary" />
        <IconButton
          aria-label="Envoyer"
          enabled
          icon={ShieldCheck}
          variant="primary"
        />
      </>,
    );

    expect(container.querySelector(".round-icon")).toHaveClass(
      "round-icon-small",
      "round-icon-secondary",
    );
    expect(screen.getByRole("button", { name: "Sécurité" })).toHaveClass(
      "round-icon-medium",
      "round-icon-primary",
      "icon-button-labeled",
      "icon-button-gap-large",
    );
    expect(
      screen.getByRole("button", { name: "Sécurité" }),
    ).toHaveTextContent("Sécurité");
    expect(screen.getByRole("button", { name: "Élevé" })).toHaveClass(
      "icon-button-label-only",
      "icon-button-labeled",
      "icon-button-gap-medium",
    );
    expect(
      screen.getByRole("button", { name: "Élevé" }).querySelector("svg"),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Envoyer" })).toHaveAttribute(
      "data-enabled",
      "true",
    );
  });
});
