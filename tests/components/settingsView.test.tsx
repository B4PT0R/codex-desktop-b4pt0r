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
  reloadMcp: vi.fn(),
  reloadingMcp: false,
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
const appUpdate = {
  checking: false,
  error: undefined,
  installerOpened: false,
  installing: false,
  loadingVersions: false,
  native: true,
  versions: {
    clientVersion: "0.3.12",
    codexVersion: "codex-cli 0.145.0",
  },
  status: undefined,
  check: vi.fn().mockResolvedValue(true),
  install: vi.fn().mockResolvedValue(true),
};
const apps = {
  apps: [],
  loading: false,
  refresh: vi.fn(),
};
const automations = {
  automations: [],
  loading: false,
  deleteAutomation: vi.fn().mockResolvedValue(true),
  refresh: vi.fn().mockResolvedValue(undefined),
  runNow: vi.fn().mockResolvedValue(true),
  save: vi.fn().mockResolvedValue(undefined),
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
  advanced: {
    agentsEnabled: true,
    approvalPolicy: "on-request" as const,
    approvalsReviewer: "user" as const,
    allowLoginShell: true,
    cliAuthCredentialsStore: "file" as const,
    defaultPermissions: ":workspace" as const,
    mcpOauthCredentialsStore: "auto" as const,
    model: null,
    modelAutoCompactTokenLimit: null,
    modelReasoningEffort: null,
    personality: null,
    projectDocFallbackFilenames: [],
    projectDocMaxBytes: 32_768,
    serviceTier: null,
    subagentInterruptMessage: true,
    subagentMaxConcurrentThreads: null,
    subagentModel: null,
    subagentReasoningEffort: null,
    suppressUnstableFeaturesWarning: false,
    toolOutputTokenLimit: null,
  },
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
  setAdvanced: vi.fn().mockResolvedValue(true),
};
const chatPresentation = {
  loading: false,
  maxVisibleActions: 3,
  saving: false,
  setMaxVisibleActions: vi.fn().mockResolvedValue(true),
};
const appServerRestart = {
  available: true,
  restart: vi.fn().mockResolvedValue(true),
  restarting: false,
};
const defaultThread = {
  defaultThreadId: undefined,
  error: undefined,
  loading: false,
  saving: false,
  threadOptions: [],
  setDefaultThreadId: vi.fn().mockResolvedValue(true),
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
const remoteControl = {
  available: true,
  allowed: true,
  clients: [
    {
      clientId: "client-1",
      displayName: "Téléphone de Baptiste",
      deviceType: "phone",
      platform: "iOS",
      osVersion: "19",
      deviceModel: "iPhone",
      appVersion: "1.2.3",
      lastSeenAt: 1_772_694_000,
    },
  ],
  clientsLoading: false,
  disabling: false,
  enabling: false,
  loading: false,
  nextCursor: null,
  pairing: undefined,
  pairingClaimed: false,
  pairingLoading: false,
  status: {
    status: "connected" as const,
    serverName: "linux-box",
    installationId: "install-1",
    environmentId: "env-1",
  },
  disable: vi.fn().mockResolvedValue(true),
  enable: vi.fn().mockResolvedValue(true),
  loadMoreClients: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
  revokeClient: vi.fn().mockResolvedValue(true),
  startPairing: vi.fn().mockResolvedValue(true),
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
    appUpdate,
    appServerRestart,
    apps,
    automations,
    capabilities,
    chatPresentation,
    defaultThread,
    externalAgentImport,
    integrations,
    memory,
    remoteControl,
    models: [
      {
        id: "gpt-a",
        label: "GPT A",
        isDefault: true,
        serviceTiers: [
          {
            id: "fast",
            name: "Fast",
            description: "Réponses prioritaires plus rapides.",
          },
        ],
      },
      { id: "gpt-b", label: "GPT B" },
    ],
    rateLimits,
    realtime,
    webSearch,
    section: "general",
    onClose: vi.fn(),
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
  it("demande un redémarrage après l’ouverture de l’installateur", () => {
    renderSettings({
      appUpdate: {
        ...appUpdate,
        installerOpened: true,
        status: {
          assetAvailable: true,
          currentVersion: "0.3.12",
          latestVersion: "0.3.13",
          updateAvailable: true,
        },
      },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Termine l’installation, puis relance Codex Desktop pour utiliser la nouvelle version.",
    );
  });

  it("confirme la suppression d’une tâche planifiée", async () => {
    const deleteAutomation = vi.fn().mockResolvedValue(true);
    renderSettings({
      automations: {
        ...automations,
        deleteAutomation,
        automations: [
          {
            id: "automation-1",
            name: "Revue quotidienne",
            prompt: "Inspecte les changements récents",
            cwd: "/project",
            enabled: true,
            schedule: {
              type: "weekly" as const,
              time: "09:00",
              days: [0, 1, 2, 3, 4, 5, 6],
            },
            target: { type: "newThread" as const },
            nextRunAt: Date.now() + 60_000,
          },
        ],
      },
      section: "automations",
    });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(deleteAutomation).not.toHaveBeenCalled();
    expect(
      screen.getByText("Supprimer cette tâche planifiée ?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() =>
      expect(deleteAutomation).toHaveBeenCalledWith("automation-1"),
    );
  });

  it("crée une tâche planifiée dans une nouvelle conversation", async () => {
    const save = vi.fn().mockResolvedValue({ id: "automation-1" });
    renderSettings({
      automations: { ...automations, save },
      currentThreadId: "thread-1",
      currentWorkspace: "/project",
      section: "automations",
    });

    fireEvent.click(screen.getByRole("button", { name: "Créer une tâche" }));
    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Revue quotidienne" },
    });
    fireEvent.change(screen.getByLabelText("Tâche à réaliser"), {
      target: { value: "Inspecte les changements récents" },
    });
    fireEvent.change(screen.getByLabelText("Fréquence"), {
      target: { value: "daily" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Exécution sans surveillance/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Revue quotidienne",
          prompt: "Inspecte les changements récents",
          cwd: "/project",
          unattendedAccess: true,
          schedule: {
            type: "weekly",
            time: "09:00",
            days: [0, 1, 2, 3, 4, 5, 6],
          },
          target: { type: "newThread" },
        }),
      ),
    );
  });

  it("programme un réveil unique dans un thread éphémère", async () => {
    const save = vi.fn().mockResolvedValue({ id: "automation-1" });
    renderSettings({
      automations: { ...automations, save },
      currentWorkspace: "/project",
      section: "automations",
    });

    fireEvent.click(screen.getByRole("button", { name: "Créer une tâche" }));
    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Contrôle ponctuel" },
    });
    fireEvent.change(screen.getByLabelText("Tâche à réaliser"), {
      target: { value: "Vérifie le déploiement" },
    });
    fireEvent.change(screen.getByLabelText("Fréquence"), {
      target: { value: "once" },
    });
    fireEvent.change(screen.getByLabelText("Date et heure"), {
      target: { value: "2099-08-04T14:30" },
    });
    fireEvent.change(screen.getByLabelText("Conversation"), {
      target: { value: "ephemeralThread" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          schedule: {
            type: "once",
            at: new Date("2099-08-04T14:30").getTime(),
          },
          target: { type: "ephemeralThread" },
        }),
      ),
    );
  });

  it("cible la conversation par défaut sans figer son identifiant", async () => {
    const save = vi.fn().mockResolvedValue({ id: "automation-1" });
    renderSettings({
      automations: { ...automations, save },
      section: "automations",
    });

    fireEvent.click(screen.getByRole("button", { name: "Créer une tâche" }));
    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Continuité" },
    });
    fireEvent.change(screen.getByLabelText("Tâche à réaliser"), {
      target: { value: "Poursuis le travail courant" },
    });
    fireEvent.change(screen.getByLabelText("Conversation"), {
      target: { value: "defaultThread" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { type: "defaultThread" },
        }),
      ),
    );
  });

  it("propose le redémarrage global d’App Server dans Général", () => {
    const restart = vi.fn().mockResolvedValue(true);
    renderSettings({ appServerRestart: { ...appServerRestart, restart } });

    fireEvent.click(screen.getByRole("button", { name: "Redémarrer" }));
    expect(restart).toHaveBeenCalledOnce();
    expect(screen.queryByText("Navigateur Chromium partagé")).toBeNull();
  });

  it("affiche les versions et recherche une release à la demande", () => {
    const check = vi.fn().mockResolvedValue(true);
    renderSettings({ appUpdate: { ...appUpdate, check } });

    expect(screen.getByText("v0.3.12")).toBeVisible();
    expect(screen.getByText("codex-cli 0.145.0")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Rechercher les mises à jour",
      }),
    );
    expect(check).toHaveBeenCalledOnce();
  });

  it("propose la mise à jour lorsqu’un paquet plus récent est disponible", () => {
    const install = vi.fn().mockResolvedValue(true);
    renderSettings({
      appUpdate: {
        ...appUpdate,
        install,
        status: {
          assetAvailable: true,
          currentVersion: "0.3.12",
          latestVersion: "0.3.13",
          updateAvailable: true,
        },
      },
    });

    expect(screen.getByText("La version 0.3.13 est disponible.")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à jour" }),
    );
    expect(install).toHaveBeenCalledOnce();
  });

  it("modifie le mode global de recherche web depuis Web", () => {
    const setMode = vi.fn().mockResolvedValue(true);
    renderSettings({
      section: "browser",
      webSearch: { ...webSearch, setMode },
    });

    expect(
      screen.getByRole("heading", { name: "Web", level: 1 }),
    ).toBeVisible();
    const select = screen.getByRole("combobox", { name: "Recherche web" });
    expect(select).toHaveValue("cached");
    fireEvent.change(select, { target: { value: "live" } });
    expect(setMode).toHaveBeenCalledWith("live");
  });

  it("désactive les modes de recherche interdits par la politique", () => {
    renderSettings({
      section: "browser",
      webSearch: {
        ...webSearch,
        allowed: ["cached", "disabled"],
      },
    });

    expect(screen.getByRole("option", { name: "En direct" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Cache" })).toBeEnabled();
  });

  it("enregistre l’application d’ouverture dans Général et l’affichage dans Apparence", () => {
    const setFileOpener = vi.fn().mockResolvedValue(true);
    const setReasoningSummary = vi.fn().mockResolvedValue(true);
    const setMaxVisibleActions = vi.fn().mockResolvedValue(true);
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
    renderSettings({
      chatPresentation: {
        ...chatPresentation,
        setMaxVisibleActions,
      },
      section: "appearance",
      webSearch: controller,
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Résumés de raisonnement" }),
      { target: { value: "concise" } },
    );
    expect(setReasoningSummary).toHaveBeenCalledWith("concise");
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Actions visibles par groupe",
      }),
      { target: { value: "5" } },
    );
    expect(setMaxVisibleActions).toHaveBeenCalledWith(5);
  });

  it("enregistre uniquement des valeurs globales dans les réglages Agent", () => {
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

    fireEvent.change(screen.getByRole("combobox", { name: "Modèle" }), {
      target: { value: "gpt-b" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Personnalité" }), {
      target: { value: "friendly" },
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
    expect(webSearch.setAdvanced).toHaveBeenCalledWith("model", "gpt-b");
    expect(webSearch.setAdvanced).toHaveBeenCalledWith(
      "personality",
      "friendly",
    );
    fireEvent.click(screen.getByRole("option", { name: /Fast/ }));
    expect(webSearch.setAdvanced).toHaveBeenCalledWith("service_tier", "fast");
    fireEvent.change(
      screen.getByRole("combobox", { name: "Modèle des sous-agents" }),
      { target: { value: "gpt-b" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Sous-agents simultanés" }),
      { target: { value: "4" } },
    );
    expect(webSearch.setAdvanced).toHaveBeenCalledWith(
      "agents.default_subagent_model",
      "gpt-b",
    );
    expect(webSearch.setAdvanced).toHaveBeenCalledWith(
      "agents.max_concurrent_threads_per_session",
      4,
    );
  });

  it("contrôle la mémoire locale et garde sa suppression sous confirmation", () => {
    const setEnabled = vi.fn().mockResolvedValue(true);
    const reset = vi.fn().mockResolvedValue(true);
    renderSettings({
      section: "memory",
      memory: { ...memory, setEnabled, reset },
    });

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Activer la mémoire" }),
    );
    expect(setEnabled).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("active le pairing distant et protège la révocation d’un appareil", async () => {
    const startPairing = vi.fn().mockResolvedValue(true);
    const revokeClient = vi.fn().mockResolvedValue(true);
    renderSettings({
      section: "remoteControl",
      remoteControl: { ...remoteControl, startPairing, revokeClient },
    });

    expect(
      screen.getByRole("heading", { name: "Contrôle à distance", level: 1 }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Créer un code" }));
    expect(startPairing).toHaveBeenCalledOnce();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Révoquer Téléphone de Baptiste",
      }),
    );
    expect(revokeClient).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Révoquer" }));
    await waitFor(() => expect(revokeClient).toHaveBeenCalledWith("client-1"));
  });

  it("charge la vue secondaire avant de restituer la section demandée", async () => {
    renderSettings({ section: "permissions" }, SettingsLoader);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ouverture des réglages…",
    );
    expect(
      await screen.findByRole("heading", {
        name: "Permissions",
        level: 1,
      }),
    ).toBeVisible();
  });

  it("présente et écrit séparément les permissions et approbations globales", async () => {
    const props = renderSettings({
      section: "permissions",
      configRequirements: {
        managed: true,
        managedHooksOnly: false,
        allowedApprovalsReviewers: ["user", "auto_review"],
      },
    });
    expect(
      screen.getByText(
        "Définit les fichiers, le réseau et les ressources système accessibles par défaut à Codex.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Choisissez quand Codex doit demander votre confirmation.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText("Permissions et approbations restent distinctes"),
    ).toBeNull();
    expect(
      screen.getByRole("option", { name: /À la demande/ }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.click(
      screen.getByRole("option", { name: /Ne jamais demander/ }),
    );
    await waitFor(() =>
      expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
        "approval_policy",
        "never",
      ),
    );
    fireEvent.click(screen.getByRole("option", { name: /Lecture seule/ }));
    await waitFor(() =>
      expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
        "default_permissions",
        ":read-only",
      ),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /Relecture automatique/ }),
    );
    await waitFor(() =>
      expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
        "approvals_reviewer",
        "auto_review",
      ),
    );
  });

  it("désactive un relecteur exclu par la politique administrée", () => {
    renderSettings({
      section: "permissions",
      configRequirements: {
        managed: true,
        managedHooksOnly: false,
        allowedApprovalsReviewers: ["user"],
      },
    });

    expect(
      screen.getByRole("option", { name: /Relecture automatique/ }),
    ).toBeDisabled();
  });

  it("expose la navigation cible sans simuler les fonctions futures", async () => {
    const props = renderSettings();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Général", level: 1 }),
      ).toHaveFocus(),
    );
    expect(screen.getByLabelText("Langue de l’interface")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Git et espaces de travail/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Configuration avancée" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Importer depuis d’autres agents",
      }),
    );
    expect(props.onSelectSection).toHaveBeenCalledWith("advanced");
    fireEvent.click(screen.getByRole("button", { name: /Serveurs MCP/ }));
    expect(props.onSelectSection).toHaveBeenCalledWith("mcp");
    fireEvent.click(
      screen.getByRole("button", { name: "Retour à l’application" }),
    );
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("réserve la section d’import aux migrations réellement disponibles", () => {
    renderSettings({ section: "advanced" });

    expect(
      screen.getByRole("heading", {
        name: "Importer depuis d’autres agents",
        level: 1,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Importer depuis un autre agent",
        level: 2,
      }),
    ).toBeVisible();
    expect(screen.queryByText("Fonctions expérimentales")).toBeNull();
    expect(screen.queryByText("Diagnostics et feedback")).toBeNull();
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

  it("ordonne les catégories selon leur fréquence de consultation", () => {
    renderSettings();
    const labels = Array.from(
      screen.getByRole("navigation").querySelectorAll("button"),
      (button) => button.textContent?.trim(),
    );

    expect(labels).toEqual([
      "Général",
      "Agent",
      "Permissions",
      "Web",
      "Voix",
      "Apparence et affichage",
      "Tâches planifiées",
      "Mémoire",
      "Plugins et apps",
      "Serveurs MCP",
      "Contrôle à distance",
      "Compte et utilisation",
      "Hooks",
      "Configuration avancée",
      "Importer depuis d’autres agents",
    ]);
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

  it("demande une confirmation avant d’activer le navigateur partagé", async () => {
    Object.defineProperty(window, "electronDesktop", {
      configurable: true,
      value: {},
    });
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "read_launch_at_login") return false;
      if (command === "read_chromium_status")
        return {
          available: false,
          enabled: false,
          running: false,
          installing: false,
          installSupported: true,
          installPackage: "Playwright Chromium",
        };
      if (command === "install_chromium")
        return {
          available: true,
          enabled: true,
          running: true,
          installing: false,
          installSupported: true,
          version: "Chrome for Testing 151",
          mcpVersion: "0.0.78",
        };
      return undefined;
    });
    renderSettings({ section: "browser" });
    expect(
      screen.getByRole("heading", { name: "Web", level: 1 }),
    ).toBeVisible();

    const enabled = await screen.findByRole("checkbox", {
      name: "Activer le navigateur partagé",
    });
    await waitFor(() => expect(enabled).toBeEnabled());
    fireEvent.click(enabled);
    expect(invoke).not.toHaveBeenCalledWith(
      "install_chromium",
      expect.anything(),
    );
    expect(
      await screen.findByText(/Télécharger le Chromium Playwright privé/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("install_chromium", {
        confirmed: true,
      }),
    );
    await waitFor(() => expect(integrations.reloadMcp).toHaveBeenCalled());
    expect(await screen.findByText("Prêt · partagé avec Codex")).toBeVisible();
    expect(enabled).toBeChecked();
  });

  it("laisse le défaut global de personnalité éditable quel que soit le modèle courant", () => {
    renderSettings({
      section: "agent",
      webSearch: {
        ...webSearch,
        advanced: { ...webSearch.advanced, model: "gpt-a" },
      },
      models: [
        {
          id: "gpt-a",
          label: "GPT A",
          supportsPersonality: false,
        },
      ],
    });
    expect(screen.getByLabelText("Personnalité")).toBeEnabled();
  });

  it("édite la configuration globale dans l’aperçu sans quitter les réglages", async () => {
    renderSettings({ section: "config" });
    expect(
      screen.getByRole("heading", { name: "Configuration guidée" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Modifiez directement config.toml pour les options qui ne disposent pas d’un réglage guidé.",
      ),
    ).toBeVisible();
    expect(screen.queryByLabelText("Contenu de config.toml")).toBeNull();
    expect(screen.getAllByText("Aperçu navigateur")).toHaveLength(1);
    const opener = screen.getByRole("button", {
      name: /config\.toml.*Modifier/,
    });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "config.toml" })).toBeVisible();
    const editor = await screen.findByLabelText("Contenu de config.toml");
    await waitFor(() => expect(editor).toHaveFocus());
    const close = screen.getByRole("button", { name: "Fermer l’éditeur" });
    const save = screen.getByRole("button", { name: "Enregistrer" });
    fireEvent.change(editor, {
      target: { value: 'model = "gpt-5.6"\n' },
    });
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
    expect((editor as HTMLTextAreaElement).value).toContain(
      'model = "gpt-5.6"',
    );
    fireEvent.click(save);
    expect(await screen.findByText("Configuration enregistrée.")).toBeVisible();
    fireEvent.click(close);
    expect(screen.queryByRole("dialog", { name: "config.toml" })).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("modifie les réglages TOML avancés depuis Config", () => {
    const props = renderSettings({ section: "config" });

    fireEvent.change(screen.getByLabelText("Seuil de compactage"), {
      target: { value: "64000" },
    });
    fireEvent.change(screen.getByLabelText("Noms de fichiers de repli"), {
      target: { value: "CLAUDE.md, CONTRIBUTING.md" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Enregistrer les fichiers de repli",
      }),
    );
    fireEvent.click(screen.getByLabelText("Autoriser les shells de connexion"));
    fireEvent.change(screen.getByLabelText("Identifiants OAuth MCP"), {
      target: { value: "keyring" },
    });
    fireEvent.click(
      screen.getByLabelText(
        "Masquer les avertissements de fonctionnalités instables",
      ),
    );

    expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
      "model_auto_compact_token_limit",
      64_000,
    );
    expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
      "project_doc_fallback_filenames",
      ["CLAUDE.md", "CONTRIBUTING.md"],
    );
    expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
      "allow_login_shell",
      false,
    );
    expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
      "mcp_oauth_credentials_store",
      "keyring",
    );
    expect(props.webSearch.setAdvanced).toHaveBeenCalledWith(
      "suppress_unstable_features_warning",
      true,
    );
  });

  it("édite les instructions personnelles globales depuis Agent", async () => {
    renderSettings({ section: "agent" });
    fireEvent.click(
      screen.getByRole("button", { name: /AGENTS\.md.*Modifier/ }),
    );
    const editor = await screen.findByLabelText("Contenu du AGENTS.md global");
    expect((editor as HTMLTextAreaElement).value).toContain(
      "Personal Codex defaults",
    );
    fireEvent.change(editor, {
      target: { value: "# Mes règles\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(
      await screen.findByText("AGENTS.md global enregistré."),
    ).toBeVisible();
  });

  it("protège les modifications de Config à la fermeture de la modale", async () => {
    const props = renderSettings({ section: "config" });
    fireEvent.click(
      screen.getByRole("button", { name: /config\.toml.*Modifier/ }),
    );
    const editor = await screen.findByLabelText("Contenu de config.toml");
    fireEvent.change(editor, { target: { value: 'model = "changed"\n' } });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(props.onClose).not.toHaveBeenCalled();
    expect(
      screen.getByText("Des modifications ne sont pas enregistrées."),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Ignorer les modifications" }),
    );
    expect(screen.queryByRole("dialog", { name: "config.toml" })).toBeNull();
  });
});
