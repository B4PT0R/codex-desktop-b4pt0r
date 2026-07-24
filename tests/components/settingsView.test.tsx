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
    apps,
    capabilities,
    collaborationMode: "default",
    effort: "medium",
    externalAgentImport,
    integrations,
    model: "gpt-a",
    models: [
      { id: "gpt-a", label: "GPT A" },
      { id: "gpt-b", label: "GPT B" },
    ],
    permission: ":workspace",
    personality: "pragmatic",
    rateLimits,
    realtime,
    section: "general",
    onChangeCollaborationMode: vi.fn(),
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
  it("charge la vue secondaire avant de restituer la section demandée", async () => {
    renderSettings({ section: "permissions" }, SettingsLoader);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ouverture des réglages…",
    );
    expect(
      await screen.findByRole("heading", { name: "Permissions", level: 1 }),
    ).toBeVisible();
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
    const onSave = vi.fn();
    renderSettings({ section: "agent", onChangeModel, onSave });
    fireEvent.change(screen.getByLabelText("Modèle"), {
      target: { value: "gpt-b" },
    });
    expect(onChangeModel).toHaveBeenCalledWith("gpt-b");
    fireEvent.click(
      screen.getByRole("button", { name: "Appliquer et revenir" }),
    );
    expect(onSave).toHaveBeenCalledOnce();
  });
});
