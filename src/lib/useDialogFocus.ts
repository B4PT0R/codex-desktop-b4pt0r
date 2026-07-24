import { useEffect, useRef, type KeyboardEvent } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "select:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type DialogFocusOptions = {
  initialFocusSelector?: string;
  onEscape?: () => void;
};

/** Establishes modal focus, traps keyboard traversal, and restores the opener. */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>({
  initialFocusSelector,
  onEscape,
}: DialogFocusOptions = {}) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    const dialog = dialogRef.current;
    const initialFocus =
      (initialFocusSelector
        ? dialog?.querySelector<HTMLElement>(initialFocusSelector)
        : undefined) ?? firstFocusable(dialog);
    initialFocus?.focus();

    return () => previousFocus?.focus();
  }, [initialFocusSelector]);

  function onDialogKeyDown(event: KeyboardEvent<T>) {
    if (event.key === "Escape" && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { dialogRef, onDialogKeyDown };
}

function firstFocusable(container: HTMLElement | null) {
  return focusableElements(container)[0];
}

function focusableElements(container: HTMLElement | null) {
  return container
    ? [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) => element.getAttribute("aria-hidden") !== "true",
      )
    : [];
}
