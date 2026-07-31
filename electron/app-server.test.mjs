import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  AppServerTransport,
  appServerArguments,
  environmentForCodex,
  findCodexExecutable,
} from "./app-server.mjs";

function fakeChild() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    child.killed = true;
  };
  return child;
}

test("disables unsupported native browser surfaces for this App Server", () => {
  assert.deepEqual(
    appServerArguments.filter((argument) => argument.startsWith("features.")),
    [
      "features.realtime_conversation=true",
      "features.browser_use=false",
      "features.browser_use_external=false",
      "features.in_app_browser=false",
      "features.computer_use=false",
    ],
  );
});

test("honors the explicit Codex executable override", async () => {
  assert.equal(
    await findCodexExecutable({
      CODEX_EXECUTABLE: "/opt/codex/bin/codex",
      PATH: "",
      HOME: "/missing",
    }),
    "/opt/codex/bin/codex",
  );
});

test("exposes the discovered Codex directory to App Server tools", () => {
  assert.deepEqual(
    environmentForCodex("/home/alice/.nvm/versions/node/v24/bin/codex", {
      HOME: "/home/alice",
      PATH: "/usr/local/bin:/usr/bin",
    }),
    {
      HOME: "/home/alice",
      PATH: "/home/alice/.nvm/versions/node/v24/bin:/usr/local/bin:/usr/bin",
    },
  );
});

test("does not duplicate an already exposed Codex directory", () => {
  assert.equal(
    environmentForCodex("/opt/codex/bin/codex", {
      PATH: "/usr/bin:/opt/codex/bin:/bin",
    }).PATH,
    "/opt/codex/bin:/usr/bin:/bin",
  );
});

test("preserves PATH lookup when Codex remains a bare command", () => {
  assert.deepEqual(environmentForCodex("codex", { PATH: "/usr/bin" }), {
    PATH: "/usr/bin",
  });
});

test("writes exactly one JSON object per renderer command", async () => {
  const child = fakeChild();
  const writes = [];
  child.stdin.on("data", (chunk) => writes.push(String(chunk)));
  const transport = new AppServerTransport(() => undefined, {
    resolveExecutable: async () => "/opt/codex/bin/codex",
    spawnProcess: () => child,
  });
  await transport.start();

  transport.send('{"id":"one","method":"thread/list"}');
  for (const invalid of [
    '{"method":"thread/list"}\n{"method":"turn/start"}',
    "null",
    "[]",
    "not-json",
  ]) {
    assert.throws(
      () => transport.send(invalid),
      /Invalid App Server message/,
    );
  }

  assert.deepEqual(writes, [
    '{"id":"one","method":"thread/list"}\n',
  ]);
  transport.stop();
});

test("shares one in-flight start without spawning an orphaned process", async () => {
  const child = fakeChild();
  let resolveExecutable;
  let spawnCount = 0;
  const executable = new Promise((resolve) => {
    resolveExecutable = resolve;
  });
  const transport = new AppServerTransport(() => undefined, {
    resolveExecutable: () => executable,
    spawnProcess: () => {
      spawnCount += 1;
      return child;
    },
  });

  const first = transport.start();
  const second = transport.start();
  resolveExecutable("/opt/codex/bin/codex");

  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(spawnCount, 1);
  transport.stop();
});

test("cancels a pending start before restart creates the replacement", async () => {
  const children = [fakeChild(), fakeChild()];
  const resolvers = [];
  let spawnCount = 0;
  const transport = new AppServerTransport(() => undefined, {
    resolveExecutable: () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      }),
    spawnProcess: () => children[spawnCount++],
  });

  const staleStart = transport.start();
  await new Promise((resolve) => setImmediate(resolve));
  const replacement = transport.restart();
  await new Promise((resolve) => setImmediate(resolve));
  resolvers[0]("/opt/codex/bin/codex");
  resolvers[1]("/opt/codex/bin/codex");

  assert.equal(await staleStart, false);
  assert.equal(await replacement, true);
  assert.equal(spawnCount, 1);
  transport.stop();
});

test("probes App Server through stdio without leaking the response to the renderer", async () => {
  const child = fakeChild();
  const events = [];
  const writes = [];
  child.stdin.on("data", (chunk) => writes.push(String(chunk)));
  const transport = new AppServerTransport(
    (event, payload) => events.push({ event, payload }),
    {
      resolveExecutable: async () => "/opt/codex/bin/codex",
      spawnProcess: () => child,
    },
  );

  await transport.start();
  transport.send(JSON.stringify({ method: "initialized", params: {} }));
  const probe = transport.probe(100);
  await new Promise((resolve) => setImmediate(resolve));
  const request = writes
    .flatMap((write) => write.trim().split("\n"))
    .map((line) => JSON.parse(line))
    .find((message) => String(message.id ?? "").startsWith("desktop-health:"));
  assert.equal(request.method, "thread/list");

  child.stdout.write(`${JSON.stringify({ id: request.id, result: { data: [] } })}\n`);
  assert.equal(await probe, "responsive");
  assert.deepEqual(events, []);
  transport.stop();
});

test("remembers only App Server-attested instruction sources for loaded threads", async () => {
  const child = fakeChild();
  const transport = new AppServerTransport(() => undefined, {
    resolveExecutable: async () => "/opt/codex/bin/codex",
    spawnProcess: () => child,
  });
  await transport.start();

  child.stdout.write(`${JSON.stringify({
    id: "fork",
    result: {
      thread: { id: "thread-1" },
      instructionSources: [
        "/home/alice/.codex/AGENTS.md",
        "/work/project/AGENTS.md",
      ],
    },
  })}\n`);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(transport.instructionSources("thread-1"), [
    "/home/alice/.codex/AGENTS.md",
    "/work/project/AGENTS.md",
  ]);
  assert.deepEqual(transport.instructionSources("unknown"), []);
  transport.stop();
  assert.deepEqual(transport.instructionSources("thread-1"), []);
});

test("reports a confirmed unresponsive transport once before terminating it", async () => {
  const child = fakeChild();
  const events = [];
  const transport = new AppServerTransport(
    (event, payload) => events.push({ event, payload }),
    {
      resolveExecutable: async () => "/opt/codex/bin/codex",
      spawnProcess: () => child,
    },
  );

  await transport.start();
  transport.send(JSON.stringify({ method: "initialized", params: {} }));
  assert.equal(await transport.probe(5), "unresponsive");
  assert.equal(transport.terminateUnresponsive(), true);
  assert.equal(child.killed, true);
  assert.deepEqual(events, [
    {
      event: "app-server-exited",
      payload: { code: null, message: null, reason: "unresponsive" },
    },
  ]);
  assert.equal(transport.terminateUnresponsive(), false);
});
