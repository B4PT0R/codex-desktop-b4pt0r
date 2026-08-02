// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { FlaskConical } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Badge } from "../../src/components/Badge";

describe("Badge", () => {
  it("compose une étiquette non interactive avec taille, variante et icône", () => {
    const { container } = render(
      <Badge
        icon={FlaskConical}
        label="Preview"
        size="medium"
        tone="experimental"
        variant="tertiary"
      />,
    );

    const badge = screen.getByText("Preview").closest(".badge");
    expect(badge).toHaveClass(
      "badge-medium",
      "badge-tertiary",
      "badge-experimental",
    );
    expect(badge?.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});
