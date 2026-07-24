import { beforeEach, describe, expect, it, vi } from "vitest";

const openUrlMock = vi.hoisted(() => vi.fn());
const openChromiumMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock }));
vi.mock("../../src/lib/useChromium", () => ({
  openInChromium: openChromiumMock,
}));

import {
  openExternalTarget,
  safeExternalHttpUrl,
} from "../../src/lib/externalTarget";

beforeEach(() => {
  openUrlMock.mockReset().mockResolvedValue(undefined);
  openChromiumMock.mockReset().mockResolvedValue(undefined);
});

describe("ouverture externe", () => {
  it("accepte seulement les URL web bornées", () => {
    expect(safeExternalHttpUrl("https://example.com/login")).toBe(
      "https://example.com/login",
    );
    expect(safeExternalHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalHttpUrl(`https://example.com/${"a".repeat(33_000)}`))
      .toBeUndefined();
  });

  it("préfère Chromium puis utilise le navigateur système", async () => {
    expect(await openExternalTarget("https://example.com/a")).toBe("chromium");
    openChromiumMock.mockRejectedValueOnce(new Error("absent"));
    expect(await openExternalTarget("https://example.com/b")).toBe("system");
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/b");
  });
});
