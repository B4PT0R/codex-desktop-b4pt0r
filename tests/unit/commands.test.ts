import { describe, expect, it } from "vitest";
import {
  commandFromText,
  composerCommands,
  filteredComposerCommands,
} from "../../src/lib/commands";
import { fr } from "../../src/i18n/locales/fr";

const labelFor = (key: keyof typeof fr) => fr[key];

describe("composer commands", () => {
  it("retrouve une commande complète sans accepter les préfixes", () => {
    expect(commandFromText(" /status ")?.id).toBe("status");
    expect(commandFromText("/sta")).toBeUndefined();
  });

  it("expose uniquement des commandes réellement branchées", () => {
    expect(composerCommands.map((command) => command.id)).toEqual([
      "plan",
      "review",
      "new",
      "compact",
      "fork",
      "resume",
      "status",
      "usage",
      "personality",
      "skills",
      "mcp",
      "apps",
      "plugins",
      "hooks",
      "stop",
      "clear",
    ]);
  });

  it("filtre sur le nom et la description", () => {
    expect(
      filteredComposerCommands("rev", labelFor).map((command) => command.id),
    ).toEqual(["review"]);
    expect(
      filteredComposerCommands("session", labelFor).map(
        (command) => command.id,
      ),
    ).toEqual(["status"]);
  });
});
