import { describe, expect, it } from "vitest";
import { quotaWindowLabel } from "../../src/lib/quotaPresentation";

describe("présentation des fenêtres de quota", () => {
  it("affiche les fenêtres courtes en heures", () => {
    expect(quotaWindowLabel(300, 0)).toBe("5 h");
  });

  it("affiche les fenêtres longues en jours", () => {
    expect(quotaWindowLabel(10_080, 1)).toBe("7 j");
  });

  it("conserve les libellés historiques si la durée manque", () => {
    expect(quotaWindowLabel(null, 0)).toBe("5 h");
    expect(quotaWindowLabel(null, 1)).toBe("7 j");
  });
});
