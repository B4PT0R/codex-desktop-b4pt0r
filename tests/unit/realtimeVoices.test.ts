import { describe, expect, it } from "vitest";
import {
  fallbackRealtimeVoices,
  normalizeRealtimeVoices,
  realtimeVoiceLabel,
} from "../../src/lib/realtimeVoices";

describe("catalogue vocal Realtime", () => {
  it("borne, déduplique et filtre l’inventaire App Server", () => {
    expect(
      normalizeRealtimeVoices({
        v1: ["maple", "unknown", "maple", "juniper"],
        v2: ["marin"],
        defaultV1: "maple",
        defaultV2: "marin",
      }),
    ).toEqual({
      v1: ["maple", "juniper"],
      v2: ["marin"],
      defaultV1: "maple",
      defaultV2: "marin",
    });
  });

  it("conserve un catalogue v3 utilisable face à une réponse malformée", () => {
    expect(normalizeRealtimeVoices(null)).toEqual(fallbackRealtimeVoices);
    expect(realtimeVoiceLabel("juniper")).toBe("Juniper");
  });
});
