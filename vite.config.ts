import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import packageMetadata from "./package.json";

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    exclude: ["node_modules/**", "electron/**", "electron-spike/**"],
  },
});
