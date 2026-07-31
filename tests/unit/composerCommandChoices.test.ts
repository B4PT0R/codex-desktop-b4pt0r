import { describe, expect, it } from "vitest";
import {
  approvalCommandChoices,
  modelCommandChoices,
  permissionCommandChoices,
  reasoningCommandChoices,
} from "../../src/components/composerCommandChoices";
import { fr } from "../../src/i18n/locales/fr";

const t = (key: keyof typeof fr) => fr[key];
const models = [
  {
    id: "gpt-a",
    label: "GPT A",
    supportedReasoningEfforts: [
      { reasoningEffort: "low", description: "Rapide" },
      { reasoningEffort: "high", description: "Approfondi" },
    ],
  },
];

describe("choix des commandes du composer", () => {
  it("sépare le modèle de l’effort de raisonnement", () => {
    expect(modelCommandChoices(models, "gpt-a")).toMatchObject([
      { id: "gpt-a", selected: true },
    ]);
    expect(reasoningCommandChoices(models, "gpt-a", "high", t)).toMatchObject([
      { id: "low", selected: false },
      { id: "high", selected: true },
    ]);
  });

  it("respecte les profils de permission gérés", () => {
    expect(
      permissionCommandChoices(
        [
          { id: ":workspace", name: "Workspace", allowed: true },
          { id: ":danger-full-access", name: "Full", allowed: false },
        ],
        ":workspace",
        t,
      ),
    ).toMatchObject([
      { id: ":workspace", selected: true, disabled: false },
      { id: ":danger-full-access", selected: false, disabled: true },
    ]);
  });

  it("désactive les politiques d’approbation interdites", () => {
    expect(approvalCommandChoices(["on-request"], "on-request", t)).toMatchObject([
      { id: "untrusted", disabled: true },
      { id: "on-request", disabled: false, selected: true },
      { id: "never", disabled: true },
    ]);
  });
});
