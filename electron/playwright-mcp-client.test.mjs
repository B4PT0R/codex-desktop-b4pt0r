import assert from "node:assert/strict";
import test from "node:test";
import { responseMessage } from "./playwright-mcp-client.mjs";

test("parses Playwright MCP JSON and event-stream responses", async () => {
  assert.deepEqual(
    await responseMessage(
      new Response('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}', {
        headers: { "content-type": "application/json" },
      }),
    ),
    { jsonrpc: "2.0", id: 1, result: { ok: true } },
  );
  assert.deepEqual(
    await responseMessage(
      new Response(
        'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      ),
    ),
    { jsonrpc: "2.0", id: 2, result: { ok: true } },
  );
});
