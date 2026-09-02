import assert from "node:assert/strict";
import test from "node:test";
import { MemoryRateLimitStore } from "./ipRateLimit";

test("ipRateLimit: sliding window rate limiting for same IP", () => {
  const store = new MemoryRateLimitStore(100);
  const key = "download:127.0.0.1";
  const windowMs = 60000;
  const maxRequests = 5;

  let now = 100000;
  for (let i = 1; i <= 5; i++) {
    const res = store.hit(key, windowMs, maxRequests, now);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.remaining, 5 - i);
    now += 100;
  }

  // 第 6 次请求在同一窗口内被拦截
  const blocked = store.hit(key, windowMs, maxRequests, now);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds > 0);

  // 窗口时间过去后恢复
  now += windowMs + 1000;
  const recovered = store.hit(key, windowMs, maxRequests, now);
  assert.strictEqual(recovered.allowed, true);
  assert.strictEqual(recovered.remaining, 4);
});

test("ipRateLimit: different IPs are tracked independently", () => {
  const store = new MemoryRateLimitStore(100);
  const windowMs = 60000;
  const maxRequests = 2;
  const now = 100000;

  assert.strictEqual(store.hit("download:1.1.1.1", windowMs, maxRequests, now).allowed, true);
  assert.strictEqual(store.hit("download:1.1.1.1", windowMs, maxRequests, now).allowed, true);
  assert.strictEqual(store.hit("download:1.1.1.1", windowMs, maxRequests, now).allowed, false);

  // 另一个 IP 不受影响
  assert.strictEqual(store.hit("download:2.2.2.2", windowMs, maxRequests, now).allowed, true);
});
