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
  it("pilote la lecture et l’arrêt de la démo visuelle", () => {
    const onPlay = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(
      <I18nProvider>
        <ChatHeader
          busy={false}
          connected={false}
          demoPlayback={{
            hasPlayed: false,
            running: false,
            onPlay,
            onStop,
          }}
          nativeApp={false}
          reconnecting={false}
          sidebarOpen
          title="Démo"
          onCompact={vi.fn()}
          onDelete={vi.fn()}
          onFork={vi.fn()}
          onOpenSidebar={vi.fn()}
          onReconnect={vi.fn()}
          onRename={vi.fn()}
        />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lire la démo" }));
    expect(onPlay).toHaveBeenCalledOnce();

    rerender(
      <I18nProvider>
        <ChatHeader
          busy={false}
          connected={false}
          demoPlayback={{
            hasPlayed: true,
            running: true,
            onPlay,
            onStop,
          }}
          nativeApp={false}
          reconnecting={false}
          sidebarOpen
          title="Démo"
          onCompact={vi.fn()}
          onDelete={vi.fn()}
          onFork={vi.fn()}
          onOpenSidebar={vi.fn()}
          onReconnect={vi.fn()}
          onRename={vi.fn()}
        />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Arrêter" }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("laisse le champ de nom inactif et restitue le focus avec Échap", () => {
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
    opener.focus();
    fireEvent.click(opener);
    expect(
      screen.queryByRole("textbox", { name: "Nom de la conversation" }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Modifier le nom" }));
    expect(screen.getByLabelText("Nom de la conversation")).toHaveFocus();
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
    expect(
      screen.queryByRole("textbox", { name: "Nom de la conversation" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Modifier le nom" }));
    fireEvent.change(screen.getByLabelText("Nom de la conversation"), {
      target: { value: "Nouveau titre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le nom" }));
    expect(onRename).toHaveBeenCalledWith("Nouveau titre");
    await waitFor(() =>
      expect(
        screen.queryByRole("textbox", { name: "Nom de la conversation" }),
      ).not.toBeInTheDocument(),
    );

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

  it("range l’objectif et AGENTS.md dans le menu du titre", async () => {
    render(
      <I18nProvider>
        <ChatHeader
          busy={false}
          connected
          cwd="/work/project"
          nativeApp
          reconnecting={false}
          sidebarOpen
          threadId="thread-1"
          title="Travail courant"
          onCompact={vi.fn()}
          onDelete={vi.fn()}
          onFork={vi.fn()}
          onOpenSidebar={vi.fn()}
          onReconnect={vi.fn()}
          onRename={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Définir un objectif autonome" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Modifier le AGENTS.md du projet",
      }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Travail courant" }));
    expect(
      screen.queryByRole("textbox", { name: "Nom de la conversation" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Objectif autonome/ }));
    expect(
      await screen.findByRole("dialog", { name: "Objectif autonome" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("dialog", { name: "Actions de la conversation" }),
    ).toBeNull();
  });
});
