import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTranscriptEvent,
  createTranscriptState,
  renderTranscript,
} from "./transcript.mjs";

test("replaces streaming deltas with the finalized transcript", () => {
  let state = createTranscriptState();
  state = applyTranscriptEvent(state, "thread/realtime/transcript/delta", {
    role: "user",
    delta: "Est-ce que ",
  });
  state = applyTranscriptEvent(state, "thread/realtime/transcript/delta", {
    role: "user",
    delta: "tu m'entends ?",
  });
  assert.equal(renderTranscript(state), "Vous : Est-ce que tu m'entends ?");

  state = applyTranscriptEvent(state, "thread/realtime/transcript/done", {
    role: "user",
    text: "Est-ce que tu m'entends ?",
  });
  assert.equal(renderTranscript(state), "Vous : Est-ce que tu m'entends ?");
});

test("keeps simultaneous user and assistant deltas separated", () => {
  let state = createTranscriptState();
  state = applyTranscriptEvent(state, "thread/realtime/transcript/delta", {
    role: "user",
    delta: "Bonjour",
  });
  state = applyTranscriptEvent(state, "thread/realtime/transcript/delta", {
    role: "assistant",
    delta: "Salut",
  });
  assert.equal(renderTranscript(state), "Vous : Bonjour\n\nCodex : Salut");
});

test("does not duplicate repeated completion notifications", () => {
  let state = createTranscriptState();
  const event = {
    role: "assistant",
    text: "Très bien.",
  };
  state = applyTranscriptEvent(
    state,
    "thread/realtime/transcript/done",
    event,
  );
  state = applyTranscriptEvent(
    state,
    "thread/realtime/transcript/done",
    event,
  );
  assert.equal(state.history.length, 1);
});
