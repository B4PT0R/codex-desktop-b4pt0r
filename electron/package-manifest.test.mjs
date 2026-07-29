import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("ships the renderer and native runtime without native test sources", async () => {
  assert.deepEqual(manifest.build.files, [
    "dist/index.html",
    "dist/favicon.svg",
    "dist/assets/**/*",
    "electron/**/*",
    "!electron/**/*.test.mjs",
    "package.json",
  ]);
  assert.equal(manifest.main, "electron/main.mjs");
  await Promise.all([
    access(new URL(`../${manifest.main}`, import.meta.url)),
    access(new URL("./preload.cjs", import.meta.url)),
    access(new URL("../public/favicon.svg", import.meta.url)),
  ]);
});

test("ships host skills outside the ASAR at the path used in production", async () => {
  assert.deepEqual(manifest.build.extraResources, [
    {
      from: "resources/skills",
      to: "skills",
      filter: ["**/*"],
    },
  ]);
  await Promise.all([
    access(
      new URL(
        "../resources/skills/use-shared-browser/SKILL.md",
        import.meta.url,
      ),
    ),
    access(
      new URL(
        "../resources/skills/use-shared-browser/agents/openai.yaml",
        import.meta.url,
      ),
    ),
  ]);
});
