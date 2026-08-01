// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppsSettings,
  McpSettings,
  SkillsSettings,
} from "../../src/components/IntegrationSettings";
import type { IntegrationsController } from "../../src/lib/useIntegrations";
import type { AppsController } from "../../src/lib/useApps";
import { I18nProvider } from "../../src/i18n/I18nProvider";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function controller(
  overrides: Partial<IntegrationsController> = {},
): IntegrationsController {
  return {
    addMcpServer: vi.fn(),
    addingMcpServer: false,
    removeMcpServer: vi.fn(),
    removingMcpServers: [],
    removableMcpServers: [],
    authenticateMcp: vi.fn(),
    authenticatingMcp: [],
    hooks: { data: [], loading: false, warnings: [] },
    mcpServers: { data: [], loading: false },
    mcpStartup: {},
    skills: { data: [], loading: false },
    refreshMcp: vi.fn(),
    refreshHooks: vi.fn(),
    refreshSkills: vi.fn(),
    setSkillEnabled: vi.fn(),
    updatingSkills: [],
    ...overrides,
  };
}

function appsController(
  overrides: Partial<AppsController> = {},
): AppsController {
  return {
    apps: [],
    catalogApps: [],
    configurableApps: [],
    installedApps: {},
    loading: false,
    readConfiguration: vi.fn().mockResolvedValue(null),
    openInstall: vi.fn(),
    refresh: vi.fn(),
    saveConfiguration: vi.fn(),
    savingConfigurations: [],
    setEnabled: vi.fn(),
    updatingApps: [],
    ...overrides,
  };
}

describe("réglages des intégrations", () => {
  it("présente les skills réels et permet de les désactiver", () => {
    const integrations = controller({
      skills: {
        data: [
          {
            name: "review",
            description: "Examiner les changements",
            path: "/skills/review/SKILL.md",
            scope: "user",
            enabled: true,
          },
        ],
        loading: false,
      },
    });
    render(<SkillsSettings integrations={integrations} />);
    expect(screen.getByText("Examiner les changements")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(integrations.setSkillEnabled).toHaveBeenCalledWith(
      integrations.skills.data[0],
      false,
    );
    expect(
      screen.getByText(/API officielle est encore réservée/),
    ).toBeVisible();
  });

  it("présente les Apps accessibles et permet de les désactiver globalement", () => {
    const github = {
      id: "github",
      name: "GitHub",
      description: "Rechercher les dépôts et issues",
      installUrl: null,
      isAccessible: true,
      isEnabled: true,
      pluginDisplayNames: [],
    };
    const apps = appsController({
      apps: [github],
      configurableApps: [github],
    });
    render(<AppsSettings apps={apps} />);
    expect(screen.getByText("Rechercher les dépôts et issues")).toBeVisible();
    expect(screen.getByText(/activation s’applique globalement/i)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Activé" }));
    expect(apps.setEnabled).toHaveBeenCalledWith(github, false);
  });

  it("expose les valeurs par défaut directement sur la page Apps", async () => {
    const saveConfiguration = vi.fn().mockResolvedValue(true);
    render(<AppsSettings apps={appsController({
      readConfiguration: vi.fn().mockResolvedValue({
        config: {
          enabled: true,
          approvals_reviewer: null,
          destructive_enabled: false,
          open_world_enabled: true,
          default_tools_approval_mode: "prompt",
        },
        defaults: { enabled: true },
        tools: [],
      }),
      saveConfiguration,
    })} />);

    expect(await screen.findByText("Valeurs par défaut des Apps")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Valeurs par défaut" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Outils destructifs"), { target: { value: "true" } });
    await waitFor(() => expect(saveConfiguration).toHaveBeenCalledWith({
      enabled: true,
      approvalsReviewer: null,
      destructiveEnabled: true,
      openWorldEnabled: true,
      defaultToolsApprovalMode: "prompt",
    }));
  });

  it("configure progressivement la politique et les outils d’une App", async () => {
    const github = {
      id: "github",
      name: "GitHub",
      description: "Rechercher les dépôts et issues",
      installUrl: null,
      isAccessible: true,
      isEnabled: true,
      pluginDisplayNames: [],
    };
    const saveConfiguration = vi.fn().mockResolvedValue(true);
    const readConfiguration = vi.fn().mockResolvedValue({
      app: github,
      config: {
        enabled: true,
        approvals_reviewer: null,
        destructive_enabled: null,
        open_world_enabled: null,
        default_tools_approval_mode: null,
        default_tools_enabled: null,
        tools: {},
      },
      defaults: { enabled: true },
      tools: [{
        name: "search",
        title: "Rechercher",
        description: "Recherche les dépôts",
        isEnabled: true,
        disabledReason: null,
        isReadOnly: true,
      }],
    });
    render(<AppsSettings apps={appsController({
      apps: [github],
      configurableApps: [github],
      readConfiguration,
      saveConfiguration,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Configurer GitHub" })).getByLabelText("Outils destructifs")).toBeVisible());
    const dialog = screen.getByRole("dialog", { name: "Configurer GitHub" });
    expect(readConfiguration).toHaveBeenCalledWith(github);
    expect(within(dialog).getByLabelText("Outils destructifs")).toHaveValue("inherit");

    fireEvent.click(screen.getByRole("tab", { name: "Outils" }));
    fireEvent.change(screen.getByLabelText("État de Rechercher"), { target: { value: "false" } });
    fireEvent.change(screen.getByLabelText("Approbation de Rechercher"), { target: { value: "prompt" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      appId: "github",
      tools: { search: { enabled: false, approvalMode: "prompt" } },
    })));
  });

  it("parcourt les Apps disponibles et délègue leur connexion au parcours fourni", async () => {
    const drive = {
      id: "google_drive",
      name: "Google Drive",
      description: "Rechercher des documents",
      logoUrl: null,
      logoUrlDark: null,
      distributionChannel: "hosted",
      branding: { category: "Productivité", developer: "Google", website: null, isDiscoverableApp: true },
      appMetadata: null,
      installUrl: "https://chatgpt.com/apps/google-drive",
      isAccessible: false,
      isEnabled: true,
      pluginDisplayNames: [],
    };
    const openInstall = vi.fn().mockResolvedValue(true);
    const readConfiguration = vi.fn().mockResolvedValue({
      app: drive,
      config: { enabled: true },
      defaults: { enabled: true },
      tools: [{ name: "search", title: "Rechercher", description: "Recherche Drive", isEnabled: true, disabledReason: null, isReadOnly: true }],
    });
    render(<AppsSettings apps={appsController({
      catalogApps: [drive],
      openInstall,
      readConfiguration,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: "Parcourir les Apps" }));
    expect(screen.getByRole("dialog", { name: "Parcourir les Apps" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Disponibles" }));
    fireEvent.click(screen.getByRole("button", { name: "Détails" }));
    expect(await screen.findByText("Recherche Drive")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Connecter" }));
    await waitFor(() => expect(openInstall).toHaveBeenCalledWith(drive));
    expect(await screen.findByRole("button", { name: "Actualiser l’état de connexion" })).toBeVisible();
  });

  it("résume les outils et l’authentification MCP", () => {
    render(
      <McpSettings
        integrations={controller({
          mcpServers: {
            data: [
              {
                name: "github",
                serverInfo: {
                  name: "github",
                  title: "GitHub",
                  version: "1.2.0",
                  description: null,
                },
                tools: { search: {}, read: {} },
                resources: [],
                resourceTemplates: [],
                authStatus: "oAuth",
              },
            ],
            loading: false,
          },
        })}
      />,
    );
    expect(screen.getByText("2 outils · version 1.2.0 · OAuth connecté")).toBeVisible();
  });

  it("ajoute un serveur MCP local depuis une modale guidée", async () => {
    const integrations = controller({ addMcpServer: vi.fn().mockResolvedValue(true) });
    render(<McpSettings integrations={integrations} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un serveur" }));
    expect(screen.getByRole("dialog", { name: "Ajouter un serveur MCP" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Nom du serveur"), { target: { value: "docs" } });
    fireEvent.change(screen.getByLabelText("Commande"), { target: { value: "npx" } });
    fireEvent.change(screen.getByLabelText(/^Arguments/), { target: { value: "-y\n@acme/docs-mcp" } });
    fireEvent.change(screen.getByLabelText(/^Variables d’environnement/), { target: { value: "DOCS_TOKEN=secret" } });
    fireEvent.click(
      screen.getByRole("dialog", { name: "Ajouter un serveur MCP" })
        .querySelector('button[type="submit"]')!,
    );
    expect(integrations.addMcpServer).toHaveBeenCalledWith({
      name: "docs",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@acme/docs-mcp"],
      env: { DOCS_TOKEN: "secret" },
    });
  });

  it("révèle les réglages MCP avancés sans alourdir le parcours essentiel", () => {
    render(<McpSettings integrations={controller()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un serveur" }));
    expect(screen.queryByLabelText(/^Délai de démarrage/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Avancé" }));
    expect(screen.getByLabelText(/^Délai de démarrage/)).toBeVisible();
    expect(screen.getByLabelText(/^Exposer uniquement/)).toBeVisible();
    expect(screen.getByLabelText(/^Variables d’environnement héritées/)).toBeVisible();
  });

  it("affiche l’échec de démarrage MCP et propose la réauthentification", () => {
    const integrations = controller({
      mcpServers: {
        data: [
          {
            name: "github",
            serverInfo: null,
            tools: {},
            resources: [],
            resourceTemplates: [],
            authStatus: "oAuth",
          },
        ],
        loading: false,
      },
      mcpStartup: {
        github: {
          status: "failed",
          error: "Le jeton a expiré",
          failureReason: "reauthenticationRequired",
        },
      },
    });
    render(<McpSettings integrations={integrations} />);
    expect(screen.getByText(/Échec au démarrage · OAuth connecté/)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Le jeton a expiré");
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(integrations.authenticateMcp).toHaveBeenCalledWith(
      integrations.mcpServers.data[0],
    );
  });

  it("rend les erreurs récupérables et l’actualisation disponible", () => {
    const integrations = controller({
      mcpServers: { data: [], error: "Serveur indisponible", loading: false },
    });
    render(<McpSettings integrations={integrations} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Serveur indisponible");
    fireEvent.click(screen.getByRole("button", { name: /Actualiser/ }));
    expect(integrations.refreshMcp).toHaveBeenCalledOnce();
  });

  it("ne propose la suppression que pour un serveur de la configuration utilisateur", () => {
    const removeMcpServer = vi.fn().mockResolvedValue(true);
    const integrations = controller({
      removeMcpServer,
      removableMcpServers: ["user-server"],
      mcpServers: {
        data: [
          { name: "builtin", serverInfo: null, tools: {}, resources: [], resourceTemplates: [], authStatus: "unsupported" },
          { name: "user-server", serverInfo: null, tools: {}, resources: [], resourceTemplates: [], authStatus: "unsupported" },
        ],
        loading: false,
      },
    });
    render(<McpSettings integrations={integrations} />);
    expect(screen.getAllByRole("button", { name: "Supprimer" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(screen.getByRole("alertdialog", { name: "Supprimer le serveur MCP ?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le serveur" }));
    expect(removeMcpServer).toHaveBeenCalledWith("user-server");
  });

  it("traduit l’inventaire MCP avec le pack anglais", () => {
    localStorage.setItem("codex-desktop.locale", "en");
    render(
      <I18nProvider>
        <McpSettings
          integrations={controller({
            mcpServers: {
              data: [
                {
                  name: "local",
                  serverInfo: null,
                  tools: { search: {} },
                  resources: [],
                  resourceTemplates: [],
                  authStatus: "notLoggedIn",
                },
              ],
              loading: false,
            },
          })}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("1 tool · Sign-in required")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: /Refresh/ })).toBeVisible();
  });
});
