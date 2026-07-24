// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpElicitationDialog } from "../../src/components/McpElicitationDialog";
import { I18nProvider } from "../../src/i18n/I18nProvider";
import type { McpElicitationRequest } from "../../src/lib/mcpElicitation";

vi.mock("../../src/lib/nativeBridge", () => ({ openUrl: vi.fn() }));

const baseRequest: McpElicitationRequest = {
  requestId: "request-1",
  serverName: "calendar",
  message: "Planifier la réunion",
  mode: "form",
  fields: [],
  isToolApproval: false,
  persistModes: [],
  details: [],
};

afterEach(cleanup);

function renderDialog(
  request: McpElicitationRequest,
  onSubmit = vi.fn(),
) {
  localStorage.setItem("codex-desktop.locale", "fr");
  render(
    <I18nProvider>
      <McpElicitationDialog
        request={request}
        submitting={false}
        onSubmit={onSubmit}
      />
    </I18nProvider>,
  );
  return onSubmit;
}

describe("dialogue d’elicitation MCP", () => {
  it("valide et sérialise un formulaire structuré", () => {
    const onSubmit = renderDialog({
      ...baseRequest,
      fields: [
        {
          id: "name",
          title: "Nom",
          required: true,
          kind: "text",
          defaultValue: "",
        },
        {
          id: "duration",
          title: "Durée",
          required: false,
          kind: "number",
          integer: true,
          defaultValue: undefined,
          minimum: 5,
          maximum: 60,
        },
        {
          id: "notify",
          title: "Notifier",
          required: false,
          kind: "boolean",
          defaultValue: false,
        },
      ],
    });

    fireEvent.change(screen.getByLabelText(/Nom/), {
      target: { value: "Revue" },
    });
    fireEvent.change(screen.getByLabelText(/Durée/), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByLabelText(/Notifier/));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(onSubmit).toHaveBeenCalledWith({
      action: "accept",
      content: { name: "Revue", duration: 30, notify: true },
      _meta: null,
    });
  });

  it("offre uniquement les persistances annoncées par une approbation", () => {
    const onSubmit = renderDialog({
      ...baseRequest,
      message: "Autoriser calendar.create ?",
      isToolApproval: true,
      persistModes: ["session"],
    });

    expect(
      screen.getByRole("button", { name: "Pour cette session" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Toujours autoriser" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Pour cette session" }),
    );
    expect(onSubmit).toHaveBeenCalledWith({
      action: "accept",
      content: {},
      _meta: { persist: "session" },
    });
  });

  it("garde une demande non prise en charge résoluble au clavier", () => {
    const onSubmit = renderDialog({
      ...baseRequest,
      mode: "unsupported",
    });
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Envoyer" })).toBeNull();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onSubmit).toHaveBeenCalledWith({
      action: "cancel",
      content: null,
      _meta: null,
    });
  });
});
