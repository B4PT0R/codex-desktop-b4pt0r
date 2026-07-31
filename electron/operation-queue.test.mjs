import assert from "node:assert/strict";
import test from "node:test";
import { OperationQueue } from "./operation-queue.mjs";

test("serializes operations and continues after a rejection", async () => {
  const queue = new OperationQueue();
  const timeline = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const first = queue.run(async () => {
    timeline.push("first:start");
    await firstGate;
    timeline.push("first:end");
    throw new Error("expected failure");
  });
  const second = queue.run(async () => {
    timeline.push("second");
    return "done";
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(timeline, ["first:start"]);
  releaseFirst();
  await assert.rejects(first, /expected failure/);
  assert.equal(await second, "done");
  assert.deepEqual(timeline, ["first:start", "first:end", "second"]);
});
