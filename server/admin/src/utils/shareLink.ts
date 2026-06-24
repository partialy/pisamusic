const MUSIC_SHARE_SCAN_URL = "https://pisamusic.partialy.cn/scan";

export function buildMusicShareWebLink(uuid: string): string {
  const params = new URLSearchParams({
    type: "music-share",
    uuid: uuid.trim(),
  });
  return `${MUSIC_SHARE_SCAN_URL}?${params.toString()}`;
}
