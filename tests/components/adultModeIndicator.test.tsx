// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdultModeIndicator } from "../../src/components/AdultModeIndicator";

afterEach(cleanup);

describe("indicateur du Mode Adulte", () => {
  it("signale uniquement un mode actif", () => {
    const { rerender } = render(<AdultModeIndicator enabled={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<AdultModeIndicator enabled />);
    expect(screen.getByRole("status", { name: "Mode Adulte actif" })).toHaveAttribute(
      "title",
      "Mode Adulte actif pour les conversations nouvelles ou rouvertes",
    );
  });
});
