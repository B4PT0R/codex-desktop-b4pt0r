// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SchedulerToolConfirmationDialog } from "../../src/components/SchedulerToolConfirmationDialog";
import { I18nProvider } from "../../src/i18n/I18nProvider";

vi.mock("../../src/lib/desktopSettings", () => ({
  loadDesktopSettings: vi.fn().mockResolvedValue({ locale: "en" }),
  updateDesktopSettings: vi.fn().mockResolvedValue({ locale: "en" }),
}));

describe("confirmation d’un outil scheduler", () => {
  it("nomme la tâche et ne confirme pas à la place de l’utilisateur", async () => {
    document.documentElement.lang = "fr";
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <I18nProvider>
        <SchedulerToolConfirmationDialog
          confirmation={{
            requestId: "delete-1",
            task: {
              id: "task-1",
              name: "Veille hebdomadaire",
              prompt: "Inspecte les nouveautés",
              enabled: true,
              schedule: { type: "weekly", time: "09:00", days: [1] },
              target: { type: "newThread" },
            },
          }}
          submitting={false}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole("alertdialog").textContent).toContain(
      "Veille hebdomadaire",
    );
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });
});
