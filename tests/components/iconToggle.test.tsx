// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Check, X } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { IconToggle } from "../../src/components/IconToggle";

describe("IconToggle", () => {
  it("expose un switch contrôlé avec icônes et texte optionnels", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <IconToggle
        checked={false}
        checkedIcon={Check}
        label="Activer"
        onCheckedChange={onCheckedChange}
        text="Inactif"
        uncheckedIcon={X}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Activer" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveClass("icon-toggle-labeled");
    expect(toggle).toHaveTextContent("Inactif");
    expect(toggle.firstElementChild).toHaveClass("icon-toggle-text");
    expect(toggle.lastElementChild).toHaveClass("icon-toggle-track");
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    rerender(
      <IconToggle
        checked
        checkedIcon={Check}
        label="Activer"
        onCheckedChange={onCheckedChange}
      />,
    );
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(toggle).toHaveClass("icon-toggle-medium", "round-icon-secondary");
    expect(toggle).not.toHaveClass("icon-toggle-labeled");

    rerender(
      <IconToggle
        checked
        label="Activer"
        onCheckedChange={onCheckedChange}
        size="large"
        variant="tertiary"
      />,
    );
    expect(toggle).toHaveClass("icon-toggle-large", "round-icon-tertiary");
  });
});
