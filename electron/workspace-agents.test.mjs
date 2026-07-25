import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readWorkspaceAgents,
  workspaceAgentsPath,
  writeWorkspaceAgents,
} from "./workspace-agents.mjs";

test("resolves only AGENTS.md in an absolute workspace", () => {
  assert.equal(workspaceAgentsPath("/work/project"), "/work/project/AGENTS.md");
  assert.throws(() => workspaceAgentsPath("../project"), /valid workspace/);
});

test("creates and atomically updates the workspace AGENTS.md", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "workspace-agents-"));
  const initial = await readWorkspaceAgents(workspace);
  assert.equal(initial.exists, false);
  const saved = await writeWorkspaceAgents(
    workspace,
    "# Project rules\n",
    initial.version,
  );
  assert.equal(saved.exists, true);
  assert.equal(
    await readFile(path.join(workspace, "AGENTS.md"), "utf8"),
    "# Project rules\n",
  );
});

test("rejects stale writes and symbolic AGENTS.md files", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "workspace-agents-"));
  const file = path.join(workspace, "AGENTS.md");
  await writeFile(file, "first\n");
  const initial = await readWorkspaceAgents(workspace);
  await writeFile(file, "external\n");
  await assert.rejects(
    writeWorkspaceAgents(workspace, "ours\n", initial.version),
    /changed outside/,
  );
  assert.equal(await readFile(file, "utf8"), "external\n");

  const linkedWorkspace = await mkdtemp(
    path.join(os.tmpdir(), "workspace-agents-link-"),
  );
  await symlink(file, path.join(linkedWorkspace, "AGENTS.md"));
  await assert.rejects(
    readWorkspaceAgents(linkedWorkspace),
    /Symbolic AGENTS.md/,
  );
});
