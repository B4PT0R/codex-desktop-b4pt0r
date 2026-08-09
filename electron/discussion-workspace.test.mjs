import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createDiscussionWorkspace,
  discussionSlug,
} from "./discussion-workspace.mjs";

test("creates unique projectless discussion directories", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-discussion-"));
  try {
    const now = new Date(2026, 7, 9);
    const first = await createDiscussionWorkspace(root, "Échanger quelques idées", now);
    const second = await createDiscussionWorkspace(root, "Échanger quelques idées", now);
    assert.equal(first, path.join(root, "Codex", "2026-08-09-echanger-quelques-idees"));
    assert.equal(second, `${first}-2`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("bounds and sanitizes discussion slugs", () => {
  assert.equal(discussionSlug("  Démo / très nette !  "), "demo-tres-nette");
  assert.equal(discussionSlug("***"), "discussion");
  assert.ok(discussionSlug("x".repeat(100)).length <= 48);
});
