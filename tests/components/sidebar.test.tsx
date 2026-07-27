// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../src/components/Sidebar";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const threads = [
  {
    id: "alpha",
    name: "Corriger la navigation",
    cwd: "/work/desktop",
    status: "active" as const,
  },
  {
    id: "gamma",
    name: "Polir la sidebar",
    cwd: "/work/desktop",
  },
  { id: "beta", preview: "Ajouter les tests", cwd: "/work/tests" },
];

function searchController() {
  return {
    query: "",
    results: [],
    loading: false,
    hasMore: false,
    setQuery: vi.fn(),
    loadMore: vi.fn(),
    remove: vi.fn(),
  };
}

function renderSidebar(
  onNewChat = vi.fn(),
  onArchive = vi.fn(),
  onDelete = vi.fn().mockResolvedValue(true),
  onWidthChange = vi.fn(),
  onWidthCommit = vi.fn(),
) {
  const search = searchController();
  render(
    <Sidebar
      cwd=""
      open
      selectedThreadId="alpha"
      width={260}
      threads={threads}
      search={search}
      onArchive={onArchive}
      onDelete={onDelete}
      onClose={vi.fn()}
      onNewChat={onNewChat}
      onOpenSettings={vi.fn()}
      onResume={vi.fn()}
      onSelectDirectory={vi.fn()}
      onWidthChange={onWidthChange}
      onWidthCommit={onWidthCommit}
    />,
  );
  return {
    onArchive,
    onDelete,
    onNewChat,
    onWidthChange,
    onWidthCommit,
    search,
  };
}

describe("barre latérale", () => {
  it("filtre les conversations par titre, aperçu ou dossier", () => {
    const { search } = renderSidebar();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "tests" },
    });
    expect(search.setQuery).toHaveBeenCalledWith("tests");
    search.query = "tests";
    cleanup();
    render(
      <I18nProvider>
        <Sidebar
          cwd=""
          open
          width={260}
          search={search}
          threads={threads}
          onArchive={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
          onNewChat={vi.fn()}
          onOpenSettings={vi.fn()}
          onResume={vi.fn()}
          onSelectDirectory={vi.fn()}
          onWidthChange={vi.fn()}
          onWidthCommit={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Ajouter les tests" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Corriger la navigation" }),
    ).not.toBeInTheDocument();
  });

  it("active les raccourcis Linux annoncés", () => {
    const { onNewChat } = renderSidebar();
    fireEvent.keyDown(window, { key: "n", ctrlKey: true });
    expect(onNewChat).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("redimensionne la sidebar au clavier dans ses limites", () => {
    const { onWidthChange, onWidthCommit } = renderSidebar();
    const separator = screen.getByRole("separator", {
      name: "Redimensionner la barre latérale",
    });

    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(onWidthChange).toHaveBeenCalledWith(276);
    expect(onWidthCommit).toHaveBeenCalledWith(276);

    fireEvent.keyDown(separator, { key: "End" });
    expect(onWidthChange).toHaveBeenLastCalledWith(420);
  });

  it("regroupe les conversations par projet et permet de les archiver", () => {
    const { onArchive } = renderSidebar();

    expect(screen.getByText("desktop")).toBeVisible();
    expect(screen.getByText("tests")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "desktop" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Polir la sidebar")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Ajouter les tests" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("En cours")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Archiver Corriger la navigation" }),
    );
    expect(onArchive).toHaveBeenCalledWith(threads[0]);

    fireEvent.click(screen.getByRole("button", { name: "tests" }));
    expect(
      screen.getByRole("button", { name: "Ajouter les tests" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "desktop" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Corriger la navigation" }),
    ).not.toBeInTheDocument();
  });

  it("demande confirmation avant de supprimer une conversation", async () => {
    const { onDelete } = renderSidebar();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Supprimer Corriger la navigation",
      }),
    );
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Supprimer définitivement" }),
    );
    expect(onDelete).toHaveBeenCalledWith(threads[0]);
  });

  it("traduit la navigation avec le pack anglais", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <Sidebar
          cwd=""
          open
          width={260}
          search={searchController()}
          threads={[]}
          onArchive={vi.fn()}
          onDelete={vi.fn()}
          onClose={vi.fn()}
          onNewChat={vi.fn()}
          onOpenSettings={vi.fn()}
          onResume={vi.fn()}
          onSelectDirectory={vi.fn()}
          onWidthChange={vi.fn()}
          onWidthCommit={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: /New chat/ })).toBeVisible();
    expect(screen.getByText("Recent projects")).toBeVisible();
    expect(screen.getByText("Settings")).toBeVisible();
  });
});
