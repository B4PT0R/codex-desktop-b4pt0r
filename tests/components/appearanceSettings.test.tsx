// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceSettings } from "../../src/components/AppearanceSettings";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import { AppearanceProvider } from "../../src/lib/AppearanceProvider";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("codex-desktop.locale", "fr");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

describe("réglages d’apparence", () => {
  it("applique et conserve le thème et la taille de l’interface", async () => {
    render(
      <AppearanceProvider>
        <I18nProvider>
          <AppearanceSettings />
        </I18nProvider>
      </AppearanceProvider>,
    );

    fireEvent.change(screen.getByLabelText("Thème"), {
      target: { value: "light" },
    });
    fireEvent.change(screen.getByLabelText("Taille de l’interface"), {
      target: { value: "large" },
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement).toHaveAttribute(
      "data-font-size",
      "large",
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("codex-desktop.appearance") ?? "{}"),
      ).toEqual({ theme: "light", fontSize: "large" }),
    );
  });
});
