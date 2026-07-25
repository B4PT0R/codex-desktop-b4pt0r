// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeneratedImageWidget } from "../../src/components/GeneratedImageWidget";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import { invoke } from "../../src/lib/nativeBridge";

vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: vi.fn(),
  isDesktopApp: () => true,
}));

afterEach(cleanup);

beforeEach(() => {
  localStorage.setItem("codex-desktop.locale", "fr");
  vi.mocked(invoke).mockReset().mockResolvedValue(true);
});

describe("widget d’image générée", () => {
  const artifact = {
    type: "generatedImage" as const,
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    path: "/tmp/chat-astronaute.png",
    prompt: "Un chat astronaute",
  };

  it("reste ouvert jusqu’au repli explicite", () => {
    const { rerender } = render(
      <I18nProvider>
        <GeneratedImageWidget artifacts={[artifact]} />
      </I18nProvider>,
    );

    const toggle = screen.getByRole("button", { name: /Image générée/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("img", { name: "Un chat astronaute" })).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("img", { name: "Un chat astronaute" }),
    ).not.toBeInTheDocument();

    rerender(
      <I18nProvider>
        <GeneratedImageWidget artifacts={[{ ...artifact, prompt: "Prompt final" }]} />
      </I18nProvider>,
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("agrandit et enregistre l’image par la frontière native", async () => {
    render(
      <I18nProvider>
        <GeneratedImageWidget artifacts={[artifact]} />
      </I18nProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Agrandir l’image" })[0]);
    expect(
      screen.getByRole("dialog", { name: "Aperçu agrandi de l’image" }),
    ).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "Enregistrer l’image" })[0]);
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("save_generated_image", {
        dataUrl: artifact.dataUrl,
        path: artifact.path,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Fermer l’aperçu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
