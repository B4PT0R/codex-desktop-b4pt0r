import {
  ChevronDown,
  Download,
  Expand,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/I18nProvider";
import { invoke, isDesktopApp } from "../lib/nativeBridge";
import { useDialogFocus } from "../lib/useDialogFocus";
import type { ToolArtifact } from "../types";
import "../generated-image.css";
import { RoundIconButton } from "./RoundIcon";

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

  const { dialogRef, onDialogKeyDown } = useDialogFocus<HTMLDivElement>({
    active: Boolean(expanded),
    initialFocusSelector: "[data-image-lightbox-close]",
    onEscape: () => setExpanded(undefined),
  });

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
                      <RoundIconButton
                        aria-label={t("imageWidget.expand")}
                        icon={Expand}
                        onClick={() => setExpanded(artifact)}
                        variant="tertiary"
                      />
                    )}
                    <RoundIconButton
                      aria-label={t("imageWidget.download")}
                      disabled={saving || (!artifact.dataUrl && !artifact.path)}
                      icon={Download}
                      onClick={() => void save(artifact)}
                      variant="tertiary"
                    />
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
            ref={dialogRef}
            className="generated-image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={t("imageWidget.expanded")}
            onKeyDown={onDialogKeyDown}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setExpanded(undefined);
            }}
          >
            <img
              alt={expanded.prompt ?? t("tool.artifact.generatedAlt")}
              src={expanded.dataUrl}
            />
            <span>
              <RoundIconButton
                aria-label={t("imageWidget.download")}
                disabled={saving}
                icon={Download}
                onClick={() => void save(expanded)}
                variant="tertiary"
              />
              <RoundIconButton
                aria-label={t("imageWidget.close")}
                data-image-lightbox-close
                icon={X}
                onClick={() => setExpanded(undefined)}
                variant="tertiary"
              />
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
