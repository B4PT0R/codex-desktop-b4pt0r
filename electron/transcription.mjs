import { readFile } from "node:fs/promises";
import path from "node:path";

const TRANSCRIPTION_URL = "https://chatgpt.com/backend-api/transcribe";
const MAX_WEBM_BYTES = 25 * 1024 * 1024;

export function authPath(environment = process.env) {
  const codexHome =
    environment.CODEX_HOME || path.join(environment.HOME ?? "", ".codex");
  return path.join(codexHome, "auth.json");
}

export async function readCodexAuth(environment = process.env) {
  let auth;
  try {
    auth = JSON.parse(await readFile(authPath(environment), "utf8"));
  } catch {
    throw new Error(
      "unable to read Codex authentication; sign in to Codex first",
    );
  }
  const accessToken = auth?.tokens?.access_token;
  const accountId = auth?.tokens?.account_id;
  if (typeof accessToken !== "string" || typeof accountId !== "string") {
    throw new Error("invalid Codex authentication; sign in to Codex again");
  }
  return { accessToken, accountId };
}

export async function transcribeDictation(
  audio,
  environment = process.env,
  fetcher = fetch,
) {
  if (!(audio instanceof Uint8Array)) {
    throw new Error("invalid dictation audio");
  }
  if (audio.byteLength === 0 || audio.byteLength > MAX_WEBM_BYTES) {
    throw new Error("dictation is empty or too long");
  }
  const auth = await readCodexAuth(environment);
  const form = new FormData();
  form.append(
    "file",
    new Blob([audio], { type: "audio/webm" }),
    "dictation.webm",
  );
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  const response = await fetcher(TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "ChatGPT-Account-ID": auth.accountId,
      originator: "codex_cli_rs",
    },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`transcription service returned HTTP ${response.status}`);
  }
  const result = await response.json();
  if (typeof result?.text !== "string") {
    throw new Error("invalid transcription response");
  }
  return { text: result.text };
}
