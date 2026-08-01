import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "./nativeBridge";

export type AgentsDocument = {
  content: string;
  exists: boolean;
  filePath: string;
  version: string;
};

export function useWorkspaceAgents({
  enabled,
  nativeApp,
  workspace,
}: {
  enabled: boolean;
  nativeApp: boolean;
  workspace: string;
}) {
  const [document, setDocument] = useState<AgentsDocument>();
  const [draft, setDraftState] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const saveInFlight = useRef(false);
  const dirty = Boolean(document && draft !== document.content);

  const load = useCallback(async () => {
    if (!enabled || !workspace || saveInFlight.current) return;
    const requestId = ++request.current;
    setLoading(true);
    setSaved(false);
    setError("");
    try {
      const loaded = nativeApp
        ? await invoke<AgentsDocument>("read_workspace_agents", { workspace })
        : previewDocument(workspace);
      if (request.current !== requestId) return;
      setDocument(loaded);
      setDraftState(loaded.content);
    } catch (cause) {
      if (request.current === requestId) setError(errorMessage(cause));
    } finally {
      if (request.current === requestId) setLoading(false);
    }
  }, [enabled, nativeApp, workspace]);

  const save = useCallback(async () => {
    if (!document || !dirty || saveInFlight.current) return;
    saveInFlight.current = true;
    const requestId = ++request.current;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = nativeApp
        ? await invoke<AgentsDocument>("write_workspace_agents", {
            content: draft,
            expectedVersion: document.version,
            workspace,
          })
        : savePreviewDocument(workspace, draft);
      if (request.current !== requestId) return;
      setDocument(updated);
      setDraftState(updated.content);
      setSaved(true);
    } catch (cause) {
      if (request.current === requestId) setError(errorMessage(cause));
    } finally {
      saveInFlight.current = false;
      if (request.current === requestId) setSaving(false);
    }
  }, [dirty, document, draft, nativeApp, workspace]);

  useEffect(() => {
    if (enabled) {
      void load();
      return () => {
        request.current += 1;
      };
    }
    request.current += 1;
    setDocument(undefined);
    setDraftState("");
    setError("");
    setLoading(false);
    setSaved(false);
    setSaving(false);
  }, [enabled, load]);

  return {
    document,
    draft,
    dirty,
    error,
    loading,
    saved,
    saving,
    load,
    save,
    setDraft(value: string) {
      setDraftState(value);
      setSaved(false);
      setError("");
    },
  };
}

function previewDocument(workspace: string): AgentsDocument {
  const content =
    localStorage.getItem(`codex-desktop.preview-agents:${workspace}`) ?? "";
  return {
    content,
    exists: Boolean(content),
    filePath: `${workspace}/AGENTS.md`,
    version: content,
  };
}

function savePreviewDocument(
  workspace: string,
  content: string,
): AgentsDocument {
  localStorage.setItem(`codex-desktop.preview-agents:${workspace}`, content);
  return {
    content,
    exists: true,
    filePath: `${workspace}/AGENTS.md`,
    version: content,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
