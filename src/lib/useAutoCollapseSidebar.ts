import { useEffect, useRef } from "react";

const SIDEBAR_VIEWPORT_RATIO = 3;

export function useAutoCollapseSidebar(
  sidebarWidth: number,
  open: boolean,
  setOpen: (open: boolean) => void,
) {
  const wasNarrow = useRef<boolean | undefined>(undefined);
  const restoreOpen = useRef(false);

  useEffect(() => {
    const adaptToViewport = () => {
      const narrow = window.innerWidth < sidebarWidth * SIDEBAR_VIEWPORT_RATIO;
      if (narrow === wasNarrow.current) return;

      wasNarrow.current = narrow;
      if (narrow) {
        restoreOpen.current = open;
        if (open) setOpen(false);
      } else if (restoreOpen.current) {
        restoreOpen.current = false;
        setOpen(true);
      }
    };

    adaptToViewport();
    window.addEventListener("resize", adaptToViewport);
    return () => window.removeEventListener("resize", adaptToViewport);
  }, [open, setOpen, sidebarWidth]);
}
