import { describe, expect, it } from "vitest";
import {
  scheduledTaskFromPrompt,
  scheduledTaskPrompt,
} from "../../src/lib/scheduledTaskMessage";

describe("enveloppe des réveils planifiés", () => {
  it("conserve le nom et la consigne sans ambiguïté", () => {
    const encoded = scheduledTaskPrompt(
      'Veille "quotidienne"',
      "Inspecte le dépôt\nPuis résume.",
    );
    expect(encoded).toContain("[Codex Desktop Scheduler]");
    expect(scheduledTaskFromPrompt(encoded)).toEqual({
      name: 'Veille "quotidienne"',
      prompt: "Inspecte le dépôt\nPuis résume.",
    });
  });

  it("ne transforme pas un message utilisateur ordinaire", () => {
    expect(scheduledTaskFromPrompt("Inspecte le dépôt")).toBeUndefined();
  });
});
