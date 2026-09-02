import assert from "node:assert/strict";
import test from "node:test";
import { isPathMatch, matchPathPattern, normalizePathname } from "./pathMatcher";

test("pathMatcher: normalizePathname handles query and hash", () => {
  assert.strictEqual(normalizePathname("/api/config/download/android?query=1#hash"), "/api/config/download/android");
  assert.strictEqual(normalizePathname("api/test"), "/api/test");
  assert.strictEqual(normalizePathname("/api//test///1"), "/api/test/1");
});

test("pathMatcher: matchPathPattern exact and wildcard matching", () => {
  assert.strictEqual(matchPathPattern("/api/config/download/windows", "/api/config/download/*"), true);
  assert.strictEqual(matchPathPattern("/api/config/download", "/api/config/download/*"), true);
  assert.strictEqual(matchPathPattern("/api/config/download/windows/extra", "/api/config/download/*"), true);
  assert.strictEqual(matchPathPattern("/api/config/check-update", "/api/config/download/*"), false);
  assert.strictEqual(matchPathPattern("/api/config/bootstrap", "/api/config/bootstrap"), true);
  assert.strictEqual(matchPathPattern("/api/config/bootstrap/", "/api/config/bootstrap"), true);
});

test("pathMatcher: isPathMatch against list of patterns", () => {
  const patterns = [
    "/api/config/download/*",
    "/api/config/release-files/*",
    "/api/config/desktop-updates/win32/x64/latest.yml",
  ];

  assert.strictEqual(isPathMatch("/api/config/download/desktop?t=123", patterns), true);
  assert.strictEqual(isPathMatch("/api/config/release-files/123/download", patterns), true);
  assert.strictEqual(isPathMatch("/api/config/desktop-updates/win32/x64/latest.yml", patterns), true);
  assert.strictEqual(isPathMatch("/api/config/check-update", patterns), false);
  assert.strictEqual(isPathMatch("/api/config/releases", patterns), false);
});
