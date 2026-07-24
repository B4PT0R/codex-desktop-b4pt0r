// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "../../src/i18n/I18nProvider";

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <>
      <p>{t("empty.title")}</p>
      <p>{t("userInput.answerLabel", { header: "Scope" })}</p>
      <button
        type="button"
        onClick={() => setLocale(locale === "fr" ? "en" : "fr")}
      >
        change
      </button>
    </>
  );
}

describe("I18nProvider", () => {
  afterEach(() => document.body.replaceChildren());

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
  });

  it("persists language changes and updates the document language", async () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("Construisez tout avec Codex")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "change" }));

    expect(screen.getByText("Build anything with Codex")).toBeInTheDocument();
    expect(screen.getByText("Answer — Scope")).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem("codex-desktop.locale")).toBe("en"),
    );
    expect(document.documentElement.lang).toBe("en");
  });
});
