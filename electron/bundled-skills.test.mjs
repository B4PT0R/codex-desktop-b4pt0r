import assert from "node:assert/strict";
import test from "node:test";
import { bundledSkillsRoot } from "./bundled-skills.mjs";

test("resolves host skills outside the packaged ASAR", () => {
  assert.equal(
    bundledSkillsRoot({
      appRoot: "/workspace/codex-desktop",
      packaged: true,
      resourcesPath: "/opt/Codex Desktop/resources",
    }),
    "/opt/Codex Desktop/resources/skills",
  );
});

test("resolves host skills from the development checkout", () => {
  assert.equal(
    bundledSkillsRoot({
      appRoot: "/workspace/codex-desktop",
      packaged: false,
      resourcesPath: "/unused",
    }),
    "/workspace/codex-desktop/resources/skills",
  );
});
