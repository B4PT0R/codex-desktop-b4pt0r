// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewChatDialog } from "../../src/components/NewChatDialog";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(cleanup);
beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));

describe("choix du nouveau chat", () => {
  it("distingue une discussion générale d’un thread de projet", () => {
    const onDiscussion = vi.fn();
    const onProject = vi.fn();
    render(
      <I18nProvider>
        <NewChatDialog
          onCancel={vi.fn()}
          onDiscussion={onDiscussion}
          onProject={onProject}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Démarrer un nouveau chat" }))
      .toBeVisible();
    const discussion = screen.getByRole("button", { name: /Discussion/ });
    expect(discussion).toHaveFocus();
    fireEvent.click(discussion);
    expect(onDiscussion).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /Thread de projet/ }));
    expect(onProject).toHaveBeenCalledOnce();
  });
});
