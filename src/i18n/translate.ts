import { en } from "./locales/en";
import { fr, type MessageKey } from "./locales/fr";

export type Locale = "fr" | "en";
export type Translate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

const packs: Record<Locale, Record<MessageKey, string>> = { en, fr };

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
) {
  const message = packs[locale][key];
  if (!params) return message;
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

export const defaultTranslate: Translate = (key, params) =>
  translate("fr", key, params);
