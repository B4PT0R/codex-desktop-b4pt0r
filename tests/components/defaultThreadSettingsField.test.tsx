// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DefaultThreadSettingsField } from "../../src/components/DefaultThreadSettingsField";
import { I18nProvider } from "../../src/i18n/I18nProvider";

describe("réglage de la conversation par défaut", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("sélectionne une conversation connue ou le repli automatique", async () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    const setDefaultThreadId = vi.fn();
    render(
      <I18nProvider>
        <DefaultThreadSettingsField
          controller={{
            defaultThreadId: "thread-a",
            saving: false,
            setDefaultThreadId,
            threadOptions: [
              { id: "thread-a", name: "Contexte principal", cwd: "/home/user" },
              { id: "thread-b", name: "Projet", cwd: "/work/project" },
            ],
          }}
        />
      </I18nProvider>,
    );

    const select = screen.getByRole("combobox", {
      name: "Conversation par défaut",
    });
    expect(select).toHaveValue("thread-a");
    fireEvent.change(select, { target: { value: "thread-b" } });
    expect(setDefaultThreadId).toHaveBeenCalledWith("thread-b");
    fireEvent.change(select, { target: { value: "" } });
    expect(setDefaultThreadId).toHaveBeenCalledWith(undefined);
    await act(async () => {});
    await waitFor(() => expect(select).toBeEnabled());
  });

  it("borne les libellés longs sans perdre leur valeur complète", () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    const name =
      "Une conversation au titre volontairement beaucoup trop long pour le sélecteur";
    const cwd =
      "/home/user/development/workspaces/a/very/deep/project/directory";
    render(
      <I18nProvider>
        <DefaultThreadSettingsField
          controller={{
            defaultThreadId: "thread-long",
            saving: false,
            setDefaultThreadId: vi.fn(),
            threadOptions: [
              { id: "thread-long", name, cwd },
            ],
          }}
        />
      </I18nProvider>,
    );

    const option = screen.getByRole("option", {
      name: `${name} — ${cwd}`,
    });
    expect(option).toHaveAttribute("title", `${name} — ${cwd}`);
    expect(option).toHaveTextContent("…");
    expect(option.textContent?.length).toBeLessThan(name.length + cwd.length);
    expect(
      screen.getByRole("combobox", { name: "Conversation par défaut" }),
    ).toHaveClass("default-thread-select");
  });

  it("présente une résolution en cours sans inventer de titre", () => {
    localStorage.setItem("codex-desktop.locale", "fr");
    render(
      <I18nProvider>
        <DefaultThreadSettingsField
          controller={{
            defaultThreadId: "thread-outside-page",
            saving: false,
            setDefaultThreadId: vi.fn(),
            threadOptions: [],
          }}
        />
      </I18nProvider>,
    );

    expect(
      screen.getByRole("option", {
        name: "Conversation par défaut sélectionnée",
      }),
    ).toHaveValue("thread-outside-page");
    expect(
      screen.queryByText("Conversation configurée"),
    ).not.toBeInTheDocument();
  });
});
