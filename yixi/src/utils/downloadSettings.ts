/** main 与 renderer 共用下载策略；旧布尔值只迁移外置歌词。 */
export type DownloadLyricsMode = "off" | "word" | "line" | "all";
export function normalizeDownloadSettings(input?: Record<string, unknown> | null) {
  const mode = input?.downloadLyricsMode;
  return {
    embedDownloadTags: input?.embedDownloadTags !== false,
    embedDownloadCover: input?.embedDownloadCover !== false,
    embedDownloadLyrics: input?.embedDownloadLyrics !== false,
    downloadLyricsMode: (mode === "off" || mode === "word" || mode === "line" || mode === "all"
      ? mode : input?.saveDownloadLyricsFile === true ? "line" : "off") as DownloadLyricsMode,
  };
}
