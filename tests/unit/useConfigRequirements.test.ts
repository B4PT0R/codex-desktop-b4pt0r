import { describe, expect, it } from "vitest";
import { normalizeConfigRequirements } from "../../src/lib/useConfigRequirements";

describe("contraintes administrées", () => {
  it("normalise uniquement les contraintes utiles aux contrôles actuels", () => {
    expect(
      normalizeConfigRequirements({
        requirements: {
          allowManagedHooksOnly: true,
          allowRemoteControl: false,
          defaultPermissions: ":workspace",
          allowedPermissionProfiles: {
            ":workspace": true,
            ":danger-full-access": false,
            malformed: "no",
          },
          allowedApprovalPolicies: ["on-request", "never", { granular: {} }],
          allowedApprovalsReviewers: [
            "user",
            "guardian_subagent",
            "invalid",
          ],
          allowedWebSearchModes: ["cached", "disabled", "invalid"],
        },
      }),
    ).toEqual({
      managed: true,
      managedHooksOnly: true,
      allowRemoteControl: false,
      defaultPermission: ":workspace",
      allowedPermissionProfiles: {
        ":workspace": true,
        ":danger-full-access": false,
      },
      allowedApprovalPolicies: ["on-request", "never"],
      allowedApprovalsReviewers: ["user", "auto_review"],
      allowedWebSearchModes: ["cached", "disabled"],
    });
  });

  it("représente explicitement l’absence de politique", () => {
    expect(normalizeConfigRequirements({ requirements: null })).toEqual({
      managed: false,
      managedHooksOnly: false,
    });
  });
});
