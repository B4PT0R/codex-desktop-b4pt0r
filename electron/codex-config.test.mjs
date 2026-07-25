import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  codexConfigPath,
  readCodexConfig,
  writeCodexConfig,
} from "./codex-config.mjs";

test("resolves only the Codex config path and honors an absolute CODEX_HOME", () => {
  assert.equal(
    codexConfigPath("/home/test", {}),
    "/home/test/.codex/config.toml",
  );
  assert.equal(
    codexConfigPath("/home/test", { CODEX_HOME: "/tmp/codex-home" }),
    "/tmp/codex-home/config.toml",
  );
  assert.equal(
    codexConfigPath("/home/test", { CODEX_HOME: "relative" }),
    "/home/test/.codex/config.toml",
  );
});

test("reads a missing config and atomically writes validated TOML", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-config-"));
  const file = path.join(directory, ".codex", "config.toml");
  const initial = await readCodexConfig(file);
  assert.equal(initial.content, "");
  const updated = await writeCodexConfig(
    file,
    'model = "gpt-5.4"\n[features]\napps = true\n',
    initial.version,
  );
  assert.equal(
    await readFile(file, "utf8"),
    'model = "gpt-5.4"\n[features]\napps = true\n',
  );
  assert.notEqual(updated.version, initial.version);
});

test("rejects invalid TOML and stale writes without changing the file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-config-"));
  const file = path.join(directory, "config.toml");
  await writeFile(file, 'model = "first"\n');
  const initial = await readCodexConfig(file);
  await assert.rejects(
    writeCodexConfig(file, "[broken", initial.version),
    /Invalid TOML/,
  );
  await writeFile(file, 'model = "external"\n');
  await assert.rejects(
    writeCodexConfig(file, 'model = "ours"\n', initial.version),
    /changed outside/,
  );
  assert.equal(await readFile(file, "utf8"), 'model = "external"\n');
});
