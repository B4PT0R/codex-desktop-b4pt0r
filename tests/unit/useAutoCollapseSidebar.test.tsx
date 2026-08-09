// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutoCollapseSidebar } from "../../src/lib/useAutoCollapseSidebar";

afterEach(cleanup);

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

describe("useAutoCollapseSidebar", () => {
  it("replie la sidebar sous trois fois sa largeur", () => {
    setViewportWidth(779);
    const collapse = vi.fn();

    renderHook(() => useAutoCollapseSidebar(260, true, collapse));

    expect(collapse).toHaveBeenCalledWith(false);
  });

  it("laisse la sidebar ouverte à la limite et la replie après un resize étroit", () => {
    setViewportWidth(780);
    const collapse = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useAutoCollapseSidebar(260, open, collapse),
      { initialProps: { open: true } },
    );

    expect(collapse).not.toHaveBeenCalled();
    setViewportWidth(700);
    window.dispatchEvent(new Event("resize"));

    expect(collapse).toHaveBeenCalledWith(false);
    rerender({ open: false });
    setViewportWidth(900);
    window.dispatchEvent(new Event("resize"));

    expect(collapse).toHaveBeenLastCalledWith(true);
  });

  it("ne rouvre pas une sidebar qui était déjà fermée", () => {
    setViewportWidth(700);
    const setOpen = vi.fn();
    renderHook(() => useAutoCollapseSidebar(260, false, setOpen));

    setViewportWidth(900);
    window.dispatchEvent(new Event("resize"));

    expect(setOpen).not.toHaveBeenCalled();
  });
});
