// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAgentsButton } from "../../src/components/WorkspaceAgentsButton";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import { invoke } from "../../src/lib/nativeBridge";

vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  localStorage.setItem("codex-desktop.locale", "fr");
  vi.mocked(invoke).mockReset();
});

describe("éditeur AGENTS.md du workspace", () => {
  it("lit, modifie et enregistre uniquement le document du workspace", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({
        content: "# Anciennes règles\n",
        exists: true,
        filePath: "/work/project/AGENTS.md",
        version: "before",
      })
      .mockResolvedValueOnce({
        content: "# Nouvelles règles\n",
        exists: true,
        filePath: "/work/project/AGENTS.md",
        version: "after",
      });
    render(
      <I18nProvider>
        <WorkspaceAgentsButton cwd="/work/project" nativeApp />
      </I18nProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Modifier le AGENTS.md du projet",
      }),
    );
    const editor = await screen.findByRole("textbox", {
      name: "Contenu de AGENTS.md",
    });
    expect(editor).toHaveValue("# Anciennes règles\n");
    fireEvent.change(editor, { target: { value: "# Nouvelles règles\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(invoke).toHaveBeenLastCalledWith("write_workspace_agents", {
        content: "# Nouvelles règles\n",
        expectedVersion: "before",
        workspace: "/work/project",
      }),
    );
    expect(await screen.findByText("AGENTS.md enregistré")).toBeVisible();
  });

  it("protège les modifications non enregistrées à la fermeture", async () => {
    vi.mocked(invoke).mockResolvedValue({
      content: "",
      exists: false,
      filePath: "/work/project/AGENTS.md",
      version: "empty",
    });
    render(
      <I18nProvider>
        <WorkspaceAgentsButton cwd="/work/project" nativeApp />
      </I18nProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Modifier le AGENTS.md du projet",
      }),
    );
    const editor = await screen.findByRole("textbox");
    fireEvent.change(editor, { target: { value: "# Règles\n" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer l’éditeur AGENTS.md" }),
    );

    expect(
      screen.getByText("Abandonner les modifications non enregistrées ?"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Fermer l’éditeur AGENTS.md" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Abandonner" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("borne le focus clavier et le rend au bouton après Escape", async () => {
    vi.mocked(invoke).mockResolvedValue({
      content: "# Règles\n",
      exists: true,
      filePath: "/work/project/AGENTS.md",
      version: "current",
    });
    render(
      <I18nProvider>
        <WorkspaceAgentsButton cwd="/work/project" nativeApp />
      </I18nProvider>,
    );

    const opener = screen.getByRole("button", {
      name: "Modifier le AGENTS.md du projet",
    });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    const editor = await screen.findByRole("textbox", {
      name: "Contenu de AGENTS.md",
    });
    await waitFor(() => expect(editor).toHaveFocus());
    const close = screen.getByRole("button", {
      name: "Fermer l’éditeur AGENTS.md",
    });
    const reload = screen.getByRole("button", { name: "Recharger" });

    reload.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(reload).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("reste absent tant qu’aucun workspace n’est sélectionné", () => {
    render(
      <I18nProvider>
        <WorkspaceAgentsButton cwd="" nativeApp />
      </I18nProvider>,
    );
    expect(
      screen.queryByRole("button", {
        name: "Modifier le AGENTS.md du projet",
      }),
    ).toBeNull();
  });
});
