import { AudioWaveform, ChevronDown, MessageSquareText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export function RealtimeTextMessage({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(Boolean(message.streaming));
  const wasStreaming = useRef(Boolean(message.streaming));

  useEffect(() => {
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
      className={`realtime-text-message${expanded ? " expanded" : ""}`}
      aria-label={t("conversation.realtime.text")}
    >
      <button
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <MessageSquareText />
        <span>{t("conversation.realtime.text")}</span>
        <ChevronDown className="realtime-text-chevron" />
      </button>
      <div className="realtime-text-body" aria-hidden={!expanded}>
        <div>
          <Markdown streaming={message.streaming}>{message.content}</Markdown>
        </div>
      </div>
    </section>
  );
}
