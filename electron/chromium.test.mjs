import assert from "node:assert/strict";
import test from "node:test";
import {
  focusSharedBrowser,
  isOwnedSharedBrowserProcess,
  playwrightCurrentTabIndex,
  SharedBrowserManager,
  sharedBrowserEndpoint,
  sharedBrowserMcpConfig,
  sharedBrowserPaths,
  sharedBrowserServerArguments,
  stopBrowserServer,
} from "./chromium.mjs";
import { EventEmitter } from "node:events";

test("focuses the existing shared browser tab without navigating it", async () => {
  const calls = [];
  await focusSharedBrowser({
    callTool(request) {
      calls.push(request);
      return request.arguments.action === "list"
        ? {
            content: [
              {
                type: "text",
                text: "- 0: [Docs](https://docs.google.com/)\n- 1: (current) [Drive](https://drive.google.com/)",
              },
            ],
          }
        : { content: [] };
    },
  });

  assert.deepEqual(calls, [
    {
      name: "browser_tabs",
      arguments: { action: "list" },
    },
    {
      name: "browser_tabs",
      arguments: { action: "select", index: 1 },
    },
  ]);
  await assert.rejects(
    focusSharedBrowser({
      callTool() {
        return {
          isError: true,
          content: [{ type: "text", text: "Unable to focus Chromium" }],
        };
      },
    }),
    /Unable to focus Chromium/,
  );
  assert.equal(
    playwrightCurrentTabIndex({
      content: [{ type: "text", text: "- 3: (current) [Tab](about:blank)" }],
    }),
    3,
  );
  assert.equal(playwrightCurrentTabIndex({ content: [] }), undefined);
});

test("requires release metadata for the app-owned MCP client", () => {
  assert.throws(
    () =>
      new SharedBrowserManager({
        clientVersion: "",
        home: "/home/alice",
        root: "/app",
      }),
    /client version is required/,
  );
});

test("keeps the Playwright browser and profile in app-owned user data", () => {
  assert.deepEqual(sharedBrowserPaths("/home/alice"), {
    root: "/home/alice/.local/share/codex-desktop",
    browsers: "/home/alice/.local/share/codex-desktop/browsers",
    profile: "/home/alice/.local/share/codex-desktop/browser-profile",
    output: "/home/alice/.local/share/codex-desktop/browser-output",
    artifacts: "/home/alice/.local/share/codex-desktop/browser-artifacts",
    config: "/home/alice/.local/share/codex-desktop/playwright-mcp.json",
    serverPid:
      "/home/alice/.local/share/codex-desktop/playwright-mcp.pid",
  });
});

test("starts managed Chromium with crash-bubble recovery isolated to its profile", () => {
  const paths = sharedBrowserPaths("/home/alice");
  assert.deepEqual(sharedBrowserMcpConfig(), {
    browser: {
      launchOptions: { args: ["--hide-crash-restore-bubble"] },
    },
  });
  assert.deepEqual(
    sharedBrowserServerArguments("/app/mcp.js", "/app/chromium", paths),
    [
      "/app/mcp.js",
      "--config",
      paths.config,
      "--host",
      "127.0.0.1",
      "--port",
      "8931",
      "--shared-browser-context",
      "--user-data-dir",
      paths.profile,
      "--output-dir",
      paths.output,
      "--console-level",
      "warning",
      "--executable-path",
      "/app/chromium",
    ],
  );
});

test("waits for managed Chromium to exit after a graceful stop request", async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.kill = (signal) => {
    assert.equal(signal, "SIGTERM");
    queueMicrotask(() => {
      child.exitCode = 0;
      child.emit("exit", 0, null);
    });
    return true;
  };

  await stopBrowserServer(child, 50);
  assert.equal(child.exitCode, 0);
});

test("escalates a managed Chromium server that ignores graceful stop", async () => {
  const signals = [];
  const child = new EventEmitter();
  child.exitCode = null;
  child.kill = (signal) => {
    signals.push(signal);
    if (signal === "SIGKILL") {
      queueMicrotask(() => child.emit("exit", null, "SIGKILL"));
    }
    return true;
  };

  await stopBrowserServer(child, 1);
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
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
