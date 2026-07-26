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
import type { ComponentProps } from "react";
import { Composer } from "../../src/components/Composer";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(cleanup);
beforeEach(() => localStorage.setItem("codex-desktop.locale", "fr"));

function renderlessComposerProps(): ComponentProps<typeof Composer> {
  return {
    apps: [],
    appsLoading: false,
    skills: [],
    skillsLoading: false,
    busy: false,
    canSteer: false,
    cwd: "/work/project",
    hasThread: false,
    recording: false,
    dictating: false,
    dictationProcessing: false,
    onOpenMcp: vi.fn(),
    onOpenPlugins: vi.fn(),
    onNeedApps: vi.fn(),
    onNeedSkills: vi.fn(),
    onSend: vi.fn(),
    onStop: vi.fn(),
    onToggleVoice: vi.fn(),
    onToggleDictation: vi.fn(),
  };
}

function renderComposer(
  overrides: Partial<ComponentProps<typeof Composer>> = {},
) {
  const props: ComponentProps<typeof Composer> = {
    ...renderlessComposerProps(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <Composer {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("composer", () => {
  it("distingue Realtime de la dictée et injecte celle-ci sans envoyer", () => {
    const props = renderComposer();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Démarrer la conversation vocale Realtime",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dicter dans le message" }),
    );
    expect(props.onToggleVoice).toHaveBeenCalledOnce();
    expect(props.onToggleDictation).toHaveBeenCalledOnce();

    cleanup();
    const dictated = renderComposer({
      dictationInsertion: { id: 1, text: "texte dicté" },
    });
    expect(screen.getByRole("textbox")).toHaveValue("texte dicté");
    expect(dictated.onSend).not.toHaveBeenCalled();
  });

  it("empêche le chevauchement des deux sessions audio", () => {
    const { rerender } = render(
      <I18nProvider>
        <Composer
          {...renderlessComposerProps()}
          recording
          dictating={false}
        />
      </I18nProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Dicter dans le message" }),
    ).toBeDisabled();
    rerender(
      <I18nProvider>
        <Composer
          {...renderlessComposerProps()}
          recording={false}
          dictating
        />
      </I18nProvider>,
    );
    expect(
      screen.getByRole("button", {
        name: "Démarrer la conversation vocale Realtime",
      }),
    ).toBeDisabled();
  });

  it("ouvre et parcourt le menu de contexte au clavier", async () => {
    renderComposer();
    const textarea = screen.getByRole("textbox");
    await waitFor(() => expect(textarea).toHaveFocus());
    const add = screen.getByRole("button", { name: "Ajouter du contexte" });

    fireEvent.click(add);
    const images = screen.getByRole("menuitem", { name: /Images/ });
    const files = screen.getByRole("menuitem", { name: /Fichiers du projet/ });
    const shell = screen.getByRole("menuitem", { name: /Commande shell locale/ });
    const apps = screen.getByRole("menuitem", { name: /Apps connectées/ });
    await waitFor(() => expect(images).toHaveFocus());
    fireEvent.keyDown(images, { key: "ArrowDown" });
    expect(files).toHaveFocus();
    fireEvent.keyDown(files, { key: "ArrowDown" });
    expect(shell).toHaveFocus();
    fireEvent.keyDown(shell, { key: "ArrowDown" });
    expect(apps).toHaveFocus();
    fireEvent.keyDown(apps, { key: "End" });
    expect(screen.getByRole("menuitem", { name: /Serveurs MCP/ })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(add).toHaveFocus();
  });

  it("ferme le menu de contexte en cliquant à côté", () => {
    renderComposer();
    const add = screen.getByRole("button", { name: "Ajouter du contexte" });
    const textarea = screen.getByRole("textbox");

    fireEvent.click(add);
    expect(screen.getByRole("menu")).toBeVisible();
    fireEvent.pointerDown(textarea);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(add);
    fireEvent.pointerDown(screen.getByRole("menuitem", { name: /Images/ }));
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("entre dans les commandes avec Flèche bas et revient au composer", async () => {
    renderComposer({ hasThread: true });
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "/" } });
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    const firstCommand = screen.getAllByRole("menuitem")[0];
    expect(firstCommand).toHaveFocus();
    fireEvent.keyDown(firstCommand, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(textarea).toHaveFocus();
  });

  it("utilise le pack anglais sélectionné", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    renderComposer();

    expect(screen.getByPlaceholderText("Ask Codex anything")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add context" }));
    expect(
      screen.getByRole("menuitem", { name: /Connected apps/ }),
    ).toBeVisible();
  });

  it("expose la recherche de fichiers dans le menu de contexte", () => {
    renderComposer();
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter du contexte" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Fichiers du projet/ }),
    );
    expect(
      screen.getByRole("textbox", { name: "Rechercher un fichier" }),
    ).toHaveFocus();
  });

  it("ajoute une app comme mention structurée", () => {
    const props = renderComposer({
      apps: [
        {
          id: "github-connector",
          name: "GitHub",
          description: "Rechercher dans GitHub",
          installUrl: null,
          isAccessible: true,
          isEnabled: true,
          pluginDisplayNames: [],
        },
      ],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter du contexte" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Apps connectées/ }));
    expect(props.onNeedApps).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("menuitem", { name: /GitHub/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "$github recherche les issues" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(props.onSend).toHaveBeenCalledWith("$github recherche les issues", [
      { type: "mention", name: "GitHub", path: "app://github-connector" },
    ]);
  });

  it("joint une skill active comme item App Server structuré", () => {
    const props = renderComposer({
      skills: [
        {
          name: "use-shared-browser",
          description: "Utiliser le navigateur partagé",
          path: "/opt/Codex Desktop/resources/skills/use-shared-browser/SKILL.md",
          scope: "system",
          enabled: true,
        },
        {
          name: "disabled-skill",
          description: "Ne doit pas être proposée",
          path: "/tmp/disabled/SKILL.md",
          scope: "user",
          enabled: false,
        },
      ],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter du contexte" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: /Joindre des instructions explicites/,
      }),
    );
    expect(props.onNeedSkills).toHaveBeenCalledOnce();
    expect(screen.queryByText("disabled-skill")).toBeNull();
    fireEvent.click(
      screen.getByRole("menuitem", { name: /use-shared-browser/ }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("$use-shared-browser ");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "$use-shared-browser ouvre cette page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(props.onSend).toHaveBeenCalledWith(
      "$use-shared-browser ouvre cette page",
      [
        {
          type: "skill",
          name: "use-shared-browser",
          path: "/opt/Codex Desktop/resources/skills/use-shared-browser/SKILL.md",
        },
      ],
    );
  });

  it("centralise les intégrations dans le menu d’ajout", () => {
    const props = renderComposer();
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter du contexte" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Skills et plugins/ }),
    );
    expect(props.onOpenPlugins).toHaveBeenCalledOnce();
  });

  it("prépare une commande shell explicite depuis le menu d’ajout", () => {
    renderComposer();
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter du contexte" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Commande shell locale/ }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("! ");
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("filtre les commandes et protège celles qui exigent un thread", () => {
    renderComposer();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "/rev" },
    });
    expect(screen.getByRole("menuitem", { name: /review/ })).toBeDisabled();
    expect(screen.queryByRole("menuitem", { name: /clear/ })).toBeNull();
  });

  it("présente les commandes desktop fréquentes et protège l’arrêt", () => {
    renderComposer();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "/" } });

    expect(screen.getByRole("menuitem", { name: /\/model/ })).toBeEnabled();
    expect(
      screen.getByRole("menuitem", { name: /\/permissions/ }),
    ).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: /\/compact/ })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /\/stop/ })).toBeDisabled();
  });

  it("insère une commande sélectionnée", () => {
    renderComposer({ hasThread: true });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "/sta" },
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /status/ }));
    expect(screen.getByRole("textbox")).toHaveValue("/status");
  });

  it("distingue l’arrêt et l’ajout d’une instruction pendant un tour", () => {
    const props = renderComposer({ busy: true, canSteer: true });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Vérifie aussi les tests" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter l’instruction" }),
    );

    expect(props.onSend).toHaveBeenCalledWith("Vérifie aussi les tests", []);
    expect(props.onStop).not.toHaveBeenCalled();
    const stop = screen.getByRole("button", { name: "Arrêter le tour" });
    expect(stop.querySelector("span")).toBeNull();
    fireEvent.click(stop);
    expect(props.onStop).toHaveBeenCalledOnce();
  });

  it("désactive l’instruction si le tour ne peut pas être dirigé", () => {
    renderComposer({ busy: true, canSteer: false });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Nouvelle consigne" },
    });

    expect(
      screen.getByRole("button", { name: "Ajouter l’instruction" }),
    ).toBeDisabled();
  });
});
