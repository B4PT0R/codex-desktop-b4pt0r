import assert from "node:assert/strict";
import test from "node:test";
import {
  isOwnedSharedBrowserProcess,
  sharedBrowserEndpoint,
  sharedBrowserPaths,
} from "./chromium.mjs";

test("keeps the Playwright browser and profile in app-owned user data", () => {
  assert.deepEqual(sharedBrowserPaths("/home/alice"), {
    root: "/home/alice/.local/share/codex-desktop",
    browsers: "/home/alice/.local/share/codex-desktop/browsers",
    profile: "/home/alice/.local/share/codex-desktop/browser-profile",
    output: "/home/alice/.local/share/codex-desktop/browser-output",
    artifacts: "/home/alice/.local/share/codex-desktop/browser-artifacts",
    serverPid:
      "/home/alice/.local/share/codex-desktop/playwright-mcp.pid",
  });
});

test("exposes the shared MCP server only through its loopback endpoint", () => {
  assert.equal(sharedBrowserEndpoint, "http://localhost:8931/mcp");
});

test("recognizes only an app-owned stale Playwright MCP process", () => {
  const profile = "/home/alice/.local/share/codex-desktop/browser-profile";
  const argv = [
    "/opt/Codex Desktop/codex-desktop",
    "/opt/Codex Desktop/resources/app.asar/node_modules/@playwright/mcp/cli.js",
    "--port",
    "8931",
    "--user-data-dir",
    profile,
  ];
  assert.equal(isOwnedSharedBrowserProcess(argv, 1000, profile, 1000), true);
  assert.equal(isOwnedSharedBrowserProcess(argv, 1001, profile, 1000), false);
  assert.equal(
    isOwnedSharedBrowserProcess(
      argv.with(argv.indexOf("8931"), "9999"),
      1000,
      profile,
      1000,
    ),
    false,
  );
  assert.equal(
    isOwnedSharedBrowserProcess(
      argv.with(argv.indexOf(profile), "/tmp/foreign-profile"),
      1000,
      profile,
      1000,
    ),
    false,
  );
});
