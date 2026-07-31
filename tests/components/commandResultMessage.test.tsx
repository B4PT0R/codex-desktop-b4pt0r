// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandResultMessage } from "../../src/components/CommandResultMessage";
import { I18nProvider } from "../../src/i18n/I18nProvider";

beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));
afterEach(cleanup);

describe("résultat de slash command", () => {
  it("affiche le résultat puis permet de le replier", () => {
    render(
      <I18nProvider>
        <CommandResultMessage
          message={{
            id: "command-1",
            role: "assistant",
            modality: "commandResult",
            title: "/status",
            content: "**Modèle**: gpt-test",
          }}
        />
      </I18nProvider>,
    );

    const toggle = screen.getByRole("button", { name: /status/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/gpt-test/)).toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/gpt-test/)).toBeNull();
  });
});
