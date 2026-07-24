import assert from "node:assert/strict";
import test from "node:test";
import {
  appServerCommand,
  initializeParams,
  REALTIME_MODEL,
  realtimeStartParams,
} from "./app-server-client.mjs";

test("respects the explicit Codex executable override", () => {
  assert.equal(
    appServerCommand({ CODEX_EXECUTABLE: "/opt/codex/bin/codex" }),
    "/opt/codex/bin/codex",
  );
  assert.equal(appServerCommand({}), "codex");
});

test("opts the probe into the experimental App Server API", () => {
  const params = initializeParams();
  assert.equal(params.capabilities.experimentalApi, true);
  assert.equal(params.clientInfo.name, "codex-desktop-linux-electron-probe");
});

test("constructs ChatGPT-authenticated Realtime v3 WebRTC parameters", () => {
  assert.deepEqual(realtimeStartParams("thread-1", "v=0", "juniper"), {
    threadId: "thread-1",
    model: REALTIME_MODEL,
    version: "v3",
    outputModality: "audio",
    transport: { type: "webrtc", sdp: "v=0" },
    includeStartupContext: false,
    flushTranscriptTailOnSessionEnd: true,
    codexResponseHandoffPrefix: "",
    codexResponseItemPrefix: null,
    codexResponsesAsItems: false,
    initialItems: [],
    realtimeSessionId: null,
    voice: "juniper",
  });
});
