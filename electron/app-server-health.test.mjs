import assert from "node:assert/strict";
import test from "node:test";
import { AppServerHealthMonitor } from "./app-server-health.mjs";

test("requires two failed probes before terminating App Server", async () => {
  const calls = [];
  const transport = {
    async probe(timeoutMs) {
      calls.push(timeoutMs);
      return "unresponsive";
    },
    terminateUnresponsive() {
      calls.push("terminate");
    },
  };
  const monitor = new AppServerHealthMonitor(transport, {
    probeTimeoutMs: 25,
    retryDelay: async () => undefined,
    retryDelayMs: 0,
  });

  assert.equal(await monitor.check(), "restarting");
  assert.deepEqual(calls, [25, 25, "terminate"]);
});

test("does not restart a responsive or not-yet-initialized server", async () => {
  const statuses = ["responsive", "unavailable"];
  let terminated = false;
  const monitor = new AppServerHealthMonitor({
    async probe() {
      return statuses.shift();
    },
    terminateUnresponsive() {
      terminated = true;
    },
  });

  assert.equal(await monitor.check(), "responsive");
  assert.equal(await monitor.check(), "unavailable");
  assert.equal(terminated, false);
});

test("does not terminate after the monitor stops during a retry", async () => {
  let releaseRetry;
  let terminated = false;
  const monitor = new AppServerHealthMonitor(
    {
      async probe() {
        return "unresponsive";
      },
      terminateUnresponsive() {
        terminated = true;
      },
    },
    {
      retryDelay: () =>
        new Promise((resolve) => {
          releaseRetry = resolve;
        }),
    },
  );

  const check = monitor.check();
  while (!releaseRetry) await new Promise((resolve) => setImmediate(resolve));
  monitor.stop();
  releaseRetry();

  assert.equal(await check, "stopped");
  assert.equal(terminated, false);
});
