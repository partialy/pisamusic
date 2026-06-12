const LISTEN_TOGETHER_SCAN_BASE_URL = "https://pisamusic.partialy.cn/scan";
const LISTEN_TOGETHER_JOIN_TYPE = "listen-together-join";

/** 生成供二维码和邀请文案使用的官网一起听加入链接。 */
export function buildListenTogetherJoinLink(roomId: string): string {
  const cleanRoomId = roomId.trim();
  const params = new URLSearchParams({
    type: LISTEN_TOGETHER_JOIN_TYPE,
    roomId: cleanRoomId,
  });
  return `${LISTEN_TOGETHER_SCAN_BASE_URL}?${params.toString()}`;
}
