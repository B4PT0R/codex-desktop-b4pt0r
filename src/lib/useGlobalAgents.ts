import { useCallback, useEffect, useState } from "react";
import { invoke, isDesktopApp } from "./nativeBridge";

export type GlobalAgentsDocument = {
  content: string;
  exists: boolean;
  filePath: string;
  overrideActive: boolean;
  overrideFilePath: string;
  version: string;
};

const previewDocument: GlobalAgentsDocument = {
  content:
    "# Personal Codex defaults\n\n- Keep responses concise.\n- Run focused tests after changes.\n",
  exists: true,
  filePath: "~/.codex/AGENTS.md",
  overrideActive: false,
  overrideFilePath: "~/.codex/AGENTS.override.md",
  version: "preview",
};

export function useGlobalAgents() {
  const native = isDesktopApp();
  const [document, setDocument] = useState<GlobalAgentsDocument>();
  const [draft, setDraftState] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setSaved(false);
    try {
      const next = native
        ? await invoke<GlobalAgentsDocument>("read_global_agents")
        : previewDocument;
      setDocument(next);
      setDraftState(next.content);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [native]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!document || draft === document.content || saving) return;
    setSaving(true);
    setError(undefined);
    setSaved(false);
    try {
      const next = native
        ? await invoke<GlobalAgentsDocument>("write_global_agents", {
            content: draft,
            expectedVersion: document.version,
          })
        : {
            ...document,
            content: draft,
            exists: true,
            version: "preview-saved",
          };
      setDocument(next);
      setDraftState(next.content);
      setSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }, [document, draft, native, saving]);

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
    setDraft(value: string) {
      setDraftState(value);
      setSaved(false);
      setError(undefined);
    },
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
