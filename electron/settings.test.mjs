import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readSettings,
  SETTINGS_VERSION,
  settingsPath,
  updateSettings,
} from "./settings.mjs";

test("uses the existing Codex desktop settings location", () => {
  assert.equal(
    settingsPath("/home/test"),
    "/home/test/.codex/codex-desktop-linux.json",
  );
});

test("atomically updates known preferences and preserves unknown fields", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  await updateSettings(file, { locale: "fr", futureField: { enabled: true } });
  const updated = await updateSettings(file, { theme: "dark" });
  assert.deepEqual(updated.futureField, { enabled: true });
  assert.equal(updated.locale, "fr");
  assert.equal(updated.theme, "dark");
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), updated);
  assert.deepEqual(await readSettings(file), updated);
});

test("serializes concurrent patches without losing either preference", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");

  await Promise.all([
    updateSettings(file, { locale: "fr" }),
    updateSettings(file, { theme: "light" }),
    updateSettings(file, { sidebarWidth: 300 }),
  ]);

  assert.deepEqual(await readSettings(file), {
    locale: "fr",
    sidebarWidth: 300,
    theme: "light",
    version: SETTINGS_VERSION,
  });
});

test("validates the persisted sidebar width", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  const updated = await updateSettings(file, { sidebarWidth: 320 });
  assert.equal(updated.sidebarWidth, 320);
  await assert.rejects(
    updateSettings(file, { sidebarWidth: 600 }),
    /Unsupported sidebar width/,
  );
});
