import { ExternalLink, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { openPath, openUrl } from "../lib/nativeBridge";
import { useI18n } from "../i18n/I18nProvider";
import { openImageInChromium, openInChromium } from "../lib/useChromium";
import type { ToolArtifact } from "../types";

export function ToolArtifacts({ artifacts }: { artifacts: ToolArtifact[] }) {
  return (
    <div className="tool-artifacts">
      {artifacts.map((artifact, index) =>
        artifact.type === "generatedImage" ? (
          <GeneratedImage key={`image-${index}`} artifact={artifact} />
        ) : (
          <WebResult key={`${artifact.url}-${index}`} artifact={artifact} />
        ),
      )}
    </div>
  );
}

function GeneratedImage({
  artifact,
}: {
  artifact: Extract<ToolArtifact, { type: "generatedImage" }>;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const [openError, setOpenError] = useState<"chromium" | "system">();

  async function open() {
    setOpenError(undefined);
    try {
      if (artifact.path) await openInChromium(artifact.path);
      else if (artifact.dataUrl) await openImageInChromium(artifact.dataUrl);
    } catch {
      setOpenError("chromium");
    }
  }

  async function openWithSystemViewer() {
    if (!artifact.path) return;
    try {
      await openPath(artifact.path);
    } catch {
      setOpenError("system");
    }
  }

  const canOpen = Boolean(artifact.path || artifact.dataUrl);
  return (
    <figure className="tool-generated-image">
      <button
        className="tool-generated-image-open"
        disabled={!canOpen}
        aria-label={canOpen ? t("tool.artifact.openImage") : undefined}
        onClick={() => void open()}
      >
        {artifact.dataUrl && !failed ? (
          <img
            src={artifact.dataUrl}
            alt={artifact.prompt ?? t("tool.artifact.generatedAlt")}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="tool-image-unavailable">
            <ImageIcon />
            <span>{t("tool.artifact.previewUnavailable")}</span>
          </span>
        )}
      </button>
      {(artifact.prompt || artifact.path) && (
        <figcaption>
          {artifact.prompt && <span>{artifact.prompt}</span>}
          {artifact.path && <code>{artifact.path}</code>}
        </figcaption>
      )}
      {openError && (
        <small role="alert">
          {t(
            openError === "system"
              ? "tool.artifact.systemError"
              : "tool.artifact.openError",
          )}
          {openError === "chromium" && artifact.path && (
            <>
              {" "}
              <button onClick={() => void openWithSystemViewer()}>
                {t("tool.artifact.systemViewerFallback")}
              </button>
            </>
          )}
        </small>
      )}
    </figure>
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
