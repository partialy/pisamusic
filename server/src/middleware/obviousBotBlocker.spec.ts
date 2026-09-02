import assert from "node:assert/strict";
import test from "node:test";
import { isBotUserAgent } from "./obviousBotBlocker";

test("obviousBotBlocker: matches bot user agents case-insensitively", () => {
  const substrings = ["python/", "aiohttp/", "curl/", "wget/", "scrapy"];

  assert.strictEqual(isBotUserAgent("Python/3.12 aiohttp/3.14.1", substrings, false), true);
  assert.strictEqual(isBotUserAgent("curl/7.88.1", substrings, false), true);
  assert.strictEqual(isBotUserAgent("Wget/1.21.3", substrings, false), true);
  assert.strictEqual(isBotUserAgent("Scrapy/2.11.0 (+https://scrapy.org)", substrings, false), true);

  // 正常浏览器和客户端 UA
  assert.strictEqual(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", substrings, false), false);
  assert.strictEqual(isBotUserAgent("okhttp/4.12.0", substrings, false), false);
  assert.strictEqual(isBotUserAgent("electron-updater/5.3.1", substrings, false), false);
});

test("obviousBotBlocker: blockEmptyUserAgent flag handling", () => {
  const substrings = ["python/"];
  assert.strictEqual(isBotUserAgent("", substrings, false), false);
  assert.strictEqual(isBotUserAgent("", substrings, true), true);
  assert.strictEqual(isBotUserAgent("   ", substrings, true), true);
});
