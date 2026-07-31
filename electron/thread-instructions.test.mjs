import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readThreadInstructions } from "./thread-instructions.mjs";

test("renders developer and loaded instruction sources in effective order", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-instructions-"));
  t.after(() => rm(directory, { recursive: true }));
  const globalFile = path.join(directory, "global-AGENTS.md");
  const workspaceFile = path.join(directory, "workspace-AGENTS.md");
  await writeFile(globalFile, "Global instructions", "utf8");
  await writeFile(workspaceFile, "Workspace instructions", "utf8");

  const result = await readThreadInstructions(
    [globalFile, workspaceFile],
    "Developer instructions",
  );

  assert.equal(result.sourceCount, 2);
  assert.ok(
    result.content.indexOf("Developer instructions") <
      result.content.indexOf("Global instructions"),
  );
  assert.ok(
    result.content.indexOf("Global instructions") <
      result.content.indexOf("Workspace instructions"),
  );
  assert.match(result.content, /normal hierarchy/);
});

test("keeps developer instructions when no AGENTS source is available", async () => {
  const result = await readThreadInstructions([], "Developer instructions");

  assert.equal(result.sourceCount, 0);
  assert.match(result.content, /<developer_instructions>/);
  assert.match(result.content, /Developer instructions/);
});

test("rejects malformed developer instructions at the native boundary", async () => {
  await assert.rejects(
    readThreadInstructions([], { text: "not a string" }),
    /Invalid developer instructions/,
  );
});

test("skips unavailable sources and bounds the Realtime payload", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-instructions-"));
  t.after(() => rm(directory, { recursive: true }));
  const largeFile = path.join(directory, "AGENTS.md");
  await writeFile(largeFile, `begin\n${"é".repeat(40_000)}\nend`, "utf8");

  const result = await readThreadInstructions([
    path.join(directory, "missing.md"),
    largeFile,
  ]);

  assert.equal(result.sourceCount, 1);
  assert.ok(Buffer.byteLength(result.content, "utf8") <= 28_000);
  assert.match(result.content, /instructions truncated for Realtime/);
  assert.ok(!result.content.includes("�"));
});
