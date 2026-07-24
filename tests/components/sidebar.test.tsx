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

function renderSidebar(onNewChat = vi.fn(), onArchive = vi.fn()) {
  const search = searchController();
  render(
    <Sidebar
      cwd=""
      open
      threads={threads}
      search={search}
      onArchive={onArchive}
      onClose={vi.fn()}
      onNewChat={onNewChat}
      onOpenSettings={vi.fn()}
      onResume={vi.fn()}
      onSelectDirectory={vi.fn()}
    />,
  );
  return { onArchive, onNewChat, search };
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
          search={search}
          threads={threads}
          onArchive={vi.fn()}
          onClose={vi.fn()}
          onNewChat={vi.fn()}
          onOpenSettings={vi.fn()}
          onResume={vi.fn()}
          onSelectDirectory={vi.fn()}
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

  it("regroupe les conversations par projet et permet de les archiver", () => {
    const { onArchive } = renderSidebar();

    expect(screen.getByText("desktop")).toBeVisible();
    expect(screen.getByText("tests")).toBeVisible();
    expect(screen.getByLabelText("En cours")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Archiver Corriger la navigation" }),
    );
    expect(onArchive).toHaveBeenCalledWith(threads[0]);
  });

  it("traduit la navigation avec le pack anglais", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <Sidebar
          cwd=""
          open
          search={searchController()}
          threads={[]}
          onArchive={vi.fn()}
          onClose={vi.fn()}
          onNewChat={vi.fn()}
          onOpenSettings={vi.fn()}
          onResume={vi.fn()}
          onSelectDirectory={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: /New chat/ })).toBeVisible();
    expect(screen.getByText("Recent projects")).toBeVisible();
    expect(screen.getByText("Settings")).toBeVisible();
  });
});
