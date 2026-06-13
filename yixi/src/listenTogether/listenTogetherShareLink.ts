const LISTEN_TOGETHER_SCAN_BASE_URL = "https://pisamusic.partialy.cn/scan";
const LISTEN_TOGETHER_JOIN_TYPE = "listen-together-join";
const LISTEN_TOGETHER_WEB_HOST = "pisamusic.partialy.cn";
const LISTEN_TOGETHER_APP_SCHEME = "pisamusic:";
const LISTEN_TOGETHER_SCAN_HOST = "scan";
const ROOM_ID_PATTERN = /^\d{4,8}$/;

export type ListenTogetherInvite = {
  type: typeof LISTEN_TOGETHER_JOIN_TYPE;
  roomId: string;
};

export type ListenTogetherInviteDecision =
  | "open-current-room"
  | "service-unavailable"
  | "request-login"
  | "join-room"
  | "confirm-switch-room";

/** 生成供二维码和邀请文案使用的官网一起听加入链接。 */
export function buildListenTogetherJoinLink(roomId: string): string {
  const cleanRoomId = roomId.trim();
  const params = new URLSearchParams({
    type: LISTEN_TOGETHER_JOIN_TYPE,
    roomId: cleanRoomId,
  });
  return `${LISTEN_TOGETHER_SCAN_BASE_URL}?${params.toString()}`;
}

/** 严格解析官网邀请链接或 pisamusic://scan 自定义协议。 */
export function parseListenTogetherInvite(raw: string): ListenTogetherInvite | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!isSupportedScanEndpoint(url)) return null;
  if (url.searchParams.get("type") !== LISTEN_TOGETHER_JOIN_TYPE) return null;
  const roomId = url.searchParams.get("roomId") ?? "";
  if (!ROOM_ID_PATTERN.test(roomId)) return null;
  return { type: LISTEN_TOGETHER_JOIN_TYPE, roomId };
}

/** Windows/Linux 会把深链放进 argv；多个有效邀请以最后一个为准。 */
export function findListenTogetherInviteInArgs(args: readonly string[]): ListenTogetherInvite | null {
  let latest: ListenTogetherInvite | null = null;
  for (const arg of args) {
    const invite = parseListenTogetherInvite(arg);
    if (invite) latest = invite;
  }
  return latest;
}

/** 把外部邀请映射为 UI 动作，组件只负责执行动作。 */
export function decideListenTogetherInvite(
  invite: ListenTogetherInvite,
  state: {
    currentRoomId?: string | null;
    isLoggedIn: boolean;
    onlineServiceAvailable: boolean;
  },
): ListenTogetherInviteDecision {
  if (state.currentRoomId === invite.roomId) return "open-current-room";
  if (!state.onlineServiceAvailable) return "service-unavailable";
  if (!state.isLoggedIn) return "request-login";
  if (state.currentRoomId) return "confirm-switch-room";
  return "join-room";
}

function isSupportedScanEndpoint(url: URL): boolean {
  if (url.protocol === "https:") {
    return (
      url.hostname.toLowerCase() === LISTEN_TOGETHER_WEB_HOST &&
      (url.port === "" || url.port === "443") &&
      (url.pathname === "/scan" || url.pathname === "/scan/")
    );
  }
  if (url.protocol === LISTEN_TOGETHER_APP_SCHEME) {
    return (
      url.hostname.toLowerCase() === LISTEN_TOGETHER_SCAN_HOST &&
      url.port === "" &&
      (url.pathname === "" || url.pathname === "/")
    );
  }
  return false;
}
