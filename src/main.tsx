import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import { AppearanceProvider } from "./lib/AppearanceProvider";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppearanceProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AppearanceProvider>
  </StrictMode>,
);
