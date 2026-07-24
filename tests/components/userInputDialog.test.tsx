// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserInputDialog } from "../../src/components/UserInputDialog";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("dialogue de question agent", () => {
  it("collecte un choix et une réponse libre avant de répondre", () => {
    const onSubmit = vi.fn();
    render(
      <UserInputDialog
        request={{
          requestId: 1,
          questions: [
            {
              id: "scope",
              header: "Portée",
              question: "Quelle portée ?",
              isOther: true,
              isSecret: false,
              options: [
                { label: "Ciblée", description: "Modifier un seul module" },
              ],
            },
            {
              id: "note",
              header: "Précision",
              question: "Une contrainte particulière ?",
              isOther: false,
              isSecret: false,
            },
          ],
        }}
        submitting={false}
        onSubmit={onSubmit}
      />,
    );
    const submit = screen.getByRole("button", { name: "Envoyer la réponse" });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Ciblée/ }));
    fireEvent.change(screen.getByLabelText("Réponse — Précision"), {
      target: { value: "Préserver l’API" },
    });
    fireEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      answers: {
        scope: { answers: ["Ciblée"] },
        note: { answers: ["user_note: Préserver l’API"] },
      },
    });
  });

  it("affiche Autre et protège une réponse secrète", () => {
    render(
      <UserInputDialog
        request={{
          requestId: "request-2",
          autoResolutionMs: 60_000,
          questions: [
            {
              id: "credential",
              header: "Jeton",
              question: "Quel jeton utiliser ?",
              isOther: true,
              isSecret: true,
              options: [
                {
                  label: "Existant",
                  description: "Utiliser le jeton configuré",
                },
              ],
            },
          ],
        }}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Autre/ }));

    expect(screen.getByLabelText("Réponse — Jeton")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByText(/continuer automatiquement/)).toBeInTheDocument();
  });

  it("traduit le formulaire libre et son libellé accessible", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <UserInputDialog
          request={{
            requestId: 3,
            questions: [
              {
                id: "scope",
                header: "Scope",
                question: "Which scope?",
                isOther: false,
                isSecret: false,
              },
            ],
          }}
          submitting={false}
          onSubmit={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Codex needs your response")).toBeVisible();
    expect(screen.getByLabelText("Answer — Scope")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send response" })).toBeVisible();
  });
});
