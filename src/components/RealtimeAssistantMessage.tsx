import { AudioWaveform, ChevronDown, LoaderCircle, MessageSquareText } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { ChatMessage } from "../types";
import { Markdown } from "./Markdown";

export function RealtimeVoiceMessage({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  return (
    <div
      className={`realtime-voice-message${message.streaming ? " streaming" : ""}`}
    >
      <div className="realtime-message-label">
        <AudioWaveform />
        <span>{t("conversation.realtime.voice")}</span>
      </div>
      <Markdown streaming={message.streaming}>{message.content}</Markdown>
    </div>
  );
}

export function RealtimeTextMessage({
  content,
  details,
  message,
}: {
  content?: ReactNode;
  details?: ReactNode;
  message: ChatMessage;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(Boolean(message.streaming));
  const wasStreaming = useRef(Boolean(message.streaming));

  // Streaming can flip while protocol items are being regrouped. Synchronize
  // expansion before paint so the previous state never flashes for one frame.
  useLayoutEffect(() => {
    if (message.streaming) {
      wasStreaming.current = true;
      setExpanded(true);
      return;
    }
    if (!wasStreaming.current) return;
    wasStreaming.current = false;
    const timer = window.setTimeout(() => setExpanded(false), 500);
    return () => window.clearTimeout(timer);
  }, [message.streaming]);

  return (
    <section
      className={`realtime-text-message${expanded ? " expanded" : ""}${message.streaming ? " streaming" : ""}`}
      aria-label={t("conversation.realtime.text")}
    >
      <button
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <MessageSquareText />
        <span>{t("conversation.realtime.text")}</span>
        <span
          aria-label={message.streaming ? t("conversation.realtime.textActive") : undefined}
          className="realtime-text-status"
          role={message.streaming ? "status" : undefined}
        >
          {message.streaming && <LoaderCircle aria-hidden="true" className="spin" />}
        </span>
        <ChevronDown className="realtime-text-chevron" />
      </button>
      <div className="realtime-text-body" aria-hidden={!expanded}>
        <div>
          {content ?? <Markdown streaming={message.streaming}>{message.content}</Markdown>}
          {details}
        </div>
      </div>
    </section>
  );
}
