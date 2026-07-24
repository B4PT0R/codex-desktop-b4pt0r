import assert from "node:assert/strict";
import test from "node:test";
import {
  canCheckMicrophone,
  canRequestMicrophone,
  isTrustedProbeUrl,
} from "./media-policy.mjs";

test("trusts only the isolated app probe origin", () => {
  assert.equal(isTrustedProbeUrl("app://probe/index.html"), true);
  assert.equal(isTrustedProbeUrl("app://other/index.html"), false);
  assert.equal(isTrustedProbeUrl("https://probe/index.html"), false);
  assert.equal(isTrustedProbeUrl("invalid"), false);
});

test("allows only a main-frame audio permission check", () => {
  assert.equal(
    canCheckMicrophone({
      permission: "media",
      requestingOrigin: "app://probe",
      mediaType: "audio",
      isMainFrame: true,
    }),
    true,
  );
  assert.equal(
    canCheckMicrophone({
      permission: "media",
      requestingOrigin: "app://probe",
      mediaType: "video",
      isMainFrame: true,
    }),
    false,
  );
});

test("rejects camera, mixed-media and foreign permission requests", () => {
  const base = {
    permission: "media",
    pageUrl: "app://probe/index.html",
    requestingUrl: "app://probe/index.html",
  };
  assert.equal(canRequestMicrophone({ ...base, mediaTypes: ["audio"] }), true);
  assert.equal(canRequestMicrophone({ ...base, mediaTypes: ["video"] }), false);
  assert.equal(
    canRequestMicrophone({ ...base, mediaTypes: ["audio", "video"] }),
    false,
  );
  assert.equal(
    canRequestMicrophone({
      ...base,
      requestingUrl: "https://example.com",
      mediaTypes: ["audio"],
    }),
    false,
  );
});
