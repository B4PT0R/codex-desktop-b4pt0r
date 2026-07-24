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
import { ApprovalDialog } from "../../src/components/ApprovalDialog";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("dialogues", () => {
  it("transmet explicitement la décision d’approbation", () => {
    const onDecide = vi.fn();
    render(
      <ApprovalDialog
        approval={{
          requestId: 1,
          kind: "command",
          title: "Autoriser cette commande ?",
          description: "Commande de test",
          allowSession: true,
        }}
        onDecide={onDecide}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pour la session" }));
    expect(onDecide).toHaveBeenCalledWith("session");
  });

  it("place l’approbation sur le choix prudent et piège le focus", async () => {
    render(
      <ApprovalDialog
        approval={{
          requestId: 1,
          kind: "command",
          title: "Autoriser cette commande ?",
          description: "Commande de test",
          allowSession: true,
        }}
        onDecide={vi.fn()}
      />,
    );
    const decline = screen.getByRole("button", { name: "Refuser" });
    const accept = screen.getByRole("button", { name: "Autoriser une fois" });
    await waitFor(() => expect(decline).toHaveFocus());

    accept.focus();
    fireEvent.keyDown(accept, { key: "Tab" });

    expect(decline).toHaveFocus();
  });

  it("affiche les décisions sensibles dans la langue sélectionnée", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <ApprovalDialog
          approval={{
            requestId: 1,
            kind: "command",
            title: "Allow this command?",
            description: "Test command",
            allowSession: true,
          }}
          onDecide={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "Deny" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "For this session" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Allow once" })).toBeVisible();
  });
});
