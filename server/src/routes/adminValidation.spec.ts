import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDesktopUpdateFeedUrl } from "./adminValidation.js";

test("后台更新源只接受不含敏感 URL 部件的 HTTPS 地址，并允许路径", () => {
  assert.deepEqual(
    normalizeDesktopUpdateFeedUrl("https://updates.example.com/releases/win32/x64/"),
    { ok: true, value: "https://updates.example.com/releases/win32/x64" },
  );
  for (const value of [
    "http://updates.example.com/feed",
    "https://user:password@updates.example.com/feed",
    "https://updates.example.com/feed?channel=stable",
    "https://updates.example.com/feed#stable",
  ]) {
    assert.equal(normalizeDesktopUpdateFeedUrl(value).ok, false, value);
  }
});
