import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  isExpectedPlaywrightConfig,
  removePlaywrightCodexConfig,
} from "./playwright-codex-config.mjs";

test("recognizes only the enabled shared Playwright HTTP configuration", () => {
  const endpoint = "http://localhost:8931/mcp";
  assert.equal(
    isExpectedPlaywrightConfig(
      JSON.stringify({
        enabled: true,
        transport: { type: "streamable_http", url: endpoint },
      }),
      endpoint,
    ),
    true,
  );
  assert.equal(
    isExpectedPlaywrightConfig(
      JSON.stringify({
        enabled: true,
        transport: { type: "stdio", command: "npx" },
      }),
      endpoint,
    ),
    false,
  );
  assert.equal(isExpectedPlaywrightConfig("not JSON", endpoint), false);
});

test("removes only the Playwright MCP entry owned by the shared browser", async () => {
  const calls = [];
  const endpoint = "http://localhost:8931/mcp";
  const spawnProcess = (_executable, args) => {
    calls.push(args);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    process.nextTick(() => {
      if (args[1] === "get") {
        child.stdout.write(
          JSON.stringify({
            enabled: true,
            transport: { type: "streamable_http", url: endpoint },
          }),
        );
      }
      child.stdout.end();
      child.stderr.end();
      child.emit("exit", 0, null);
    });
    return child;
  };

  assert.equal(
    await removePlaywrightCodexConfig({
      endpoint,
      environment: { PATH: "/usr/bin", HOME: "/home/alice" },
      spawnProcess,
    }),
    true,
  );
  assert.deepEqual(calls[1], ["mcp", "remove", "playwright"]);
});
