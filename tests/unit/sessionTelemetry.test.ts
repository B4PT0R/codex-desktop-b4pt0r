import { describe, expect, it } from "vitest";
import {
  compactTokenCount,
  contextUsageFromValue,
  modelRerouteFromValue,
  rerouteReason,
} from "../../src/lib/sessionTelemetry";

describe("télémétrie de session", () => {
  it("calcule la fenêtre depuis le dernier appel et conserve le cumul", () => {
    expect(
      contextUsageFromValue({
        total: { totalTokens: 150_000 },
        last: { totalTokens: 96_000, outputTokens: 2_500 },
        modelContextWindow: 128_000,
      }),
    ).toEqual({
      usedTokens: 96_000,
      windowTokens: 128_000,
      percentUsed: 75,
      totalTokens: 150_000,
      lastOutputTokens: 2_500,
    });
  });

  it("ignore un événement incomplet ou invalide", () => {
    expect(
      contextUsageFromValue({ last: { totalTokens: 10 } }),
    ).toBeUndefined();
    expect(
      contextUsageFromValue({
        total: { totalTokens: 10 },
        last: { totalTokens: -1 },
        modelContextWindow: 100,
      }),
    ).toBeUndefined();
    expect(modelRerouteFromValue({ toModel: "gpt-5" })).toBeUndefined();
  });

  it("normalise le reroutage et les libellés", () => {
    expect(
      modelRerouteFromValue({
        fromModel: "gpt-a",
        toModel: "gpt-b",
        reason: "highRiskCyberActivity",
      }),
    ).toEqual({
      fromModel: "gpt-a",
      toModel: "gpt-b",
      reason: "highRiskCyberActivity",
    });
    expect(rerouteReason("highRiskCyberActivity")).toBe(
      "Vérification de sécurité renforcée",
    );
    expect(compactTokenCount(128_000)).toBe("128 k");
    expect(compactTokenCount(1_250)).toBe("1,3 k");
  });
});
