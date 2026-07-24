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
import { ChatHeader } from "../../src/components/ChatHeader";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(cleanup);
beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));

describe("en-tête de conversation", () => {
  it("place le focus dans les actions et le restitue avec Échap", async () => {
    render(
      <I18nProvider>
        <ChatHeader
          busy={false}
          connected
          nativeApp
          reconnecting={false}
          sidebarOpen
          threadId="thread-1"
          title="Titre clavier"
          onCompact={vi.fn()}
          onDelete={vi.fn()}
          onFork={vi.fn()}
          onOpenSidebar={vi.fn()}
          onReconnect={vi.fn()}
          onRename={vi.fn()}
        />
      </I18nProvider>,
    );
    const opener = screen.getByRole("button", { name: "Titre clavier" });
    fireEvent.click(opener);
    const input = screen.getByLabelText("Nom de la conversation");
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Créer une branche/ }),
      { key: "Escape" },
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("affiche le titre courant sans annoncer une action inexistante", () => {
    render(
      <I18nProvider>
        <ChatHeader
          busy={false}
          connected
          nativeApp
          reconnecting={false}
          sidebarOpen
          title="Réparer le chargement"
          onCompact={vi.fn()}
          onDelete={vi.fn()}
          onFork={vi.fn()}
          onOpenSidebar={vi.fn()}
          onReconnect={vi.fn()}
          onRename={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Réparer le chargement")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Réparer/ })).toBeNull();
  });

  it("renomme et compacte depuis les actions du titre", async () => {
    const onRename = vi.fn().mockResolvedValue(true);
    const onCompact = vi.fn().mockResolvedValue(true);
    const onFork = vi.fn().mockResolvedValue(true);
    const onDelete = vi.fn().mockResolvedValue(true);
    render(
      <I18nProvider>
        <ChatHeader
          busy={false}
          connected
          nativeApp
          reconnecting={false}
          sidebarOpen
          threadId="thread-1"
          title="Ancien titre"
          onCompact={onCompact}
          onDelete={onDelete}
          onFork={onFork}
          onOpenSidebar={vi.fn()}
          onReconnect={vi.fn()}
          onRename={onRename}
        />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ancien titre" }));
    fireEvent.change(screen.getByLabelText("Nom de la conversation"), {
      target: { value: "Nouveau titre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    expect(onRename).toHaveBeenCalledWith("Nouveau titre");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Actions de la conversation" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Ancien titre" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Compacter le contexte/ }),
    );
    expect(onCompact).toHaveBeenCalledOnce();

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Actions de la conversation" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ancien titre" }));
    fireEvent.click(screen.getByRole("button", { name: /Créer une branche/ }));
    expect(onFork).toHaveBeenCalledOnce();

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Actions de la conversation" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ancien titre" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Supprimer la conversation/ }),
    );
    const confirmation = screen.getByRole("alertdialog", {
      name: "Supprimer définitivement la conversation ?",
    });
    expect(confirmation).toHaveTextContent("Ancien titre");
    expect(confirmation).toHaveTextContent(/branches/);
    expect(screen.getByRole("button", { name: "Annuler" })).toHaveFocus();
    fireEvent.click(
      screen.getByRole("button", { name: "Supprimer définitivement" }),
    );
    expect(onDelete).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });
});
