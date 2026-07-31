import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { BrowserArtifactServer } from "./browser-artifacts.mjs";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("shares one artifact server startup across concurrent image pages", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-artifacts-"));
  const server = new BrowserArtifactServer(directory);
  t.after(async () => {
    await server.stop();
    await rm(directory, { recursive: true, force: true });
  });

  const urls = await Promise.all([
    server.pageForImage(tinyPng),
    server.pageForImage(tinyPng),
  ]);

  assert.equal(new URL(urls[0]).origin, new URL(urls[1]).origin);
  const responses = await Promise.all(urls.map((url) => fetch(url)));
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200],
  );
});
