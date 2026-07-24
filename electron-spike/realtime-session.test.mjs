import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptsRealtimeEvent,
  applyActivationSignal,
  connectionStatus,
  createActivationState,
  isRealtimeActive,
} from "./realtime-session.mjs";

test("accepts early SDP events before start returns a thread id", () => {
  assert.equal(acceptsRealtimeEvent(undefined, "thread-1"), true);
  assert.equal(acceptsRealtimeEvent("thread-1", "thread-1"), true);
  assert.equal(acceptsRealtimeEvent("thread-1", "thread-2"), false);
});

test("makes disconnected and failed WebRTC states visible", () => {
  assert.equal(connectionStatus("disconnected").label, "Reconnexion…");
  assert.equal(connectionStatus("failed").kind, "error");
  assert.equal(connectionStatus("connected").kind, "active");
});

test("activates only after the official four-signal handshake", () => {
  let state = createActivationState();
  for (const signal of [
    "request-accepted",
    "thread-started",
    "webrtc-connected",
  ]) {
    state = applyActivationSignal(state, signal);
    assert.equal(isRealtimeActive(state), false);
  }
  state = applyActivationSignal(state, "session-initialized");
  assert.equal(isRealtimeActive(state), true);
});
