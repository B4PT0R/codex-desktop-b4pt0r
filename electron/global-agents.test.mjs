import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  globalAgentsPath,
  readGlobalAgents,
  writeGlobalAgents,
} from "./global-agents.mjs";

test("resolves the global AGENTS.md from Codex home", () => {
  assert.equal(
    globalAgentsPath("/home/test", {}),
    "/home/test/.codex/AGENTS.md",
  );
  assert.equal(
    globalAgentsPath("/home/test", { CODEX_HOME: "/tmp/codex-home" }),
    "/tmp/codex-home/AGENTS.md",
  );
});

test("creates and atomically updates the global AGENTS.md", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "global-agents-"));
  const file = globalAgentsPath(home, {});
  const initial = await readGlobalAgents(file);
  assert.equal(initial.exists, false);
  const saved = await writeGlobalAgents(
    file,
    "# Personal defaults\n",
    initial.version,
  );
  assert.equal(saved.exists, true);
  assert.equal(await readFile(file, "utf8"), "# Personal defaults\n");
});

test("reports an active override and rejects stale or symbolic writes", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "global-agents-"));
  const codexHome = path.join(home, ".codex");
  const file = globalAgentsPath(home, {});
  await writeGlobalAgents(
    file,
    "first\n",
    (await readGlobalAgents(file)).version,
  );
  await writeFile(path.join(codexHome, "AGENTS.override.md"), "override\n");
  const initial = await readGlobalAgents(file);
  assert.equal(initial.overrideActive, true);
  await writeFile(file, "external\n");
  await assert.rejects(
    writeGlobalAgents(file, "ours\n", initial.version),
    /changed outside/,
  );

  const linkedHome = await mkdtemp(path.join(os.tmpdir(), "global-agents-link-"));
  const linkedCodexHome = path.join(linkedHome, ".codex");
  await writeGlobalAgents(
    globalAgentsPath(linkedHome, {}),
    "temporary\n",
    (await readGlobalAgents(globalAgentsPath(linkedHome, {}))).version,
  );
  await writeFile(path.join(linkedCodexHome, "target.md"), "target\n");
  await unlink(globalAgentsPath(linkedHome, {}));
  await symlink(
    path.join(linkedCodexHome, "target.md"),
    globalAgentsPath(linkedHome, {}),
  );
  await assert.rejects(
    readGlobalAgents(globalAgentsPath(linkedHome, {})),
    /Symbolic global AGENTS.md/,
  );
});
