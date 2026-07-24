// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { FileSearchMenu } from "../../src/components/FileSearchMenu";
import { I18nProvider } from "../../src/i18n/I18nProvider";

describe("palette de fichiers", () => {
  it("affiche un chemin relatif et sélectionne le résultat", () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider>
        <FileSearchMenu
          complete
          loading={false}
          menuRef={createRef()}
          onBack={vi.fn()}
          onMenuKeyDown={vi.fn()}
          onQueryChange={vi.fn()}
          onSelect={onSelect}
          query="app"
          results={[
            {
              root: "/work/project",
              path: "/work/project/src/App.tsx",
              fileName: "App.tsx",
            },
          ]}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("src/App.tsx")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowDown" });
    const result = screen.getByRole("menuitem", { name: /App\.tsx/ });
    expect(result).toHaveFocus();
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/work/project/src/App.tsx" }),
    );
  });
});
