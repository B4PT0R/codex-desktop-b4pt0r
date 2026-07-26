import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  autostartPath,
  readLaunchAtLogin,
  setLaunchAtLogin,
} from "./autostart.mjs";

test("resolves the XDG autostart location", () => {
  assert.equal(
    autostartPath("/home/test", {}),
    "/home/test/.config/autostart/codex-desktop.desktop",
  );
  assert.equal(
    autostartPath("/home/test", { XDG_CONFIG_HOME: "/tmp/config" }),
    "/tmp/config/autostart/codex-desktop.desktop",
  );
});

test("creates a valid hidden XDG autostart entry and disables it", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-autostart-"));
  const file = path.join(directory, "autostart", "codex-desktop.desktop");
  const executable = "/opt/Codex Desktop/codex-desktop";

  assert.equal(await readLaunchAtLogin(file, executable), false);
  assert.equal(await setLaunchAtLogin(file, executable, true), true);
  assert.match(
    await readFile(file, "utf8"),
    /Exec="\/opt\/Codex Desktop\/codex-desktop" --hidden/,
  );
  assert.equal(await setLaunchAtLogin(file, executable, false), false);
});

test("replaces the retired Tauri entry when enabling autostart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-autostart-"));
  const autostartDirectory = path.join(directory, "autostart");
  const file = path.join(autostartDirectory, "codex-desktop.desktop");
  const legacyFile = path.join(autostartDirectory, "Codex Desktop.desktop");
  await mkdir(autostartDirectory);
  await writeFile(
    legacyFile,
    "[Desktop Entry]\nExec=/missing/codex-desktop-linux --hidden\n",
  );

  assert.equal(
    await setLaunchAtLogin(file, "/opt/Codex Desktop/codex-desktop", true),
    true,
  );
  await assert.rejects(readFile(legacyFile, "utf8"), { code: "ENOENT" });
});

test("does not trust a symlinked or foreign desktop entry", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-autostart-"));
  const target = path.join(directory, "target.desktop");
  const file = path.join(directory, "codex-desktop.desktop");
  await writeFile(
    target,
    "[Desktop Entry]\nX-Codex-Desktop-Autostart=true\nExec=\"/opt/Codex Desktop/codex-desktop\" --hidden\n",
  );
  await symlink(target, file);

  assert.equal(
    await readLaunchAtLogin(file, "/opt/Codex Desktop/codex-desktop"),
    false,
  );
});
