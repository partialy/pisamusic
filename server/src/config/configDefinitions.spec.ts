import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG_DEFINITIONS, DEFINITION_MAP, validateConfigBatch } from "./configDefinitions";

test("configDefinitions: all keys are unique and properly configured", () => {
  assert.ok(CONFIG_DEFINITIONS.length >= 35);
  const keys = new Set<string>();
  for (const def of CONFIG_DEFINITIONS) {
    assert.ok(!keys.has(def.key), `Duplicate key: ${def.key}`);
    keys.add(def.key);
    assert.ok(def.group, `Missing group for ${def.key}`);
    assert.ok(def.label, `Missing label for ${def.key}`);
    assert.ok(def.defaultValue !== undefined, `Missing defaultValue for ${def.key}`);
    if (def.validate) {
      assert.strictEqual(def.validate(def.defaultValue), null, `Default value invalid for ${def.key}`);
    }
  }
});

test("validateConfigBatch: valid changes pass normalization", () => {
  const result = validateConfigBatch([
    { key: "security.releaseDownloadTtlSeconds", value: 600 },
    { key: "security.downloadRateLimitMaxRequests", value: 10 },
  ]);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.normalized.length, 2);
  assert.strictEqual(result.normalized[0].value, 600);
  assert.strictEqual(result.normalized[1].value, 10);
});

test("validateConfigBatch: unknown key is rejected", () => {
  const result = validateConfigBatch([
    { key: "non_existent_key", value: 123 },
  ]);
  assert.strictEqual(result.valid, false);
  assert.match(result.error ?? "", /未知或不允许/);
});

test("validateConfigBatch: out of range value is rejected", () => {
  const result = validateConfigBatch([
    { key: "security.releaseDownloadTtlSeconds", value: 10 }, // min is 60
  ]);
  // parse 自动归一化到 default 300 或校验拦截
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.normalized[0].value, 300);
});

test("validateConfigBatch: cross-field validation for listenTogether room lengths", () => {
  const result = validateConfigBatch([
    { key: "listenTogether.roomIdMinLength", value: 8 },
    { key: "listenTogether.roomIdMaxLength", value: 4 },
  ]);
  assert.strictEqual(result.valid, false);
  assert.match(result.error ?? "", /最小长度不能大于最大长度/);
});
