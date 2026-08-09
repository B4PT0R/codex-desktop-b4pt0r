import { beforeEach, describe, expect, it, vi } from "vitest";

const loadSettings = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/desktopSettings", () => ({
  readDesktopSettingsSnapshot: loadSettings,
}));

import { configuredDeveloperInstructions } from "../../src/lib/adultMode";

describe("Mode Adulte", () => {
  beforeEach(() => loadSettings.mockReset());

  it("reste absent par défaut", async () => {
    loadSettings.mockResolvedValue({ version: 1 });
    const instructions = await configuredDeveloperInstructions("Base");
    expect(instructions).toContain("Base");
    expect(instructions).not.toContain("# Adult Mode");
  });

  it("insère le prompt embarqué lorsqu'il est activé", async () => {
    loadSettings.mockResolvedValue({ version: 1, adultModeEnabled: true });
    const instructions = await configuredDeveloperInstructions("Base");
    expect(instructions).toContain("# Adult Mode");
    expect(instructions).toContain("## Adult Mode Status");
    expect(instructions).toContain("<codex_desktop_context>");
  });
});
