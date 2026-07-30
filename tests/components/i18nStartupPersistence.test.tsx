// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadDesktopSettingsMock = vi.hoisted(() => vi.fn());
const updateDesktopSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/lib/desktopSettings", () => ({
  loadDesktopSettings: loadDesktopSettingsMock,
  updateDesktopSettings: updateDesktopSettingsMock,
}));

import {
  I18nProvider,
  useI18n,
} from "../../src/i18n/I18nProvider";

function LocaleControl() {
  const { locale, setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("en")}>
      {locale}
    </button>
  );
}

describe("I18nProvider startup persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("codex-desktop.locale", "fr");
    loadDesktopSettingsMock.mockReset().mockResolvedValue({ version: 1 });
    updateDesktopSettingsMock
      .mockReset()
      .mockResolvedValue({ version: 1, locale: "en" });
  });

  it("does not persist a derived default locale until the user changes it", async () => {
    render(
      <I18nProvider>
        <LocaleControl />
      </I18nProvider>,
    );

    await waitFor(() => expect(loadDesktopSettingsMock).toHaveBeenCalledOnce());
    expect(updateDesktopSettingsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "fr" }));
    await waitFor(() =>
      expect(updateDesktopSettingsMock).toHaveBeenCalledWith({ locale: "en" }),
    );
  });
});
