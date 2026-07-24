// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShellCommandDialog } from "../../src/components/ShellCommandDialog";

describe("confirmation de commande shell", () => {
  it("annonce l’absence de sandbox et focalise l’annulation", () => {
    const cancel = vi.fn();
    const confirm = vi.fn();
    render(
      <ShellCommandDialog
        controller={{
          pending: "rm -i example",
          executing: false,
          requestExecution: vi.fn(),
          cancel,
          confirm,
        }}
      />,
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent("sans sandbox");
    expect(screen.getByText("rm -i example")).toBeVisible();
    const neutral = screen.getByRole("button", { name: "Annuler" });
    expect(neutral).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });
});
