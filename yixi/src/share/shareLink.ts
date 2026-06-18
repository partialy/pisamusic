const SHARE_SCAN_BASE_URL = "https://pisamusic.partialy.cn/scan";
const SHARE_TYPE = "music-share";
const SHARE_WEB_HOST = "pisamusic.partialy.cn";
const SHARE_APP_SCHEME = "pisamusic:";
const SHARE_SCAN_HOST = "scan";
const UUID_PATTERN = /^[0-9a-fA-F-]{32,40}$/;

export type ExternalShareInvite = {
  type: typeof SHARE_TYPE;
  uuid: string;
};

export function buildShareWebLink(uuid: string): string {
  const params = new URLSearchParams({
    type: SHARE_TYPE,
    uuid: uuid.trim(),
  });
  return `${SHARE_SCAN_BASE_URL}?${params.toString()}`;
}

export function buildShareAppLink(uuid: string): string {
  const params = new URLSearchParams({
    type: SHARE_TYPE,
    uuid: uuid.trim(),
  });
  return `pisamusic://scan?${params.toString()}`;
}

export function parseExternalShareInvite(raw: string): ExternalShareInvite | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!isSupportedScanEndpoint(url)) return null;
  if (url.searchParams.get("type") !== SHARE_TYPE) return null;
  const uuid = url.searchParams.get("uuid")?.trim() ?? "";
  if (!UUID_PATTERN.test(uuid)) return null;
  return { type: SHARE_TYPE, uuid };
}

export function findExternalShareInviteInArgs(args: readonly string[]): ExternalShareInvite | null {
  let latest: ExternalShareInvite | null = null;
  for (const arg of args) {
    const invite = parseExternalShareInvite(arg);
    if (invite) latest = invite;
  }
  return latest;
}

function isSupportedScanEndpoint(url: URL): boolean {
  if (url.protocol === "https:" || url.protocol === "http:") {
    return (
      url.hostname.toLowerCase() === SHARE_WEB_HOST &&
      (url.port === "" || url.port === "443" || url.port === "80") &&
      (url.pathname === "/scan" || url.pathname === "/scan/")
    );
  }
  if (url.protocol === SHARE_APP_SCHEME) {
    return (
      url.hostname.toLowerCase() === SHARE_SCAN_HOST &&
      url.port === "" &&
      (url.pathname === "" || url.pathname === "/")
    );
  }
  return false;
}
