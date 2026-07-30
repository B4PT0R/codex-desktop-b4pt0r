import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MessageKey } from "./locales/fr";
import { translate, type Locale, type Translate } from "./translate";

export type { Locale, Translate } from "./translate";

type I18nContextValue = {
  locale: Locale;
  persistenceError?: string;
  setLocale: (locale: Locale) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "fr",
  setLocale: () => undefined,
  t: (key, params) => translate("fr", key, params),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [persistenceError, setPersistenceError] = useState<string>();
  const changedBeforeLoad = useRef(false);

  useEffect(() => {
    let disposed = false;
    void import("../lib/desktopSettings")
      .then(({ loadDesktopSettings }) => loadDesktopSettings())
      .then((settings) => {
        if (disposed) return;
        if (settings.locale && !changedBeforeLoad.current) {
          setLocale(settings.locale);
          document.documentElement.lang = settings.locale;
        }
      })
      .catch((error) => {
        if (!disposed) setPersistenceError(String(error));
      });
    return () => {
      disposed = true;
    };
  }, []);

  const changeLocale = useCallback((nextLocale: Locale) => {
    changedBeforeLoad.current = true;
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    setPersistenceError(undefined);
    void import("../lib/desktopSettings")
      .then(({ updateDesktopSettings }) =>
        updateDesktopSettings({ locale: nextLocale }),
      )
      .catch((error) => setPersistenceError(String(error)));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      persistenceError,
      setLocale: changeLocale,
      t: (key: MessageKey, params?: Record<string, string | number>) =>
        translate(locale, key, params),
    }),
    [changeLocale, locale, persistenceError],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

function initialLocale(): Locale {
  const previewLocale =
    (window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost") &&
    new URLSearchParams(window.location.search).has("demo")
      ? new URLSearchParams(window.location.search).get("locale")
      : null;
  if (previewLocale === "fr" || previewLocale === "en") return previewLocale;
  const stored = localStorage.getItem("codex-desktop.locale");
  if (stored === "fr" || stored === "en") return stored;
  return navigator.language.toLocaleLowerCase().startsWith("fr") ? "fr" : "en";
}
