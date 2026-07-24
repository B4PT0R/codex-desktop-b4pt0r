import { describe, expect, it } from "vitest";
import {
  mcpElicitationFromMessage,
  mcpElicitationResponse,
} from "../../src/lib/mcpElicitation";

describe("elicitations MCP", () => {
  it("normalise les champs primitifs et les sélections du contrat v2", () => {
    const request = mcpElicitationFromMessage({
      id: "elicit-1",
      method: "mcpServer/elicitation/request",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        serverName: "calendar",
        mode: "form",
        message: "Planifier la réunion",
        requestedSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              title: "Titre",
              minLength: 2,
              maxLength: 80,
              default: "Revue",
            },
            duration: {
              type: "integer",
              title: "Durée",
              minimum: 5,
              maximum: 120,
            },
            private: { type: "boolean", title: "Privée", default: true },
            color: {
              type: "string",
              title: "Couleur",
              oneOf: [
                { const: "blue", title: "Bleu" },
                { const: "green", title: "Vert" },
              ],
            },
            guests: {
              type: "array",
              title: "Invités",
              minItems: 1,
              items: { type: "string", enum: ["Ada", "Linus"] },
            },
          },
          required: ["title", "duration"],
        },
      },
    });

    expect(request).toEqual({
      requestId: "elicit-1",
      serverName: "calendar",
      message: "Planifier la réunion",
      mode: "form",
      isToolApproval: false,
      persistModes: [],
      details: [],
      fields: [
        {
          id: "title",
          title: "Titre",
          description: undefined,
          required: true,
          kind: "text",
          defaultValue: "Revue",
          format: undefined,
          minLength: 2,
          maxLength: 80,
        },
        {
          id: "duration",
          title: "Durée",
          description: undefined,
          required: true,
          kind: "number",
          integer: true,
          defaultValue: undefined,
          minimum: 5,
          maximum: 120,
        },
        {
          id: "private",
          title: "Privée",
          description: undefined,
          required: false,
          kind: "boolean",
          defaultValue: true,
        },
        {
          id: "color",
          title: "Couleur",
          description: undefined,
          required: false,
          kind: "select",
          options: [
            { value: "blue", label: "Bleu" },
            { value: "green", label: "Vert" },
          ],
          defaultValue: undefined,
        },
        {
          id: "guests",
          title: "Invités",
          description: undefined,
          required: false,
          kind: "multi-select",
          options: [
            { value: "Ada", label: "Ada" },
            { value: "Linus", label: "Linus" },
          ],
          defaultValue: [],
          minItems: 1,
          maxItems: undefined,
        },
      ],
    });
  });

  it("isole les URL non sûres et les formulaires OpenAI opaques", () => {
    expect(
      mcpElicitationFromMessage({
        id: 2,
        method: "mcpServer/elicitation/request",
        params: {
          serverName: "oauth",
          mode: "url",
          message: "Connectez-vous",
          url: "https://example.com/connect",
          elicitationId: "remote-1",
        },
      }),
    ).toMatchObject({ mode: "url", url: "https://example.com/connect" });
    const unsafe = mcpElicitationFromMessage({
        id: 3,
        method: "mcpServer/elicitation/request",
        params: {
          serverName: "unsafe",
          mode: "url",
          message: "Ouvrir",
          url: "javascript:alert(1)",
        },
      });
    expect(unsafe).toMatchObject({ mode: "unsupported" });
    expect(unsafe).not.toHaveProperty("url");
    expect(
      mcpElicitationFromMessage({
        id: 4,
        method: "mcpServer/elicitation/request",
        params: {
          serverName: "apps",
          mode: "openai/form",
          requestedSchema: { type: "object" },
        },
      }),
    ).toMatchObject({ mode: "unsupported" });
  });

  it("construit les réponses acceptées, refusées et persistantes", () => {
    expect(mcpElicitationResponse("accept", { confirmed: true }, "session"))
      .toEqual({
        action: "accept",
        content: { confirmed: true },
        _meta: { persist: "session" },
      });
    expect(mcpElicitationResponse("decline")).toEqual({
      action: "decline",
      content: null,
      _meta: null,
    });
    expect(mcpElicitationResponse("accept")).toEqual({
      action: "accept",
      content: null,
      _meta: null,
    });
  });
});
