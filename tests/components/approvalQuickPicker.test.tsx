// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalQuickPicker } from "../../src/components/ApprovalQuickPicker";
import { I18nProvider } from "../../src/i18n/I18nProvider";

beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));
afterEach(cleanup);

describe("sélecteur rapide d’approbation", () => {
  it("applique une politique autorisée et bloque une politique administrée", async () => {
    const onChange = vi.fn(async () => true);
    render(
      <I18nProvider>
        <ApprovalQuickPicker
          allowed={["on-request", "never"]}
          onChange={onChange}
          policy="on-request"
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "À la demande" }));
    expect(
      screen.getByRole("option", { name: /Commandes non fiables/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("option", { name: /Ne jamais demander/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("never"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
