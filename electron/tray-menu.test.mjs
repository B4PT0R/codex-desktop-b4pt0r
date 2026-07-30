import assert from "node:assert/strict";
import test from "node:test";
import {
  pendingRealtimeState,
  realtimeToggleAction,
  rendererRealtimeState,
  trayMenuTemplate,
} from "./tray-menu.mjs";

function template(state) {
  return trayMenuTemplate({
    realtimeState: state,
    onNewChat() {},
    onOpen() {},
    onQuit() {},
    onToggleRealtime() {},
  });
}

test("keeps Realtime unavailable until the renderer is ready", () => {
  const realtime = template("unavailable")[2];
  assert.equal(realtime.label, "Realtime");
  assert.equal(realtime.type, "checkbox");
  assert.equal(realtime.enabled, false);
  assert.equal(realtime.checked, false);
});

test("presents deterministic start, active and stop states", () => {
  assert.deepEqual(
    ["idle", "starting", "active", "stopping"].map((state) => {
      const item = template(state)[2];
      return [state, item.enabled, item.checked];
    }),
    [
      ["idle", true, false],
      ["starting", false, true],
      ["active", true, true],
      ["stopping", false, true],
    ],
  );
  assert.equal(pendingRealtimeState("idle"), "starting");
  assert.equal(pendingRealtimeState("active"), "stopping");
  assert.equal(realtimeToggleAction("idle"), "start");
  assert.equal(realtimeToggleAction("active"), "stop");
});

test("validates renderer-owned states and recovers errors to idle", () => {
  assert.equal(rendererRealtimeState("active"), "active");
  assert.equal(rendererRealtimeState("error"), "idle");
  assert.throws(() => rendererRealtimeState("starting"), /Invalid/);
});
