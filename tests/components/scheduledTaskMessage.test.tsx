// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduledTaskMessage } from "../../src/components/ScheduledTaskMessage";
import { I18nProvider } from "../../src/i18n/I18nProvider";

vi.mock("../../src/lib/desktopSettings", () => ({
  loadDesktopSettings: vi.fn().mockResolvedValue({ locale: "en" }),
  updateDesktopSettings: vi.fn().mockResolvedValue({ locale: "en" }),
}));

describe("message de réveil planifié", () => {
  it("affiche clairement sa provenance et le nom de la tâche", async () => {
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
    expect(await screen.findByText("Inspecte les nouveautés.")).toBeVisible();
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });
});
