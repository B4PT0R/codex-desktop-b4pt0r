import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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
  await writeFile(
    file,
    JSON.stringify({ version: 1, futureField: { enabled: true } }),
  );
  await updateSettings(file, { locale: "fr" });
  const updated = await updateSettings(file, { theme: "dark" });
  assert.deepEqual(updated.futureField, { enabled: true });
  assert.equal(updated.locale, "fr");
  assert.equal(updated.theme, "dark");
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), updated);
  assert.deepEqual(await readSettings(file), updated);
});

test("does not rewrite preferences when a repeated patch changes nothing", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      locale: "fr",
      theme: "dark",
      futureField: { enabled: true },
    }),
  );
  const before = await stat(file);
  const content = await readFile(file, "utf8");

  const unchanged = await updateSettings(file, {
    locale: "fr",
    theme: "dark",
  });

  assert.equal((await stat(file)).ino, before.ino);
  assert.equal(await readFile(file, "utf8"), content);
  assert.deepEqual(unchanged.futureField, { enabled: true });
});

test("rejects renderer-created settings keys while preserving future fields", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");

  await assert.rejects(
    updateSettings(file, { futureField: { enabled: true } }),
    /Unsupported desktop settings key/,
  );
});

test("rejects malformed values even when they are falsy", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  const malformed = [
    { locale: "" },
    { theme: "" },
    { fontSize: null },
    { lastWorkspace: {} },
    { realtimeVoice: 0 },
    { sharedBrowserEnabled: null },
  ];

  for (const patch of malformed) {
    await assert.rejects(updateSettings(file, patch), /Unsupported|too long/);
  }
  assert.deepEqual(await readSettings(file), { version: SETTINGS_VERSION });
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

test("validates the persisted interface scale", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  const updated = await updateSettings(file, { interfaceScale: 1.24 });
  assert.equal(updated.interfaceScale, 1.24);
  await assert.rejects(
    updateSettings(file, { interfaceScale: 2 }),
    /Unsupported interface scale/,
  );
});

test("validates the persisted visible actions limit", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  const updated = await updateSettings(file, {
    maxVisibleActionsPerGroup: 4,
  });
  assert.equal(updated.maxVisibleActionsPerGroup, 4);
  await assert.rejects(
    updateSettings(file, { maxVisibleActionsPerGroup: 7 }),
    /Unsupported visible actions limit/,
  );
});

test("validates persisted chat presentation preferences", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  const updated = await updateSettings(file, {
    keepActionGroupsCollapsed: true,
    showReasoningItems: false,
  });
  assert.equal(updated.keepActionGroupsCollapsed, true);
  assert.equal(updated.showReasoningItems, false);
  await assert.rejects(
    updateSettings(file, { showReasoningItems: "no" }),
    /Unsupported chat presentation preference/,
  );
});

test("validates the persisted shared browser state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  const updated = await updateSettings(file, { sharedBrowserEnabled: true });
  assert.equal(updated.sharedBrowserEnabled, true);
  await assert.rejects(
    updateSettings(file, { sharedBrowserEnabled: "yes" }),
    /Unsupported shared browser setting/,
  );
});

test("validates and clears the default thread", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-settings-"));
  const file = path.join(directory, "settings.json");
  const updated = await updateSettings(file, {
    defaultThreadId: "thread-default",
  });
  assert.equal(updated.defaultThreadId, "thread-default");
  const cleared = await updateSettings(file, {
    defaultThreadId: undefined,
  });
  assert.equal("defaultThreadId" in (await readSettings(file)), false);
  assert.equal(cleared.defaultThreadId, undefined);
  await assert.rejects(
    updateSettings(file, { defaultThreadId: "" }),
    /Unsupported default thread/,
  );
});
