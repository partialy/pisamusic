import { describe, expect, it } from "vitest";
import { normalizeAnnouncementContent, parseAnnouncementAction } from "./homeAnnouncement";

describe("desktop announcement content", () => {
  it("keeps text styling in a version 1 content container", () => {
    const text = { type: "text", text: "公告", color: "#a1b2c3", bold: true, italic: true };
    const content = { schemaVersion: 1, blocks: [text] };

    expect(normalizeAnnouncementContent(content)).toEqual(content);
  });

  it("keeps legacy text and drops an unsafe color without dropping text", () => {
    expect(normalizeAnnouncementContent({
      schemaVersion: 1,
      blocks: [{ type: "text", text: "旧公告", color: "constructor" }],
    }).blocks).toEqual([{ type: "text", text: "旧公告" }]);
  });

  it("preserves four-digit colors and falls back for historical malformed highlights", () => {
    const action = { type: "none" };
    const blocks = [
      { type: "text", text: "文字", color: "#abcd" },
      { type: "highlight", text: "四位", color: "#abcd", action },
      { type: "highlight", text: "五位", color: "#abcde", action },
      { type: "highlight", text: "七位", color: "#abcdef0", action },
    ];

    expect(normalizeAnnouncementContent({ schemaVersion: 1, blocks }).blocks).toEqual([
      blocks[0], blocks[1], { ...blocks[2], color: "neutral" }, { ...blocks[3], color: "neutral" },
    ]);
  });

  it("only accepts registered App pages", () => {
    expect(parseAnnouncementAction({ type: "page", page: "discover" })).toMatchObject({ type: "page", page: "discover" });
    expect(parseAnnouncementAction({ type: "page", page: "settings" })).toMatchObject({ type: "page", page: "settings" });
    expect(parseAnnouncementAction({ type: "page", page: "https://example.com" })).toEqual({ type: "none" });
  });

  it("preserves in-app header options and rejects non-HTTPS links", () => {
    const link = { type: "url", url: "https://example.com", openMode: "app", showHeaderBar: false };

    expect(parseAnnouncementAction(link)).toMatchObject(link);
    expect(parseAnnouncementAction({ ...link, url: "file:///example.html" })).toEqual({ type: "none" });
  });
});
