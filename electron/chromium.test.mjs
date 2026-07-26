import assert from "node:assert/strict";
import test from "node:test";
import {
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
  });
});

test("exposes the shared MCP server only through its loopback endpoint", () => {
  assert.equal(sharedBrowserEndpoint, "http://localhost:8931/mcp");
});
