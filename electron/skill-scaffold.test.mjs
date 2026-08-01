import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSkillScaffold } from "./skill-scaffold.mjs";

test("creates a personal skill with valid frontmatter", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "codex-skill-home-"));
  const result = await createSkillScaffold(home, {
    name: "review-changes", description: "Review changes when asked.",
    instructions: "# Workflow\n\nInspect the diff.", scope: "user",
  });
  assert.equal(result.filePath, path.join(home, ".codex", "skills", "review-changes", "SKILL.md"));
  assert.match(await readFile(result.filePath, "utf8"), /description: "Review changes when asked\."/);
});

test("creates a workspace skill only below the selected workspace", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "codex-skill-home-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "codex-skill-workspace-"));
  const result = await createSkillScaffold(home, {
    name: "project-guide", description: "Guide project work.", instructions: "Follow AGENTS.md.",
    scope: "repo", workspace,
  });
  assert.equal(result.filePath, path.join(workspace, ".codex", "skills", "project-guide", "SKILL.md"));
});

test("rejects invalid names, duplicates, and symbolic targets", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "codex-skill-home-"));
  const input = { description: "Useful skill.", instructions: "Do the task.", scope: "user" };
  await assert.rejects(createSkillScaffold(home, { ...input, name: "../escape" }), /Skill name/);
  await createSkillScaffold(home, { ...input, name: "existing" });
  await assert.rejects(createSkillScaffold(home, { ...input, name: "existing" }), /already exists/);
  await symlink(os.tmpdir(), path.join(home, ".codex", "skills", "linked"));
  await assert.rejects(createSkillScaffold(home, { ...input, name: "linked" }), /Symbolic/);
});
