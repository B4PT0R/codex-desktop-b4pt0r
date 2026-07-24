// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountAuthActions } from "../../src/components/AccountAuthActions";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import type { AccountController } from "../../src/lib/useAccount";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("authentification du compte", () => {
  it("confirme avant de déconnecter le compte courant", () => {
    const controller = accountController({
      account: {
        account: { type: "chatgpt", email: null, planType: "pro" },
        requiresOpenaiAuth: true,
      },
    });
    render(<AccountAuthActions controller={controller} />);
    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(controller.logout).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer la déconnexion" }),
    );
    expect(controller.logout).toHaveBeenCalledOnce();
  });

  it("rend un login en attente récupérable et annulable", () => {
    const controller = accountController({
      authOpenMode: "system",
      authPending: {
        loginId: "login-1",
        authUrl: "https://chatgpt.com/auth",
      },
    });
    render(<AccountAuthActions controller={controller} />);
    expect(screen.getByText(/Chromium indisponible/)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Rouvrir le navigateur" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(controller.reopenLogin).toHaveBeenCalledOnce();
    expect(controller.cancelLogin).toHaveBeenCalledOnce();
  });

  it("utilise le pack anglais sélectionné", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <AccountAuthActions controller={accountController()} />
      </I18nProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Sign in with ChatGPT" }),
    ).toBeVisible();
    expect(screen.getByText("Authentication")).toBeVisible();
  });
});

function accountController(
  overrides: Partial<AccountController> = {},
): AccountController {
  return {
    account: null,
    authPending: null,
    cancelLogin: vi.fn(),
    loading: false,
    loggingOut: false,
    logout: vi.fn(),
    refresh: vi.fn(),
    reopenLogin: vi.fn(),
    startLogin: vi.fn(),
    startingLogin: false,
    usage: null,
    workspaceMessages: null,
    ...overrides,
  };
}
