// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceSettings } from "../../src/components/VoiceSettings";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("réglages vocaux", () => {
  it("présente v3, les voix disponibles et persiste le choix demandé", () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    const setVoice = vi.fn();
    render(
      <I18nProvider>
        <VoiceSettings
          controller={{
            voice: "juniper",
            voices: ["juniper", "maple"],
            loading: false,
            saving: false,
            refresh: vi.fn(),
            setVoice,
          }}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("Version 3")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Voix" }), {
      target: { value: "maple" },
    });
    expect(setVoice).toHaveBeenCalledWith("maple");
  });

  it("rend l’échec d’inventaire visible sans masquer le catalogue intégré", () => {
    render(
      <I18nProvider>
        <VoiceSettings
          controller={{
            voice: "juniper",
            voices: ["juniper"],
            loading: false,
            saving: false,
            error: "Catalogue indisponible",
            refresh: vi.fn(),
            setVoice: vi.fn(),
          }}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Catalogue indisponible",
    );
    expect(screen.getByRole("option", { name: "Juniper" })).toBeVisible();
  });
});
