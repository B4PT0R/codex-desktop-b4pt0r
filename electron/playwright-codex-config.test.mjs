import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedPlaywrightConfig } from "./playwright-codex-config.mjs";

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
