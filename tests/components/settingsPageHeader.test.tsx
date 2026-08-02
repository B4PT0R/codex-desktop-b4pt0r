// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsPageHeader } from "../../src/components/SettingsPageHeader";
import {
  SettingsControlsBar,
  SettingsControlsBarButton,
} from "../../src/components/SettingsControlsBar";
import { CardStack } from "../../src/components/CardStack";

afterEach(cleanup);

describe("en-tête commun des réglages", () => {
  it("compose description et portée dans une structure stable", () => {
    const { container } = render(
      <SettingsPageHeader
        badge="Configuration globale"
        description="Préférences des nouvelles conversations."
      />,
    );

    expect(container.querySelector(".settings-page-header")).not.toBeNull();
    expect(screen.getByText("Configuration globale").closest(".badge")).toHaveClass(
      "badge-small",
      "badge-secondary",
      "badge-neutral",
    );
    expect(container.querySelector(".settings-page-header button")).toBeNull();
  });

  it("réutilise le même badge dans les sous-sections globales", () => {
    render(
      <SettingsPageHeader
        badge="Expérimental"
        badgeTone="experimental"
        description="Fonction en préversion."
      />,
    );
    expect(screen.getByText("Expérimental").closest(".badge")).toHaveClass(
      "badge-experimental",
    );
  });

  it("attache les contrôles opérationnels au contenu qu'ils pilotent", () => {
    const { container } = render(
      <>
        <SettingsPageHeader description="Serveurs MCP disponibles." />
        <CardStack
          controlBar={<SettingsControlsBar
            actions={
            <SettingsControlsBarButton>Actualiser</SettingsControlsBarButton>
            }
            status="2 disponibles"
          />}
        >
          <div>Serveurs</div>
        </CardStack>
      </>,
    );

    expect(
      container.querySelector(".settings-page-header button"),
    ).toBeNull();
    expect(
      container.querySelector(".settings-controls-bar button"),
    ).toHaveTextContent("Actualiser");
    expect(screen.getByText("2 disponibles")).toBeInTheDocument();
    expect(
      container.querySelector(".card-stack > div:last-child"),
    ).toHaveTextContent("Serveurs");
  });
});
