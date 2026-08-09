import { describe, expect, it } from "vitest";
import { createAdultModeCredential, verifyAdultModeCredential } from "../../src/lib/adultModeCredential";

describe("Adult Mode credential", () => {
  it("stores a salted derivative and verifies only the registered password", async () => {
    const credential = await createAdultModeCredential("correct horse");
    expect(credential.hash).not.toContain("correct horse");
    expect(credential.salt).toBeTruthy();
    await expect(verifyAdultModeCredential("correct horse", credential)).resolves.toBe(true);
    await expect(verifyAdultModeCredential("wrong password", credential)).resolves.toBe(false);
  });
});
