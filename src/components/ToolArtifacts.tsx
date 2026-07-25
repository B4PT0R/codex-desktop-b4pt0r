import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { openUrl } from "../lib/nativeBridge";
import { useI18n } from "../i18n/I18nProvider";
import { openInChromium } from "../lib/useChromium";
import type { ToolArtifact } from "../types";

export function ToolArtifacts({ artifacts }: { artifacts: ToolArtifact[] }) {
  return (
    <div className="tool-artifacts">
      {artifacts.map((artifact, index) =>
        artifact.type === "webResult" ? (
          <WebResult key={`${artifact.url}-${index}`} artifact={artifact} />
        ) : null,
      )}
    </div>
  );
}

function WebResult({
  artifact,
}: {
  artifact: Extract<ToolArtifact, { type: "webResult" }>;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<"chromium" | "system">();

  async function open() {
    setError(undefined);
    try {
      await openInChromium(artifact.url);
    } catch {
      setError("chromium");
    }
  }

  async function openWithSystemBrowser() {
    try {
      await openUrl(artifact.url);
    } catch {
      setError("system");
    }
  }

  return (
    <article className="tool-web-result">
      <button onClick={() => void open()}>
        <span>
          <strong>{artifact.title}</strong>
          <small>{displayHost(artifact.url)}</small>
        </span>
        <ExternalLink />
      </button>
      {artifact.snippet && <p>{artifact.snippet}</p>}
      {error && (
        <small role="alert">
          {t(
            error === "system"
              ? "tool.artifact.systemError"
              : "tool.artifact.openError",
          )}
          {error === "chromium" && (
            <>
              {" "}
              <button onClick={() => void openWithSystemBrowser()}>
                {t("tool.artifact.systemFallback")}
              </button>
            </>
          )}
        </small>
      )}
    </article>
  );
}

function displayHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
