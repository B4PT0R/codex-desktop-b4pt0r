import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DesktopSettingsPatch } from "./desktopSettings";

export type ThemePreference = "system" | "dark" | "light";
export type FontSizePreference = "small" | "default" | "large";

type AppearanceContextValue = {
  theme: ThemePreference;
  fontSize: FontSizePreference;
  persistenceError?: string;
  setTheme: (theme: ThemePreference) => void;
  setFontSize: (fontSize: FontSizePreference) => void;
};

const AppearanceContext = createContext<AppearanceContextValue>({
  theme: "system",
  fontSize: "default",
  setTheme: () => undefined,
  setFontSize: () => undefined,
});

/** Applies app-wide visual preferences and persists them in desktop settings. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [fontSize, setFontSizeState] =
    useState<FontSizePreference>("default");
  const [persistenceError, setPersistenceError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    void import("./desktopSettings")
      .then(({ loadDesktopSettings }) => loadDesktopSettings())
      .then((settings) => {
        if (disposed) return;
        setThemeState(settings.theme ?? "system");
        setFontSizeState(settings.fontSize ?? "default");
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
      persistenceError,
      setTheme: (nextTheme: ThemePreference) =>
        persist({ theme: nextTheme }, () => setThemeState(nextTheme)),
      setFontSize: (nextFontSize: FontSizePreference) =>
        persist({ fontSize: nextFontSize }, () =>
          setFontSizeState(nextFontSize),
        ),
    }),
    [fontSize, persistenceError, theme],
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
