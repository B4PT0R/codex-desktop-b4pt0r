import { describe, expect, it } from "vitest";
import { ThreadNavigationGuard } from "../../src/lib/threadNavigationGuard";

describe("ThreadNavigationGuard", () => {
  it("allows the current creation to activate its thread", () => {
    const guard = new ThreadNavigationGuard();

    expect(guard.shouldActivate(guard.beginCreation())).toBe(true);
  });

  it("rejects a creation after the user navigates elsewhere", () => {
    const guard = new ThreadNavigationGuard();
    const creation = guard.beginCreation();

    guard.navigate();

    expect(guard.shouldActivate(creation)).toBe(false);
  });

  it("lets only the latest concurrent creation activate", () => {
    const guard = new ThreadNavigationGuard();
    const first = guard.beginCreation();
    const second = guard.beginCreation();

    expect(guard.shouldActivate(first)).toBe(false);
    expect(guard.shouldActivate(second)).toBe(true);
  });
});
