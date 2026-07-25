import { CircleAlert } from "lucide-react";
import type { ChatMessage } from "../types";
import "../application-error.css";

export function ApplicationErrorMessage({
  message,
}: {
  message: ChatMessage;
}) {
  return (
    <section
      className="application-error-message"
      role="alert"
      aria-label={message.title}
    >
      <CircleAlert aria-hidden="true" />
      <span>
        <strong>{message.title}</strong>
        <small>{message.content}</small>
      </span>
    </section>
  );
}
