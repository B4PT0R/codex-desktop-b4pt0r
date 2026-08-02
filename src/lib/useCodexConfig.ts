import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isDesktopApp } from "./nativeBridge";

export type CodexConfigDocument = {
  content: string;
  filePath: string;
  version: string;
};

const previewDocument: CodexConfigDocument = {
  content:
    '# Browser preview only\nmodel = "gpt-5.4"\ndefault_permissions = ":workspace"\n\n[features]\napps = true\n',
  filePath: "~/.codex/config.toml",
  version: "preview",
};

export function useCodexConfig() {
  const native = isDesktopApp();
  const [document, setDocument] = useState<CodexConfigDocument>();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const loadInFlight = useRef(false);
  const saveInFlight = useRef(false);

  const load = useCallback(async () => {
    if (loadInFlight.current || saveInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    setError(undefined);
    setSaved(false);
    try {
      const next = native
        ? await invoke<CodexConfigDocument>("read_codex_config")
        : previewDocument;
      setDocument(next);
      setDraft(next.content);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      loadInFlight.current = false;
      setLoading(false);
    }
  }, [native]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (
      !document ||
      draft === document.content ||
      loadInFlight.current ||
      saveInFlight.current
    ) {
      return false;
    }
    saveInFlight.current = true;
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const next = native
        ? await invoke<CodexConfigDocument>("write_codex_config", {
            content: draft,
            expectedVersion: document.version,
          })
        : { ...document, content: draft, version: "preview-saved" };
      setDocument(next);
      setDraft(next.content);
      setSaved(true);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [document, draft, native]);

  return {
    document,
    draft,
    dirty: Boolean(document && draft !== document.content),
    error,
    loading,
    native,
    saved,
    saving,
    load,
    save,
    setDraft: (value: string) => {
      setDraft(value);
      setSaved(false);
      setError(undefined);
    },
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
