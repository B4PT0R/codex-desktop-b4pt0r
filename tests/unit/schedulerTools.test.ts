import { describe, expect, it } from "vitest";
import {
  automationDraftFromCreate,
  automationDraftFromUpdate,
  dynamicToolFailure,
  schedulerDynamicTools,
  schedulerToolCallFromMessage,
} from "../../src/lib/schedulerTools";
import type { Automation } from "../../src/lib/automations";

describe("outils agentiques du scheduler", () => {
  it("aligne les intervalles exposés sur les limites natives", () => {
    const [namespace] = schedulerDynamicTools();
    const create = namespace.tools.find((tool) => tool.name === "create");
    const schema = create?.inputSchema as {
      properties?: {
        schedule?: {
          oneOf?: Array<{
            properties?: {
              intervalMinutes?: { minimum?: number; maximum?: number };
            };
          }>;
        };
      };
    };
    const interval = schema.properties?.schedule?.oneOf?.find(
      (candidate) =>
        candidate.properties?.intervalMinutes !== undefined,
    )?.properties?.intervalMinutes;

    expect(interval).toEqual({ type: "integer", minimum: 5, maximum: 10080 });
  });

  it("déclare un namespace borné et des schémas d’entrée stricts", () => {
    const [namespace] = schedulerDynamicTools();
    expect(namespace.name).toBe("scheduler");
    expect(namespace.tools.map((tool) => tool.name)).toEqual([
      "list",
      "create",
      "update",
      "set_enabled",
      "run_now",
      "delete",
    ]);
    expect(namespace.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputSchema: expect.objectContaining({
            additionalProperties: false,
          }),
        }),
      ]),
    );
  });

  it("ne capture que les appels du namespace scheduler", () => {
    expect(
      schedulerToolCallFromMessage({
        id: "request-1",
        method: "item/tool/call",
        params: {
          namespace: "scheduler",
          threadId: "thread-1",
          turnId: "turn-1",
          callId: "call-1",
          tool: "list",
          arguments: {},
        },
      }),
    ).toEqual({
      requestId: "request-1",
      threadId: "thread-1",
      tool: "list",
      arguments: {},
    });
    expect(
      schedulerToolCallFromMessage({
        id: "request-2",
        method: "item/tool/call",
        params: {
          namespace: "other",
          threadId: "thread-1",
          tool: "list",
          arguments: {},
        },
      }),
    ).toBeUndefined();
  });

  it("convertit une date ISO et cible par défaut le thread appelant", () => {
    expect(
      automationDraftFromCreate(
        {
          name: "Veille",
          prompt: "Inspecte les nouveautés",
          schedule: { type: "once", at: "2026-08-01T09:30:00+02:00" },
        },
        "thread-1",
      ),
    ).toEqual({
      name: "Veille",
      prompt: "Inspecte les nouveautés",
      enabled: true,
      unattendedAccess: false,
      schedule: {
        type: "once",
        at: Date.parse("2026-08-01T09:30:00+02:00"),
      },
      target: { type: "thread", threadId: "thread-1" },
    });
  });

  it("préserve les champs absents lors d’une mise à jour", () => {
    const current: Automation = {
      id: "task-1",
      name: "Veille",
      prompt: "Inspecte",
      cwd: "/project",
      enabled: false,
      schedule: { type: "interval", intervalMinutes: 60 },
      target: { type: "newThread" },
    };
    expect(
      automationDraftFromUpdate(
        current,
        { name: "Veille hebdomadaire", target: "ephemeralThread" },
        "thread-1",
      ),
    ).toEqual({
      id: "task-1",
      name: "Veille hebdomadaire",
      prompt: "Inspecte",
      cwd: "/project",
      enabled: false,
      schedule: { type: "interval", intervalMinutes: 60 },
      target: { type: "ephemeralThread" },
    });
  });

  it("retourne les erreurs dans le contrat de réponse App Server", () => {
    expect(dynamicToolFailure(new Error("invalide"))).toEqual({
      success: false,
      contentItems: [
        {
          type: "inputText",
          text: JSON.stringify({ error: "invalide" }, null, 2),
        },
      ],
    });
  });
});
