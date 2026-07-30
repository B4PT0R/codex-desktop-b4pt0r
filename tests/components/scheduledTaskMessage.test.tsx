// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduledTaskMessage } from "../../src/components/ScheduledTaskMessage";
import { I18nProvider } from "../../src/i18n/I18nProvider";

vi.mock("../../src/lib/desktopSettings", () => ({
  loadDesktopSettings: vi.fn().mockResolvedValue({ locale: "en" }),
  updateDesktopSettings: vi.fn().mockResolvedValue({ locale: "en" }),
}));

describe("message de réveil planifié", () => {
  it("affiche un résumé replié et permet de consulter la consigne", async () => {
    document.documentElement.lang = "fr";
    render(
      <I18nProvider>
        <ScheduledTaskMessage
          message={{
            id: "scheduled-1",
            role: "user",
            modality: "scheduledTask",
            title: "Veille quotidienne",
            content: "Inspecte les nouveautés.",
          }}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Scheduled wake-up")).toBeVisible();
    expect(screen.getByText("Veille quotidienne")).toBeVisible();
    const toggle = screen.getByRole("button", {
      name: /Scheduled wake-up Veille quotidienne/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inspecte les nouveautés.")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("Inspecte les nouveautés.")).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Inspecte les nouveautés.")).not.toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });
});
