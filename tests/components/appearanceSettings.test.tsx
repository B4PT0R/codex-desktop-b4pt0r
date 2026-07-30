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
import { AppearanceSettings } from "../../src/components/AppearanceSettings";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import { AppearanceProvider } from "../../src/lib/AppearanceProvider";

const globalSettings = {
  loading: false,
  reasoningSummary: "auto" as const,
  setReasoningSummary: vi.fn().mockResolvedValue(true),
};
const presentation = {
  loading: false,
  maxVisibleActions: 3,
  saving: false,
  setMaxVisibleActions: vi.fn().mockResolvedValue(true),
};

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

afterEach(cleanup);

describe("réglages d’apparence", () => {
  it("applique et conserve le thème et la taille de l’interface", async () => {
    render(
      <AppearanceProvider>
        <I18nProvider>
          <AppearanceSettings
            globalSettings={globalSettings}
            presentation={presentation}
          />
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
      ).toEqual({
        theme: "light",
        fontSize: "large",
        interfaceScale: 1.25,
      }),
    );
  });

  it("ajuste finement l’échelle au clavier et réinitialise le préréglage", async () => {
    render(
      <AppearanceProvider>
        <I18nProvider>
          <AppearanceSettings
            globalSettings={globalSettings}
            presentation={presentation}
          />
        </I18nProvider>
      </AppearanceProvider>,
    );

    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    expect(document.documentElement.style.getPropertyValue("--interface-scale"))
      .toBe("1.16");

    fireEvent.keyDown(window, { key: "-", ctrlKey: true });
    expect(document.documentElement.style.getPropertyValue("--interface-scale"))
      .toBe("1.12");

    fireEvent.change(screen.getByLabelText("Taille de l’interface"), {
      target: { value: "large" },
    });
    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    expect(document.documentElement.style.getPropertyValue("--interface-scale"))
      .toBe("1.25");

    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("codex-desktop.appearance") ?? "{}"),
      ).toMatchObject({ fontSize: "large", interfaceScale: 1.25 }),
    );
  });
});
