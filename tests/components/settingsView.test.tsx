// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "../../src/lib/nativeBridge";
import type { ComponentProps } from "react";
import { SettingsView } from "../../src/components/SettingsView";
import { SettingsLoader } from "../../src/components/SettingsLoader";
import { I18nProvider } from "../../src/i18n/I18nProvider";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/nativeBridge", () => ({
  invoke: invokeMock,
  isDesktopApp: () => Boolean(window.electronDesktop),
}));

const integrations = {
  hooks: { data: [], loading: false, warnings: [] },
  mcpServers: { data: [], loading: false },
  skills: { data: [], loading: false },
  refreshMcp: vi.fn(),
  refreshHooks: vi.fn(),
  refreshSkills: vi.fn(),
  setSkillEnabled: vi.fn(),
  updatingSkills: [],
};
const capabilities = {
  collaborationModes: {
    data: [
      {
        name: "Default",
        mode: "default" as const,
        model: null,
        reasoning_effort: null,
      },
      {
        name: "Plan",
        mode: "plan" as const,
        model: null,
        reasoning_effort: "medium",
      },
    ],
    loading: false,
  },
  permissionProfiles: {
    data: [
      { id: ":read-only", description: null, allowed: true },
      { id: ":workspace", description: null, allowed: true },
    ],
    loading: false,
  },
  refresh: vi.fn(),
};
const account = {
  account: null,
  usage: null,
  loading: false,
  refresh: vi.fn(),
  workspaceMessages: null,
};
const apps = {
  apps: [],
  loading: false,
  refresh: vi.fn(),
};
const rateLimits = {
  consumeReset: vi.fn(),
  consuming: false,
  loading: false,
  nudgeMessage: undefined,
  nudging: false,
  quotas: [],
  reachedType: null,
  refresh: vi.fn(),
  resetCredits: null,
  sendOwnerNudge: vi.fn(),
};
const externalAgentImport = {
  items: [],
  histories: [],
  detecting: false,
  historyLoading: false,
  importing: false,
  completed: false,
  results: [],
  detect: vi.fn(),
  importItems: vi.fn(),
  refreshHistory: vi.fn(),
  clearResult: vi.fn(),
};
const realtime = {
  voice: "juniper" as const,
  voices: ["juniper", "maple"] as const,
  loading: false,
  saving: false,
  refresh: vi.fn(),
  setVoice: vi.fn(),
};
const webSearch = {
  fileOpener: "vscode" as const,
  mode: "cached" as const,
  modelVerbosity: "medium" as const,
  planReasoningEffort: "high" as const,
  reasoningSummary: "auto" as const,
  loading: false,
  refresh: vi.fn(),
  setFileOpener: vi.fn().mockResolvedValue(true),
  setMode: vi.fn().mockResolvedValue(true),
  setModelVerbosity: vi.fn().mockResolvedValue(true),
  setPlanReasoningEffort: vi.fn().mockResolvedValue(true),
  setReasoningSummary: vi.fn().mockResolvedValue(true),
};
const appServerRestart = {
  available: true,
  restart: vi.fn().mockResolvedValue(true),
  restarting: false,
};
const memory = {
  enabled: false,
  generateMemories: true,
  useMemories: true,
  disableOnExternalContext: false,
  minRateLimitRemainingPercent: 25,
  loading: false,
  saving: false,
  resetting: false,
  setEnabled: vi.fn().mockResolvedValue(true),
  setGenerateMemories: vi.fn().mockResolvedValue(true),
  setUseMemories: vi.fn().mockResolvedValue(true),
  setDisableOnExternalContext: vi.fn().mockResolvedValue(true),
  setMinRateLimitRemainingPercent: vi.fn().mockResolvedValue(true),
  reset: vi.fn().mockResolvedValue(true),
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  Reflect.deleteProperty(window, "electronDesktop");
  vi.mocked(invoke).mockReset();
});

function renderSettings(
  overrides: Partial<ComponentProps<typeof SettingsView>> = {},
  View: typeof SettingsView = SettingsView,
) {
  const props: ComponentProps<typeof SettingsView> = {
    account,
    appServerRestart,
    apps,
    capabilities,
    collaborationMode: "default",
    approvalPolicy: "on-request",
    effort: "medium",
    externalAgentImport,
    integrations,
    model: "gpt-a",
    memory,
    models: [
      { id: "gpt-a", label: "GPT A" },
      { id: "gpt-b", label: "GPT B" },
    ],
    permission: ":workspace",
    personality: "pragmatic",
    rateLimits,
    realtime,
    webSearch,
    section: "general",
    onChangeCollaborationMode: vi.fn(),
    onChangeApprovalPolicy: vi.fn(),
    onChangeEffort: vi.fn(),
    onChangeModel: vi.fn(),
    onChangePermission: vi.fn(),
    onChangePersonality: vi.fn(),
    onClose: vi.fn(),
    onSave: vi.fn(),
    onSelectSection: vi.fn(),
    ...overrides,
  };
  localStorage.setItem("codex-desktop.locale", "fr");
  render(
    <I18nProvider>
      <View {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("centre de réglages", () => {
  it("propose le redémarrage global d’App Server dans Général", () => {
    const restart = vi.fn().mockResolvedValue(true);
    renderSettings({ appServerRestart: { ...appServerRestart, restart } });

    fireEvent.click(
      screen.getByRole("button", { name: "Redémarrer" }),
    );
    expect(restart).toHaveBeenCalledOnce();
  });

  it("modifie le mode global de recherche web depuis Options", () => {
    const setMode = vi.fn().mockResolvedValue(true);
    renderSettings({
      section: "options",
      webSearch: { ...webSearch, setMode },
    });

    expect(
      screen.getByRole("heading", { name: "Options", level: 1 }),
    ).toBeVisible();
    const select = screen.getByRole("combobox", { name: "Recherche web" });
    expect(select).toHaveValue("cached");
    fireEvent.change(select, { target: { value: "live" } });
    expect(setMode).toHaveBeenCalledWith("live");
  });

  it("désactive les modes de recherche interdits par la politique", () => {
    renderSettings({
      section: "options",
      webSearch: {
        ...webSearch,
        allowed: ["cached", "disabled"],
      },
    });

    expect(screen.getByRole("option", { name: "En direct" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Cache" })).toBeEnabled();
  });

  it("enregistre l’application d’ouverture dans Général et les résumés dans Options", () => {
    const setFileOpener = vi.fn().mockResolvedValue(true);
    const setReasoningSummary = vi.fn().mockResolvedValue(true);
    const controller = {
      ...webSearch,
      setFileOpener,
      setReasoningSummary,
    };
    renderSettings({ webSearch: controller });

    fireEvent.change(
      screen.getByRole("combobox", { name: "Ouvrir les fichiers avec" }),
      { target: { value: "cursor" } },
    );
    expect(setFileOpener).toHaveBeenCalledWith("cursor");

    cleanup();
    renderSettings({ section: "options", webSearch: controller });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Résumés de raisonnement" }),
      { target: { value: "concise" } },
    );
    expect(setReasoningSummary).toHaveBeenCalledWith("concise");
  });

  it("enregistre la verbosité et l’effort du mode Plan dans Agent et modèles", () => {
    const setModelVerbosity = vi.fn().mockResolvedValue(true);
    const setPlanReasoningEffort = vi.fn().mockResolvedValue(true);
    renderSettings({
      section: "agent",
      webSearch: {
        ...webSearch,
        setModelVerbosity,
        setPlanReasoningEffort,
      },
    });

    fireEvent.change(
      screen.getByRole("combobox", { name: "Verbosité des réponses" }),
      { target: { value: "high" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Raisonnement en mode Plan" }),
      { target: { value: "xhigh" } },
    );
    expect(setModelVerbosity).toHaveBeenCalledWith("high");
    expect(setPlanReasoningEffort).toHaveBeenCalledWith("xhigh");
  });

  it("contrôle la mémoire locale et garde sa suppression sous confirmation", () => {
    const setEnabled = vi.fn().mockResolvedValue(true);
    const reset = vi.fn().mockResolvedValue(true);
    renderSettings({
      section: "memory",
      memory: { ...memory, setEnabled, reset },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Activer la mémoire" }));
    expect(setEnabled).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("charge la vue secondaire avant de restituer la section demandée", async () => {
    renderSettings({ section: "permissions" }, SettingsLoader);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ouverture des réglages…",
    );
    expect(
      await screen.findByRole("heading", { name: "Permissions", level: 1 }),
    ).toBeVisible();
  });

  it("expose séparément permissions et politique d’approbation", () => {
    const props = renderSettings({ section: "permissions" });
    const approvals = screen.getByLabelText("Approbations");
    expect(approvals).toHaveValue("on-request");
    fireEvent.change(approvals, { target: { value: "never" } });
    expect(props.onChangeApprovalPolicy).toHaveBeenCalledWith("never");
  });

  it("expose la navigation cible sans simuler les fonctions futures", async () => {
    const props = renderSettings();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Général", level: 1 }),
      ).toHaveFocus(),
    );
    expect(screen.getByLabelText("Langue de l’interface")).toBeVisible();
    expect(screen.getAllByText("Prévu").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Serveurs MCP/ }));
    expect(props.onSelectSection).toHaveBeenCalledWith("mcp");
    fireEvent.click(
      screen.getByRole("button", { name: "Retour à l’application" }),
    );
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("revient à la conversation avec Échap", () => {
    const props = renderSettings();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("filtre les catégories et leurs mots-clés", () => {
    renderSettings();
    fireEvent.change(
      screen.getByPlaceholderText("Rechercher dans les paramètres"),
      {
        target: { value: "oauth" },
      },
    );
    expect(screen.getByRole("button", { name: /Serveurs MCP/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Apparence/ })).toBeNull();
  });

  it("change et conserve la langue de toute la navigation", async () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText("Langue de l’interface"), {
      target: { value: "en" },
    });
    expect(
      await screen.findByRole("button", { name: "Back to app" }),
    ).toBeVisible();
    expect(screen.getByPlaceholderText("Search settings")).toBeVisible();
    expect(screen.getByRole("heading", { name: "General" })).toBeVisible();
    expect(localStorage.getItem("codex-desktop.locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("demande une confirmation avant d’installer Chromium", async () => {
    Object.defineProperty(window, "electronDesktop", {
      configurable: true,
      value: {},
    });
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "read_launch_at_login") return false;
      if (command === "read_chromium_status")
        return {
          available: false,
          installing: false,
          installSupported: true,
          installPackage: "chromium-browser",
        };
      if (command === "install_chromium")
        return {
          available: true,
          installing: false,
          installSupported: true,
          executable: "/usr/bin/chromium",
          version: "Chromium 148",
        };
      return undefined;
    });
    renderSettings();

    const install = await screen.findByRole("button", {
      name: "Installer Chromium",
    });
    await waitFor(() => expect(install).toBeEnabled());
    fireEvent.click(install);
    expect(invoke).not.toHaveBeenCalledWith("install_chromium", expect.anything());
    expect(
      await screen.findByText(
        /Autoriser l’installation du paquet chromium-browser/,
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("install_chromium", {
        confirmed: true,
      }),
    );
  });

  it("conserve les réglages fonctionnels du thread", () => {
    const onChangeModel = vi.fn();
    const onChangePersonality = vi.fn();
    const onSave = vi.fn();
    renderSettings({
      section: "agent",
      onChangeModel,
      onChangePersonality,
      onSave,
    });
    fireEvent.change(screen.getByLabelText("Personnalité"), {
      target: { value: "friendly" },
    });
    expect(onChangePersonality).toHaveBeenCalledWith("friendly");
    fireEvent.change(screen.getByLabelText("Modèle"), {
      target: { value: "gpt-b" },
    });
    expect(onChangeModel).toHaveBeenCalledWith("gpt-b");
    fireEvent.click(
      screen.getByRole("button", { name: "Appliquer et revenir" }),
    );
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("désactive la personnalité uniquement si le modèle la refuse explicitement", () => {
    renderSettings({
      section: "agent",
      models: [
        {
          id: "gpt-a",
          label: "GPT A",
          supportsPersonality: false,
        },
      ],
    });
    expect(screen.getByLabelText("Personnalité")).toBeDisabled();
    expect(screen.getByLabelText("Personnalité")).toHaveAttribute(
      "title",
      "Le modèle sélectionné ne prend pas en charge les personnalités.",
    );
  });

  it("édite la configuration globale dans l’aperçu sans quitter les réglages", async () => {
    renderSettings({ section: "config" });
    const editor = await screen.findByLabelText("Contenu de config.toml");
    expect((editor as HTMLTextAreaElement).value).toContain(
      'model = "gpt-5.4"',
    );
    expect(screen.getByText("Aperçu navigateur")).toBeVisible();
    fireEvent.change(editor, {
      target: { value: 'model = "gpt-5.6"\n' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Configuration enregistrée.")).toBeVisible();
  });
});
