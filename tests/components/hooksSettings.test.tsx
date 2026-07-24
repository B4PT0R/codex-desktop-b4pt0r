// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HooksSettings } from "../../src/components/HooksSettings";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import type { IntegrationsController } from "../../src/lib/useIntegrations";

afterEach(cleanup);

describe("réglages des hooks", () => {
  it("présente leur origine, confiance et détails à la demande", () => {
    const integrations = controller();
    render(
      <I18nProvider>
        <HooksSettings integrations={integrations} />
      </I18nProvider>,
    );
    expect(screen.getByText("After tool use · Command · shell")).toBeVisible();
    expect(screen.getByText("Trusted")).toBeVisible();
    expect(screen.getByText("Project")).toBeVisible();
    expect(screen.queryByText("npm run lint")).not.toBeVisible();
    fireEvent.click(screen.getByText("Details"));
    expect(screen.getByText("npm run lint")).toBeVisible();
    expect(screen.getByText("/project/.codex/hooks.json")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(integrations.refreshHooks).toHaveBeenCalledOnce();
  });
});

function controller(): IntegrationsController {
  return {
    authenticateMcp: vi.fn(),
    authenticatingMcp: [],
    hooks: {
      data: [
        {
          key: "lint",
          eventName: "postToolUse",
          handlerType: "command",
          matcher: "shell",
          command: "npm run lint",
          timeoutSec: 30,
          statusMessage: "Vérification du code",
          sourcePath: "/project/.codex/hooks.json",
          source: "project",
          pluginId: null,
          displayOrder: 1,
          enabled: true,
          isManaged: false,
          currentHash: "abc",
          trustStatus: "trusted",
        },
      ],
      loading: false,
      warnings: [],
    },
    mcpServers: { data: [], loading: false },
    skills: { data: [], loading: false },
    refreshHooks: vi.fn(),
    refreshMcp: vi.fn(),
    refreshSkills: vi.fn(),
    setSkillEnabled: vi.fn(),
    updatingSkills: [],
  };
}
