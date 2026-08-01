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

test("builds native packages and a portable image for Linux", () => {
  assert.deepEqual(manifest.build.linux.target, ["deb", "rpm", "AppImage"]);
  assert.equal(
    manifest.scripts["electron:linux"],
    "npm run build && electron-builder --linux deb rpm AppImage",
  );
  assert.deepEqual(manifest.build.rpm.depends, [
    "gtk3",
    "libnotify",
    "nss",
    "libXScrnSaver",
    "libXtst",
    "xdg-utils",
    "at-spi2-core",
    "util-linux",
  ]);
  assert.deepEqual(manifest.build.deb.depends, [
    "libasound2",
    "libgtk-3-0",
    "libnotify4",
    "libnss3",
    "libxss1",
    "libxtst6",
    "pkexec",
    "xdg-utils",
  ]);
});

test("ships host skills outside the ASAR at the path used in production", async () => {
  assert.deepEqual(manifest.build.extraResources, [
    {
      from: "resources/skills",
      to: "skills",
      filter: ["**/*"],
    },
    {
      from: "packaging/apparmor/codex-desktop-linux",
      to: "apparmor/codex-desktop-linux",
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

test("ships an AppArmor profile attached to the packaged executable", async () => {
  const profileUrl = new URL(
    "../packaging/apparmor/codex-desktop-linux",
    import.meta.url,
  );
  const profile = await readFile(profileUrl, "utf8");
  const executable = `/opt/${manifest.productName}/${manifest.build.linux.executableName}`;
  assert.match(
    profile,
    new RegExp(
      `profile codex-desktop-linux "${executable}" flags=\\(unconfined\\)`,
    ),
  );
});
