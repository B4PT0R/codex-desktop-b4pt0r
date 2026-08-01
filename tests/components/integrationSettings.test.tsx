// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    configurableApps: [],
    loading: false,
    refresh: vi.fn(),
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
