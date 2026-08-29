# PC 账号鉴权 Header 去重修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 PC 端系统请求因重复发送大小写不同的 Authorization Header 而被服务端判定 JWT 失效的问题。

**Architecture:** 在 `electron/system/` 增加无 Electron 依赖的 Header 归一化函数，由 `requestSystem()` 统一合并基础 Header 和调用方 Header。已有鉴权调用统一使用 `RequestOptions.token`，避免每个业务模块手写 Bearer Header，并通过聚焦 Vitest 锁定大小写去重行为。

**Tech Stack:** Electron、TypeScript、Node Fetch/Headers、Vitest

## Global Constraints

- 只修改 `yixi/` PC 客户端、测试文件的 Git 例外和本计划文档，不改服务端接口与同步数据库。
- 不清理现有同步游标、outbox、账号数据或用户本地数据。
- 不启动 Electron、不打包 Windows 安装包，只执行聚焦单测和静态差异检查。
- Header 名称按 HTTP 语义大小写不敏感，最终每个规范化名称只能保留一个值。

---

### Task 1: Header 合并纯函数与回归测试

**Files:**
- Create: `yixi/electron/system/requestHeaders.ts`
- Create: `yixi/electron/system/requestHeaders.test.ts`
- Create: `yixi/vitest.system-client.config.ts`
- Modify: `yixi/package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 两个可选 `Record<string, string>`，前者为基础 Header，后者为调用方覆盖 Header。
- Produces: `mergeRequestHeaders(baseHeaders?, overrideHeaders?): Record<string, string>`，所有键转为小写，相同规范化键以后者覆盖前者。

- [x] **Step 1: 写入重复鉴权 Header 的失败测试**

```ts
import { describe, expect, it } from "vitest";
import { mergeRequestHeaders } from "./requestHeaders";

describe("mergeRequestHeaders", () => {
  it("按大小写不敏感规则合并 Authorization", () => {
    const headers = mergeRequestHeaders(
      { authorization: "Bearer session-token" },
      { Authorization: "Bearer explicit-token" },
    );
    expect(headers).toEqual({ authorization: "Bearer explicit-token" });
    expect(new Headers(headers).get("authorization")).toBe("Bearer explicit-token");
  });

  it("保留普通 Header 并允许调用方覆盖", () => {
    expect(mergeRequestHeaders(
      { "x-pm-random": "base", accept: "application/json" },
      { "X-PM-RANDOM": "override", "x-pm-device-id": "device" },
    )).toEqual({
      "x-pm-random": "override",
      accept: "application/json",
      "x-pm-device-id": "device",
    });
  });
});
```

- [x] **Step 2: 添加独立 Vitest 配置和命令并确认测试因模块缺失失败**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/system/requestHeaders.test.ts"],
    environment: "node",
  },
});
```

Run: `pnpm --dir yixi test:system-client`

Expected: FAIL，提示无法解析 `./requestHeaders`。

- [x] **Step 3: 实现最小的大小写归一化合并函数**

```ts
export function mergeRequestHeaders(
  baseHeaders: Record<string, string> = {},
  overrideHeaders: Record<string, string> = {},
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of [baseHeaders, overrideHeaders]) {
    for (const [name, value] of Object.entries(source)) {
      merged[name.toLowerCase()] = value;
    }
  }
  return merged;
}
```

- [x] **Step 4: 运行聚焦测试**

Run: `pnpm --dir yixi test:system-client`

Expected: PASS，2 个测试全部通过。

### Task 2: 系统请求接入统一鉴权 Header

**Files:**
- Modify: `yixi/electron/system/systemClient.ts:31-37,326-510,621-660`
- Modify: `yixi/electron/listenTogether/listenTogetherHttpClient.ts:100-141`
- Modify: `yixi/AGENTS.md`

**Interfaces:**
- Consumes: Task 1 的 `mergeRequestHeaders()`；已有 `RequestOptions.token?: string`。
- Produces: `requestSystem()` 传给 Fetch 的 Header 只包含一个小写 `authorization`，其余加密头与设备头保持不变。

- [x] **Step 1: 在 `requestSystem()` 中接入统一合并**

```ts
import { mergeRequestHeaders } from "./requestHeaders";

const requestHeaders = mergeRequestHeaders(headers, options.headers);
```

替换当前对象展开合并，防止 `{ authorization, Authorization }` 同时进入 Fetch。

- [x] **Step 2: 将系统账号调用迁移到 `token` 参数**

```ts
const response = await requestSystem<AccountAuthResult>("/api/auth/refresh", {
  method: "POST",
  token: session.token,
});
```

账号刷新、资料验证码、资料更新、头像凭证、密码修改、分享创建、可选账号故障上报以及同步 GET/POST 都使用相同写法；同步请求的 `headers` 只保留 `x-pm-device-id`。

- [x] **Step 3: 将一起听鉴权调用迁移到 `token` 参数**

```ts
const response = await requestSystem<{ room: ListenTogetherRoom }>(path, {
  token: session.token,
});
```

创建房间和查询房间均不再手写 `Authorization`。

同时在 `yixi/AGENTS.md` 固化规则：`requestSystem()` 调用方使用 `token`，不得在 `headers` 中重复手写账号 Authorization。

- [x] **Step 4: 运行聚焦测试与静态检查**

Run: `pnpm --dir yixi test:system-client`

Expected: PASS。

Run: `rg -n 'Authorization:\s*`Bearer' yixi/electron --glob '*.ts'`

Expected: 只允许非 `requestSystem()` 场景保留显式 Bearer；系统请求及一起听 HTTP 客户端无匹配。

Run: `git diff --check`

Expected: 无输出，退出码为 0。

### Task 3: 最终复核

**Files:**
- Review: `yixi/electron/system/requestHeaders.ts`
- Review: `yixi/electron/system/systemClient.ts`
- Review: `yixi/electron/listenTogether/listenTogetherHttpClient.ts`
- Review: `yixi/package.json`

**Interfaces:**
- Consumes: Task 1-2 的实现和测试结果。
- Produces: 可供用户自行启动 PC 客户端验收的修复结论。

- [x] **Step 1: 检查差异范围**

Run: `git status --short && git diff --stat && git diff -- yixi/electron/system yixi/electron/listenTogether/listenTogetherHttpClient.ts yixi/package.json`

Expected: 仅出现计划内文件以及用户原有的无关改动；不修改或清理 `.superpowers/diagnostics/`。

- [x] **Step 2: 复核运行时行为**

确认登录成功后同步请求等价于：

```text
authorization: Bearer <单个 token>
x-pm-device-id: <现有设备 ID>
x-pm-random: <现有加密随机值>
x-pm-enc-ver: 1
```

服务端仍按既有 `requireUserJwt → attachSyncAuth → user_id` 链路执行，无需迁移或清理同步数据。
