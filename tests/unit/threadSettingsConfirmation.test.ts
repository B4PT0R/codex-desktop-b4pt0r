import { describe, expect, it, vi } from "vitest";
import { ThreadSettingsConfirmation } from "../../src/lib/threadSettingsConfirmation";

describe("confirmation des réglages de thread", () => {
  it("attend l’accusé de réception et la notification effective", async () => {
    const confirmation = new ThreadSettingsConfirmation();
    let acknowledge: (() => void) | undefined;
    const update = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    let completed = false;
    const pending = confirmation
      .updateAndWait(
        "thread-1",
        { permission: ":workspace", approvalPolicy: "on-request" },
        update,
      )
      .then(() => {
        completed = true;
      });

    expect(
      confirmation.observe("thread-1", {
        permission: ":workspace",
        approvalPolicy: "on-request",
      }),
    ).toBe(true);
    await Promise.resolve();
    expect(completed).toBe(false);

    acknowledge?.();
    await pending;
    expect(completed).toBe(true);
  });

  it("ignore une notification qui ne confirme pas les valeurs attendues", async () => {
    const confirmation = new ThreadSettingsConfirmation();
    const pending = confirmation.updateAndWait(
      "thread-1",
      { permission: ":workspace", approvalPolicy: "on-request" },
      async () => undefined,
    );

    expect(
      confirmation.observe("thread-1", {
        permission: ":danger-full-access",
        approvalPolicy: "never",
      }),
    ).toBe(false);
    expect(
      confirmation.observe("thread-1", {
        permission: ":workspace",
        approvalPolicy: "on-request",
      }),
    ).toBe(true);
    await pending;
  });

  it("accepte une mise à jour sans changement après relecture de l’état effectif", async () => {
    const confirmation = new ThreadSettingsConfirmation();
    const verify = vi.fn(async () => ({
      permission: ":workspace" as const,
      approvalPolicy: "on-request" as const,
    }));

    await confirmation.updateAndWait(
      "thread-1",
      { permission: ":workspace", approvalPolicy: "on-request" },
      async () => undefined,
      verify,
    );

    expect(verify).toHaveBeenCalledOnce();
  });

  it("continue d’attendre si la relecture ne confirme pas la restauration", async () => {
    const confirmation = new ThreadSettingsConfirmation();
    let completed = false;
    const pending = confirmation
      .updateAndWait(
        "thread-1",
        { permission: ":workspace", approvalPolicy: "on-request" },
        async () => undefined,
        async () => ({
          permission: ":danger-full-access",
          approvalPolicy: "never",
        }),
      )
      .then(() => {
        completed = true;
      });

    await Promise.resolve();
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(
      confirmation.observe("thread-1", {
        permission: ":workspace",
        approvalPolicy: "on-request",
      }),
    ).toBe(true);
    await pending;
  });
});
