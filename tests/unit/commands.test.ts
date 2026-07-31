import { describe, expect, it } from "vitest";
import {
  commandFromText,
  composerCommands,
  filteredComposerCommands,
} from "../../src/lib/commands";

describe("composer commands", () => {
  it("retrouve une commande complète sans accepter les préfixes", () => {
    expect(commandFromText(" /status ")?.id).toBe("status");
    expect(commandFromText("/sta")).toBeUndefined();
  });

  it("expose uniquement des commandes réellement branchées", () => {
    expect(composerCommands.map((command) => command.id)).toEqual([
      "model",
      "reasoning",
      "fast",
      "plan",
      "permissions",
      "approvals",
      "approve",
      "review",
      "init",
      "compact",
      "goal",
      "copy",
      "status",
      "ps",
      "stop",
      "clear",
    ]);
  });

  it("filtre sur le nom comme la CLI", () => {
    expect(
      filteredComposerCommands("rev").map((command) => command.id),
    ).toEqual(["review"]);
    expect(filteredComposerCommands("session")).toEqual([]);
  });
});
