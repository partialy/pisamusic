import assert from "node:assert/strict";
import test from "node:test";
import { legacyHtmlToPlainText, normalizePlainTextContent } from "./plainTextContent";

test("plain text normalization preserves headings and paragraphs", () => {
  assert.equal(normalizePlainTextContent("标题\r\n\r\n段落"), "标题\n\n段落");
  assert.equal(normalizePlainTextContent("标题\n\n\n段落"), "标题\n\n\n段落");
});

test("legacy legal html becomes readable plain text", () => {
  assert.equal(
    legacyHtmlToPlainText("<h1>标题</h1><p>第一段</p><p>第二段</p>"),
    "标题\n\n第一段\n\n第二段",
  );
  assert.equal(legacyHtmlToPlainText("<p>A&nbsp;&amp;&nbsp;B</p>"), "A & B");
  assert.equal(legacyHtmlToPlainText("2 < 3 and 4 > 1"), "2 < 3 and 4 > 1");
});
