import {
  ChevronDown,
  Download,
  Expand,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/I18nProvider";
import { invoke, isDesktopApp } from "../lib/nativeBridge";
import type { ToolArtifact } from "../types";
import "../generated-image.css";

type GeneratedImageArtifact = Extract<
  ToolArtifact,
  { type: "generatedImage" }
>;

export function GeneratedImageWidget({
  artifacts,
}: {
  artifacts: GeneratedImageArtifact[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<GeneratedImageArtifact>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(undefined);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [expanded]);

  async function save(artifact: GeneratedImageArtifact) {
    setSaveError(false);
    setSaving(true);
    try {
      if (isDesktopApp()) {
        await invoke("save_generated_image", {
          dataUrl: artifact.dataUrl,
          path: artifact.path,
        });
      } else if (artifact.dataUrl) {
        const link = document.createElement("a");
        link.download = suggestedName(artifact.dataUrl);
        link.href = artifact.dataUrl;
        link.click();
      } else {
        throw new Error("Generated image data is unavailable");
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section
        className={
          open ? "generated-image-widget open" : "generated-image-widget"
        }
      >
        <header>
          <button
            className="generated-image-toggle"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <ImageIcon />
            <span>
              <strong>{t("imageWidget.title")}</strong>
              <small>{t("imageWidget.count", { count: artifacts.length })}</small>
            </span>
            <ChevronDown />
          </button>
        </header>
        {open && (
          <div className="generated-image-grid">
            {artifacts.map((artifact, index) => (
              <figure key={`${artifact.path ?? "memory"}-${index}`}>
                {artifact.dataUrl ? (
                  <button
                    className="generated-image-preview"
                    aria-label={t("imageWidget.expand")}
                    onClick={() => setExpanded(artifact)}
                  >
                    <img
                      alt={artifact.prompt ?? t("tool.artifact.generatedAlt")}
                      loading="lazy"
                      src={artifact.dataUrl}
                    />
                  </button>
                ) : (
                  <span className="generated-image-unavailable">
                    <ImageIcon />
                    {t("tool.artifact.previewUnavailable")}
                  </span>
                )}
                <figcaption>
                  {(artifact.prompt || artifact.path) && (
                    <span>
                      {artifact.prompt && <small>{artifact.prompt}</small>}
                      {artifact.path && <code>{artifact.path}</code>}
                    </span>
                  )}
                  <span className="generated-image-actions">
                    {artifact.dataUrl && (
                      <button
                        aria-label={t("imageWidget.expand")}
                        onClick={() => setExpanded(artifact)}
                      >
                        <Expand />
                      </button>
                    )}
                    <button
                      aria-label={t("imageWidget.download")}
                      disabled={saving || (!artifact.dataUrl && !artifact.path)}
                      onClick={() => void save(artifact)}
                    >
                      <Download />
                    </button>
                  </span>
                </figcaption>
              </figure>
            ))}
            {saveError && (
              <small className="generated-image-error" role="alert">
                {t("imageWidget.downloadError")}
              </small>
            )}
          </div>
        )}
      </section>
      {expanded?.dataUrl &&
        createPortal(
          <div
            className="generated-image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={t("imageWidget.expanded")}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button:not(:disabled)",
                ),
              );
              if (buttons.length < 2) return;
              const first = buttons[0];
              const last = buttons[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setExpanded(undefined);
            }}
          >
            <img
              alt={expanded.prompt ?? t("tool.artifact.generatedAlt")}
              src={expanded.dataUrl}
            />
            <span>
              <button
                aria-label={t("imageWidget.download")}
                disabled={saving}
                onClick={() => void save(expanded)}
              >
                <Download />
              </button>
              <button
                autoFocus
                aria-label={t("imageWidget.close")}
                onClick={() => setExpanded(undefined)}
              >
                <X />
              </button>
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}

function suggestedName(dataUrl: string) {
  if (dataUrl.startsWith("data:image/jpeg")) return "codex-image.jpg";
  if (dataUrl.startsWith("data:image/webp")) return "codex-image.webp";
  if (dataUrl.startsWith("data:image/gif")) return "codex-image.gif";
  return "codex-image.png";
}
