import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import {
  openMcpEventStream,
  PlaywrightMcpClient,
  responseMessage,
} from "./playwright-mcp-client.mjs";

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

test("reconnects once when Playwright expires the app-owned MCP session", async () => {
  const calls = [];
  const responses = [
    jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }, "session-1"),
    new Response(null, { status: 202 }),
    new Response("Session not found", { status: 404 }),
    jsonResponse({ jsonrpc: "2.0", id: 3, result: {} }, "session-2"),
    new Response(null, { status: 202 }),
    jsonResponse({
      jsonrpc: "2.0",
      id: 5,
      result: { content: [{ type: "text", text: "opened" }] },
    }),
  ];
  const timeline = [];
  const eventSessions = [];
  const client = new PlaywrightMcpClient(
    "http://localhost:8931/mcp",
    "test",
    async (_url, options) => {
      calls.push({
        message: options.body ? JSON.parse(options.body) : undefined,
        method: options.method,
        sessionId: options.headers["mcp-session-id"],
      });
      timeline.push(options.body ? JSON.parse(options.body).method : options.method);
      return responses.shift();
    },
    async (_url, sessionId) => {
      eventSessions.push(sessionId);
      timeline.push("GET");
      return { close() {} };
    },
  );

  await client.connect();
  const result = await client.callTool({
    name: "browser_navigate",
    arguments: { url: "https://example.com/" },
  });

  assert.equal(result.content[0].text, "opened");
  assert.equal(calls[0].message.params.clientInfo.version, "test");
  assert.equal(calls[3].message.params.clientInfo.version, "test");
  assert.deepEqual(
    timeline,
    [
      "initialize",
      "GET",
      "notifications/initialized",
      "tools/call",
      "initialize",
      "GET",
      "notifications/initialized",
      "tools/call",
    ],
  );
  assert.deepEqual(
    calls.map((call) => call.sessionId),
    [
      undefined,
      "session-1",
      "session-1",
      undefined,
      "session-2",
      "session-2",
    ],
  );
  assert.deepEqual(eventSessions, ["session-1", "session-2"]);
});

test("answers Playwright MCP heartbeat requests from the event stream", async () => {
  const calls = [];
  let receiveEvent;
  const responses = [
    jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }, "session-1"),
    new Response(null, { status: 202 }),
    new Response(null, { status: 202 }),
  ];
  const client = new PlaywrightMcpClient(
    "http://localhost:8931/mcp",
    "test",
    async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return responses.shift();
    },
    async (_url, _sessionId, onMessage) => {
      receiveEvent = onMessage;
      return { close() {} };
    },
  );

  await client.connect();
  await receiveEvent({ jsonrpc: "2.0", id: 42, method: "ping" });

  assert.deepEqual(calls.at(-1), {
    jsonrpc: "2.0",
    id: 42,
    result: {},
  });
});

test("keeps the MCP event stream open until the client closes it", async (t) => {
  let responseClosed = false;
  let resolveResponseClosed;
  const responseClose = new Promise((resolve) => {
    resolveResponseClosed = resolve;
  });
  const server = createServer((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.headers.accept, "text/event-stream");
    assert.equal(request.headers["mcp-session-id"], "session-1");
    response.writeHead(200, {
      "content-type": "text/event-stream",
      connection: "keep-alive",
    });
    response.flushHeaders();
    response.once("close", () => {
      responseClosed = true;
      resolveResponseClosed();
    });
  });
  t.after(() => server.close());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  const stream = await openMcpEventStream(
    `http://127.0.0.1:${address.port}/mcp`,
    "session-1",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(responseClosed, false);

  stream.close();
  await responseClose;
  assert.equal(responseClosed, true);
});

function jsonResponse(body, sessionId) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
  });
}
