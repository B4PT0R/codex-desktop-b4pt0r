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
import { SecurityQuickPicker } from "../../src/components/SecurityQuickPicker";
import { I18nProvider } from "../../src/i18n/I18nProvider";

beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));
afterEach(cleanup);

describe("sélecteur rapide de sécurité", () => {
  it("regroupe permissions et approbations sans fermer entre les choix", async () => {
    const onChangePermission = vi.fn(async () => true);
    const onChangeApprovalPolicy = vi.fn(async () => true);
    render(
      <I18nProvider>
        <SecurityQuickPicker
          allowedApprovalPolicies={["on-request", "never"]}
          approvalPolicy="on-request"
          onChangeApprovalPolicy={onChangeApprovalPolicy}
          onChangePermission={onChangePermission}
          permission=":workspace"
          permissionProfiles={[
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

    fireEvent.click(screen.getByRole("button", { name: "Sécurité" }));
    expect(
      screen.getByRole("dialog", { name: "Sécurité" }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: /Accès complet/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("option", { name: /Commandes non fiables/ }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("option", { name: /Lecture seule/ }));
    await waitFor(() =>
      expect(onChangePermission).toHaveBeenCalledWith(":read-only"),
    );
    expect(screen.getByRole("dialog", { name: "Sécurité" })).toBeVisible();

    fireEvent.click(screen.getByRole("option", { name: /Ne jamais demander/ }));
    await waitFor(() =>
      expect(onChangeApprovalPolicy).toHaveBeenCalledWith("never"),
    );
  });
});
