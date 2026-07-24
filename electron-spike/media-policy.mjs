export const PROBE_ORIGIN = "app://probe";

export function isTrustedProbeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "app:" && url.hostname === "probe";
  } catch {
    return false;
  }
}

export function canCheckMicrophone({
  permission,
  requestingOrigin,
  mediaType,
  isMainFrame,
}) {
  return (
    permission === "media" &&
    mediaType === "audio" &&
    isMainFrame === true &&
    isTrustedProbeUrl(requestingOrigin)
  );
}

export function canRequestMicrophone({
  permission,
  pageUrl,
  requestingUrl,
  mediaTypes,
}) {
  return (
    permission === "media" &&
    isTrustedProbeUrl(pageUrl) &&
    isTrustedProbeUrl(requestingUrl) &&
    Array.isArray(mediaTypes) &&
    mediaTypes.length === 1 &&
    mediaTypes[0] === "audio"
  );
}
