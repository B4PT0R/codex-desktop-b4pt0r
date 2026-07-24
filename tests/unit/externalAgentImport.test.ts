import { describe, expect, it } from "vitest";
import {
  externalAgentDetailNames,
  externalAgentResultTotals,
  normalizeExternalAgentHistories,
  normalizeExternalAgentItems,
  normalizeExternalAgentResults,
} from "../../src/lib/externalAgentImport";

describe("normalisation des imports d’agents", () => {
  it("conserve les éléments valides et borne les détails", () => {
    const items = normalizeExternalAgentItems([
      {
        itemType: "SKILLS",
        description: "Skills Cursor",
        cwd: "/project",
        details: {
          skills: [{ name: "review" }, { name: 42 }],
          memory: ["règle locale"],
        },
        additiveField: true,
      },
      { itemType: "UNKNOWN", description: "ignore" },
      null,
    ]);

    expect(items).toEqual([
      {
        itemType: "SKILLS",
        description: "Skills Cursor",
        cwd: "/project",
        details: {
          plugins: [],
          skills: [{ name: "review" }],
          sessions: [],
          mcpServers: [],
          hooks: [],
          subagents: [],
          commands: [],
          memory: ["règle locale"],
        },
      },
    ]);
    expect(externalAgentDetailNames(items[0].details)).toEqual([
      "review",
      "règle locale",
    ]);
  });

  it("normalise les résultats et résume leurs totaux", () => {
    const results = normalizeExternalAgentResults([
      {
        itemType: "SESSIONS",
        successes: [{ itemType: "SESSIONS", target: "/target" }],
        failures: [
          {
            itemType: "SESSIONS",
            failureStage: "write",
            message: "accès refusé",
          },
        ],
      },
    ]);
    expect(externalAgentResultTotals(results)).toEqual({
      successes: 1,
      failures: 1,
    });
    expect(results[0].failures[0].message).toBe("accès refusé");
  });

  it("écarte les historiques incomplets", () => {
    expect(
      normalizeExternalAgentHistories([
        {
          importId: "import-1",
          completedAtMs: 123,
          successes: [],
          failures: [],
        },
        { importId: "missing-date" },
      ]),
    ).toHaveLength(1);
  });
});
