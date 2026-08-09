import { describe, expect, it } from "vitest";
import {
  freeFormAnswer,
  userInputFromMessage,
  userInputResponse,
} from "../../src/lib/userInput";

describe("questions de Codex", () => {
  it("normalise les choix et le délai de résolution", () =>
    expect(
      userInputFromMessage({
        id: 42,
        method: "item/tool/requestUserInput",
        params: {
          autoResolutionMs: 60_000,
          isBlocking: false,
          questions: [
            {
              id: "scope",
              header: "Portée",
              question: "Que faut-il modifier ?",
              isOther: true,
              options: [
                { label: "Minimal", description: "Le strict nécessaire" },
              ],
            },
          ],
        },
      }),
    ).toEqual({
      requestId: 42,
      autoResolutionMs: 60_000,
      isBlocking: false,
      questions: [
        {
          id: "scope",
          header: "Portée",
          question: "Que faut-il modifier ?",
          isOther: true,
          isSecret: false,
          options: [{ label: "Minimal", description: "Le strict nécessaire" }],
        },
      ],
    }));

  it("ignore une requête ou des questions mal formées", () => {
    expect(
      userInputFromMessage({
        id: 1,
        method: "item/tool/requestUserInput",
        params: { questions: [{ id: "missing-copy" }] },
      }),
    ).toBeUndefined();
    expect(
      userInputFromMessage({ id: 1, method: "warning", params: {} }),
    ).toBeUndefined();
  });

  it("préfère l’indicateur bloquant 0.147 au délai historique", () => {
    expect(
      userInputFromMessage({
        id: 2,
        method: "item/tool/requestUserInput",
        params: {
          isBlocking: true,
          autoResolutionMs: 60_000,
          questions: [{
            id: "scope",
            header: "Portée",
            question: "Quelle portée ?",
            isOther: false,
            isSecret: false,
          }],
        },
      })?.isBlocking,
    ).toBe(true);
  });

  it("construit la réponse attendue par App Server", () => {
    expect(
      userInputResponse({
        scope: "Minimal",
        note: freeFormAnswer("  Inclure les tests  "),
      }),
    ).toEqual({
      answers: {
        scope: { answers: ["Minimal"] },
        note: { answers: ["user_note: Inclure les tests"] },
      },
    });
  });
});
