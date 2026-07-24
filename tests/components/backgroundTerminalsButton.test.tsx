// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../src/i18n/I18nProvider";

const terminate = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/useBackgroundTerminals", () => ({
  useBackgroundTerminals: () => ({
    error: undefined,
    loading: false,
    refresh: vi.fn(),
    terminals: [
      {
        itemId: "item-1",
        processId: "42",
        command: "python3 -m http.server",
        cwd: "/work/app",
        osPid: 1234,
        cpuPercent: 1.25,
        rssKb: 20_480,
      },
    ],
    terminate,
    terminating: [],
  }),
}));

import { BackgroundTerminalsButton } from "../../src/components/BackgroundTerminalsButton";

afterEach(() => {
  cleanup();
  terminate.mockReset();
});

describe("indicateur de terminaux en arrière-plan", () => {
  it("présente les ressources et confirme avant l’arrêt", async () => {
    terminate.mockResolvedValue(true);
    localStorage.setItem("codex-desktop.locale", "fr");
    render(
      <I18nProvider>
        <BackgroundTerminalsButton
          busy={false}
          connected={true}
          threadId="thread-1"
        />
      </I18nProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "1 terminal(aux) en arrière-plan" }),
    );
    expect(screen.getByText("python3 -m http.server")).toBeVisible();
    expect(screen.getByText("/work/app")).toBeVisible();
    expect(screen.getByText(/PID 1234.*1.3 % CPU.*20 MB/)).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Arrêter python3 -m http.server" }),
    );
    expect(
      screen.getByText("Arrêter ce processus en arrière-plan ?"),
    ).toBeVisible();
    expect(terminate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Arrêter" }));
    expect(terminate).toHaveBeenCalledWith("42");
  });

  it("ferme la liste avec Échap et restitue le focus", () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    render(
      <I18nProvider>
        <BackgroundTerminalsButton
          busy={false}
          connected={true}
          threadId="thread-1"
        />
      </I18nProvider>,
    );
    const opener = screen.getByRole("button", {
      name: "1 terminal(aux) en arrière-plan",
    });
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
