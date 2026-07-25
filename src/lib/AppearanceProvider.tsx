import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DesktopSettingsPatch } from "./desktopSettings";

export type ThemePreference = "system" | "dark" | "light";
export type FontSizePreference = "small" | "default" | "large";
const fontSizeScales: Record<FontSizePreference, number> = {
  small: 1,
  default: 1.12,
  large: 1.25,
};
const scaleStep = 0.04;
const minimumScale = 0.8;
const maximumScale = 1.5;

type AppearanceContextValue = {
  theme: ThemePreference;
  fontSize: FontSizePreference;
  interfaceScale: number;
  persistenceError?: string;
  setTheme: (theme: ThemePreference) => void;
  setFontSize: (fontSize: FontSizePreference) => void;
};

const AppearanceContext = createContext<AppearanceContextValue>({
  theme: "system",
  fontSize: "default",
  interfaceScale: fontSizeScales.default,
  setTheme: () => undefined,
  setFontSize: () => undefined,
});

/** Applies app-wide visual preferences and persists them in desktop settings. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [fontSize, setFontSizeState] =
    useState<FontSizePreference>("default");
  const [interfaceScale, setInterfaceScaleState] = useState(
    fontSizeScales.default,
  );
  const interfaceScaleRef = useRef(interfaceScale);
  const [persistenceError, setPersistenceError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    void import("./desktopSettings")
      .then(({ loadDesktopSettings }) => loadDesktopSettings())
      .then((settings) => {
        if (disposed) return;
        setThemeState(settings.theme ?? "system");
        const nextFontSize = settings.fontSize ?? "default";
        setFontSizeState(nextFontSize);
        setInterfaceScaleState(
          settings.interfaceScale ?? fontSizeScales[nextFontSize],
        );
        interfaceScaleRef.current =
          settings.interfaceScale ?? fontSizeScales[nextFontSize];
      })
      .catch((error) => {
        if (!disposed) setPersistenceError(String(error));
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "light" : "dark") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    interfaceScaleRef.current = interfaceScale;
    const root = document.documentElement;
    root.style.setProperty("--interface-scale", String(interfaceScale));
    root.style.setProperty(
      "--interface-viewport-width",
      `${100 / interfaceScale}vw`,
    );
    root.style.setProperty(
      "--interface-viewport-height",
      `${100 / interfaceScale}vh`,
    );
  }, [interfaceScale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      const direction =
        event.key === "+" || event.key === "=" || event.key === "Add"
          ? 1
          : event.key === "-" ||
              event.key === "_" ||
              event.key === "Subtract"
            ? -1
            : 0;
      if (!direction && event.key !== "0") return;
      event.preventDefault();
      const nextScale =
        event.key === "0"
          ? fontSizeScales[fontSize]
          : clampScale(interfaceScaleRef.current + direction * scaleStep);
      interfaceScaleRef.current = nextScale;
      setInterfaceScaleState(nextScale);
      setPersistenceError(undefined);
      void import("./desktopSettings")
        .then(({ updateDesktopSettings }) =>
          updateDesktopSettings({ interfaceScale: nextScale }),
        )
        .catch((error) => setPersistenceError(String(error)));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fontSize]);

  function persist(
    patch: DesktopSettingsPatch,
    apply: () => void,
  ) {
    apply();
    setPersistenceError(undefined);
    void import("./desktopSettings")
      .then(({ updateDesktopSettings }) => updateDesktopSettings(patch))
      .catch((error) => setPersistenceError(String(error)));
  }

  const value = useMemo(
    () => ({
      theme,
      fontSize,
      interfaceScale,
      persistenceError,
      setTheme: (nextTheme: ThemePreference) =>
        persist({ theme: nextTheme }, () => setThemeState(nextTheme)),
      setFontSize: (nextFontSize: FontSizePreference) => {
        const nextScale = fontSizeScales[nextFontSize];
        persist(
          { fontSize: nextFontSize, interfaceScale: nextScale },
          () => {
            setFontSizeState(nextFontSize);
            setInterfaceScaleState(nextScale);
            interfaceScaleRef.current = nextScale;
          },
        );
      },
    }),
    [fontSize, interfaceScale, persistenceError, theme],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

function clampScale(scale: number) {
  return Math.min(maximumScale, Math.max(minimumScale, Number(scale.toFixed(2))));
}
