// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkPanel } from "../../src/components/WorkPanel";

afterEach(cleanup);

describe("panneau de travail", () => {
  it("prend puis restitue le focus à son ouverture et sa fermeture", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <WorkPanel
        tool={{
          id: "diff-1",
          kind: "fileChange",
          title: "Fichiers",
          status: "done",
          diff: "+ligne",
        }}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Fermer les détails du travail" }),
      ).toHaveFocus(),
    );
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("présente un diff sélectionné et peut être fermé", () => {
    const onClose = vi.fn();
    render(
      <WorkPanel
        tool={{
          id: "diff-1",
          kind: "fileChange",
          title: "Modification de fichiers",
          detail: "src/App.tsx",
          status: "done",
          diff: "+import WorkPanel",
        }}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("+import WorkPanel")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer les détails du travail" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("se ferme avec Échap", () => {
    const onClose = vi.fn();
    render(
      <WorkPanel
        tool={{
          id: "diff-1",
          kind: "fileChange",
          title: "Fichiers",
          detail: "src/App.tsx",
          status: "done",
          diff: "+ligne",
        }}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
