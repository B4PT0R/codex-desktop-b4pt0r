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

  it("présente un patch partiel sélectionné et peut être fermé", async () => {
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
    expect(
      await screen.findByRole("table", { name: "Patch partiel" }),
    ).toHaveTextContent("+import WorkPanel");
    expect(screen.getByText("Patch partiel")).toBeVisible();
    expect(screen.getByText("Afficher le patch brut")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer les détails du travail" }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("structure un unified diff par fichier avec ses statistiques", async () => {
    const { container } = render(
      <WorkPanel
        tool={{
          id: "diff-structured",
          kind: "fileChange",
          title: "Modification de fichiers",
          detail: "src/App.tsx",
          status: "done",
          diff: [
            "diff --git a/src/App.tsx b/src/App.tsx",
            "--- a/src/App.tsx",
            "+++ b/src/App.tsx",
            "@@ -1,2 +1,2 @@",
            "-const oldValue = true;",
            "+const newValue = true;",
            " export default App;",
          ].join("\n"),
        }}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector(".diff-table")).toBeInTheDocument(),
    );
    expect(screen.getByText("Modifié")).toBeVisible();
    expect(
      screen.getByLabelText("Ajouts : 1, suppressions : 1"),
    ).toBeVisible();
    expect(screen.queryByText("Patch partiel")).toBeNull();
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
