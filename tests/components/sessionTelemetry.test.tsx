// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextGauge } from "../../src/components/ContextGauge";
import { SessionTelemetry } from "../../src/components/SessionTelemetry";

afterEach(cleanup);

describe("indicateurs de session", () => {
  it("présente discrètement un reroutage", () => {
    render(
      <SessionTelemetry
        reroute={{
          fromModel: "gpt-a",
          toModel: "gpt-b",
          reason: "highRiskCyberActivity",
        }}
      />,
    );

    expect(screen.getByText("Rerouté vers gpt-b")).toHaveAttribute(
      "title",
      expect.stringContaining("Vérification de sécurité renforcée"),
    );
  });

  it("ne réserve aucun espace sans reroutage", () => {
    const { container } = render(<SessionTelemetry />);
    expect(container).toBeEmptyDOMElement();
  });

  it("compacte depuis une jauge orange dans les métriques du footer", () => {
    const onCompact = vi.fn();
    render(
      <ContextGauge
        context={{
          usedTokens: 96_000,
          windowTokens: 128_000,
          percentUsed: 75,
          totalTokens: 150_000,
          lastOutputTokens: 2_500,
        }}
        disabled={false}
        onCompact={onCompact}
      />,
    );
    const gauge = screen.getByRole("button", {
      name: "Contexte utilisé à 75 %. Compacter maintenant",
    });
    expect(gauge).toHaveClass("warning");
    expect(gauge).toHaveTextContent("75");
    fireEvent.click(gauge);
    expect(onCompact).toHaveBeenCalledOnce();
  });
});
