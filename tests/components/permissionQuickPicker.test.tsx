// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionQuickPicker } from "../../src/components/PermissionQuickPicker";
import { I18nProvider } from "../../src/i18n/I18nProvider";

beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));
afterEach(cleanup);

describe("sélecteur rapide de permission", () => {
  it("applique un profil autorisé puis ferme le popover", async () => {
    const onChange = vi.fn(async () => true);
    render(
      <I18nProvider>
        <PermissionQuickPicker
          onChange={onChange}
          permission=":workspace"
          profiles={[
            { id: ":read-only", description: null, allowed: true },
            { id: ":workspace", description: null, allowed: true },
            {
              id: ":danger-full-access",
              description: null,
              allowed: false,
            },
          ]}
        />
      </I18nProvider>,
    );

    const trigger = screen.getByRole("button", {
      name: /Espace de travail/,
    });
    fireEvent.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Niveau de permission" }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: /Accès complet/ }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("option", { name: /Lecture seule/ }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(":read-only"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
