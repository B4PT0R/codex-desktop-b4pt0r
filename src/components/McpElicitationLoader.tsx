import { lazy, Suspense } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { McpElicitationDialog as DialogComponent } from "./McpElicitationDialog";

const McpElicitationDialog = lazy(() =>
  import("./McpElicitationDialog").then((module) => ({
    default: module.McpElicitationDialog as typeof DialogComponent,
  })),
);

export function McpElicitationLoader(
  props: Parameters<typeof DialogComponent>[0],
) {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="overlay">
          <div className="modal mcp-elicitation-loading" role="status">
            <span className="settings-loader-spinner" />
            {t("mcpElicitation.loading")}
          </div>
        </div>
      }
    >
      <McpElicitationDialog {...props} />
    </Suspense>
  );
}
