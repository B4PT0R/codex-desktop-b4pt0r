// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { ShieldCheck } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  RoundIcon,
  RoundIconButton,
} from "../../src/components/RoundIcon";

describe("primitive d’icône ronde", () => {
  it("partage tailles et niveaux d’accent entre icônes et boutons", () => {
    const { container } = render(
      <>
        <RoundIcon icon={ShieldCheck} size="small" variant="secondary" />
        <RoundIconButton
          aria-label="Sécurité"
          gap="large"
          icon={ShieldCheck}
          label="Sécurité"
          size="medium"
          variant="primary"
        />
        <RoundIconButton label="Élevé" size="medium" variant="secondary" />
        <RoundIconButton
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
      "round-icon-button-labeled",
      "round-icon-gap-large",
    );
    expect(
      screen.getByRole("button", { name: "Sécurité" }),
    ).toHaveTextContent("Sécurité");
    expect(screen.getByRole("button", { name: "Élevé" })).toHaveClass(
      "round-icon-button-label-only",
      "round-icon-button-labeled",
      "round-icon-gap-medium",
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
