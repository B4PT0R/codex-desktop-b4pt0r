// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchiveNotice } from "../../src/components/ArchiveNotice";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("retour d’archivage", () => {
  it("annonce la conversation et permet de la restaurer", () => {
    const onUndo = vi.fn();
    render(
      <ArchiveNotice
        thread={{ id: "thread-1", name: "Corriger la navigation" }}
        onDismiss={vi.fn()}
        onUndo={onUndo}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Conversation archivéeCorriger la navigation",
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("disparaît automatiquement après huit secondes", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <ArchiveNotice
        thread={{ id: "thread-1", name: "Conversation" }}
        onDismiss={onDismiss}
        onUndo={vi.fn()}
      />,
    );

    vi.advanceTimersByTime(7_999);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("utilise le pack anglais actif", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <ArchiveNotice
          thread={{ id: "thread-1", name: "Review navigation" }}
          onDismiss={vi.fn()}
          onUndo={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Conversation archivedReview navigation",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
