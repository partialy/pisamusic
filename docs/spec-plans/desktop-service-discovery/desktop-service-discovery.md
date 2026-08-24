# PisaMusic 桌面端服务发现长期改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已安装的 PisaMusic 桌面端通过远程 `config-v1.json` 发现 API、实时通信和自动更新地址，后续迁移业务域名时只修改远程配置，不再因地址变化重新打包。

**Architecture:** 新建独立的服务发现 Module，远程发现地址 `https://pisamusic.partialy.cn/pm-config/config-v1.json` 是正式包唯一固定的网络信任锚点。Module 负责严格校验、SQLite 缓存、版本防回退、候选节点健康探测和内置 HTTPS 兜底；`systemClient`、Socket.IO、头像地址和更新模块只依赖其稳定 Interface，不再自行维护业务服务地址。

**Tech Stack:** Electron 37、TypeScript 5.8、Node.js Fetch、Socket.IO Client、electron-updater 6、SQLite settings、Vitest 4。

## Global Constraints

- 本轮只改 `yixi/`、根 `AGENTS.md`、`yixi/AGENTS.md` 和本计划关联文档，不触碰 `pm/` 的用户现有改动。
- 正式包发现配置、API、实时通信和更新源只接受 `https:`；开发模式继续允许 `http://127.0.0.1:53380`。
- renderer 不持有服务端地址；远程配置拉取、选择、缓存和降级全部留在 Electron main。
- `config-v1.json` 是第 0 层服务发现；现有 `/api/config/bootstrap` 是第 1 层业务运行配置，不复制 gatewaySign、音源端点、公告等业务字段。
- 远程配置失败不能阻止 App 打开：依次使用合法缓存和安装包内置 HTTPS 配置；业务服务仍不可用时才进入现有本地模式。
- `configVersion` 只增不减；远程版本低于合法缓存版本时拒绝覆盖缓存，防止 CDN 旧副本回滚。
- v1 依赖 HTTPS 和固定品牌域名建立信任，不引入可手工伪造的空签名字段；Ed25519 签名属于独立的 v2 安全加固计划。
- `minimumSupportedVersion` 本轮严格校验并保存在快照中，但不改变强制更新业务规则，避免把服务发现改造扩大为版本封禁功能。
- 自动更新即使处于本地模式也必须能够使用远程发现文件中的独立更新源，保证业务 API 故障时仍可恢复客户端。
- 所有 Git 提交信息使用中文；每个任务独立验证后再提交。
- 不启动或重启应用；自动化构建完成后停在可由用户启动测试的状态。

---

## 已确认的远程契约

2026-08-24 已在线验证 `https://pisamusic.partialy.cn/pm-config/config-v1.json` 返回 `200 application/json`，内容为：

```json
{
  "schemaVersion": 1,
  "configVersion": 1,
  "publishedAt": "2026-08-24T10:35:00+08:00",
  "desktop": {
    "minimumSupportedVersion": "1.0.1",
    "healthCheckPath": "/api/health",
    "bootstrapPath": "/api/config/bootstrap",
    "serviceOrigins": [
      {
        "id": "primary",
        "priority": 100,
        "apiBaseUrl": "https://pm-server.hs.partialy.cn",
        "realtimeBaseUrl": "https://pm-server.hs.partialy.cn"
      }
    ],
    "updateFeedBaseUrls": [
      "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64"
    ]
  }
}
```

契约语义：

- `schemaVersion`：结构版本，客户端 v1 只接受整数 `1`。
- `configVersion`：发布序号，必须为正整数；每次线上修改递增。
- `publishedAt`：可被 `Date.parse` 解析的发布时间。
- `serviceOrigins`：按 `priority` 升序、原数组顺序稳定排序后探测；`id` 必须唯一。
- `apiBaseUrl` / `realtimeBaseUrl`：正式配置必须是无用户名、密码、查询串和 hash 的 HTTPS origin。
- `healthCheckPath` / `bootstrapPath`：必须以单个 `/` 开头，只允许相对路径。
- `updateFeedBaseUrls`：按数组顺序尝试，必须至少有一个 HTTPS 地址。
- URL 在内存中统一去除末尾 `/`；构造请求时使用 `new URL(path, baseUrl + "/")`。

## 文件结构与职责

### 新建文件

- `yixi/electron/system/serviceDiscovery/types.ts`：远程文档、候选 origin、最终快照和依赖 Interface。
- `yixi/electron/system/serviceDiscovery/config.ts`：纯函数校验、URL 规范化、候选排序和内置配置。
- `yixi/electron/system/serviceDiscovery/resolver.ts`：远程/缓存/内置选择、版本防回退和健康探测。
- `yixi/electron/system/serviceDiscovery/index.ts`：Electron main 单例 Adapter，连接环境变量、Fetch 和 SQLite settings。
- `yixi/electron/system/serviceDiscovery/config.test.ts`：远程 JSON 契约单元测试。
- `yixi/electron/system/serviceDiscovery/resolver.test.ts`：远程、缓存、回退和候选切换单元测试。
- `yixi/electron/updater/updaterConfig.ts`：纯函数合并 bootstrap 与服务发现的更新源。
- `yixi/electron/updater/updaterConfig.test.ts`：更新源去重、优先级和本地模式恢复测试。
- `yixi/vitest.service-discovery.config.ts`：只运行本改造相关的 Node 环境测试。
- `docs/architecture/desktop-service-discovery.md`：远程文件维护规则、降级顺序和故障处理说明。

### 修改文件

- `yixi/electron/main.ts`：业务启动检查前初始化服务发现 Module。
- `yixi/electron/system/systemClient.ts`：所有系统请求从快照读取 API 地址和 bootstrap path，禁止重定向。
- `yixi/electron/listenTogether/listenTogetherSocketClient.ts`：使用 `realtimeBaseUrl`。
- `yixi/electron/listenTogether/listenTogetherAvatar.ts`：相对头像使用 `apiBaseUrl`。
- `yixi/electron/updater/updaterService.ts`：使用远程更新源并允许本地模式检查更新。
- `yixi/electron/ipc/systemIpc.ts`：移除未使用的 base URL IPC，避免 renderer 获得地址。
- `yixi/electron/preload.ts`：移除 `getSystemBaseUrl` 暴露。
- `yixi/src/types/electron.d.ts`：删除对应 renderer 类型。
- `yixi/package.json`：新增 `test:service-discovery` 命令。
- `yixi/AGENTS.md`：替换过时硬编码说明，记录服务发现 Interface 和运行规则。
- `AGENTS.md`：补充桌面端第 0 层服务发现契约和远程文件维护约束。

## Interface 冻结

调用方只依赖以下 Interface；远程拉取、缓存、校验和探测均属于 Module 内部 Implementation：

```ts
export type ServiceDiscoverySnapshot = {
  source: "environment" | "development" | "remote" | "cache" | "embedded";
  schemaVersion: 1;
  configVersion: number;
  publishedAt: string;
  minimumSupportedVersion: string;
  originId: string;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
  healthCheckPath: string;
  bootstrapPath: string;
  updateFeedBaseUrls: string[];
};

export async function initializeServiceDiscovery(): Promise<ServiceDiscoverySnapshot>;
export async function refreshServiceDiscovery(): Promise<ServiceDiscoverySnapshot>;
export function getServiceDiscoverySnapshot(): ServiceDiscoverySnapshot;
```

Interface 不暴露缓存读写、远程文档原始结构和候选探测方法。`getServiceDiscoverySnapshot()` 在初始化前调用必须抛出明确错误，以便测试发现启动时序回归。

## 可并行执行波次

- Wave 1：Task 1，冻结契约、测试入口和纯校验器。
- Wave 2：Task 2，实现解析与服务发现核心；该任务完成前不要改调用方。
- Wave 3：Task 3 与 Task 4 可分配给两个 Agent，文件所有权互斥：Task 3 只改 main/system，Task 4 只改 listenTogether/updater。
- Wave 4：Task 5，清理 renderer 暴露并维护文档。
- Wave 5：Task 6，统一验证、审计硬编码并停在待用户启动状态。

---

### Task 1: 建立服务发现契约与独立测试入口

**Files:**
- Create: `yixi/electron/system/serviceDiscovery/types.ts`
- Create: `yixi/electron/system/serviceDiscovery/config.test.ts`
- Create: `yixi/vitest.service-discovery.config.ts`
- Modify: `yixi/package.json`

**Interfaces:**
- Consumes: 已上线的 `config-v1.json` 字段。
- Produces: `DiscoveryDocumentV1`、`ServiceOriginV1`、`ServiceDiscoverySnapshot`、`ServiceDiscoveryDependencies`。

- [ ] **Step 1: 定义 v1 类型和 Module 外部快照**

在 `types.ts` 写入完整类型：

```ts
export type ServiceOriginV1 = {
  id: string;
  priority: number;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
};

export type DiscoveryDocumentV1 = {
  schemaVersion: 1;
  configVersion: number;
  publishedAt: string;
  desktop: {
    minimumSupportedVersion: string;
    healthCheckPath: string;
    bootstrapPath: string;
    serviceOrigins: ServiceOriginV1[];
    updateFeedBaseUrls: string[];
  };
};

export type DiscoverySource =
  | "environment"
  | "development"
  | "remote"
  | "cache"
  | "embedded";

export type ServiceDiscoverySnapshot = {
  source: DiscoverySource;
  schemaVersion: 1;
  configVersion: number;
  publishedAt: string;
  minimumSupportedVersion: string;
  originId: string;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
  healthCheckPath: string;
  bootstrapPath: string;
  updateFeedBaseUrls: string[];
};

export type ServiceDiscoveryDependencies = {
  fetchRemoteDocument: () => Promise<unknown>;
  readCachedDocument: () => unknown | null;
  writeCachedDocument: (document: DiscoveryDocumentV1) => void;
  probeHealth: (url: string) => Promise<boolean>;
};
```

- [ ] **Step 2: 新建 Vitest 配置并增加脚本**

`vitest.service-discovery.config.ts`：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "electron/system/serviceDiscovery/**/*.test.ts",
      "electron/updater/updaterConfig.test.ts",
    ],
    environment: "node",
  },
});
```

在 `package.json` 的 scripts 中增加：

```json
"test:service-discovery": "vitest run --config vitest.service-discovery.config.ts"
```

- [ ] **Step 3: 写入首批失败测试**

`config.test.ts` 至少包含以下测试：

```ts
import { describe, expect, it } from "vitest";
import { parseDiscoveryDocument } from "./config";

const validDocument = {
  schemaVersion: 1,
  configVersion: 1,
  publishedAt: "2026-08-24T10:35:00+08:00",
  desktop: {
    minimumSupportedVersion: "1.0.1",
    healthCheckPath: "/api/health",
    bootstrapPath: "/api/config/bootstrap",
    serviceOrigins: [{
      id: "primary",
      priority: 100,
      apiBaseUrl: "https://pm-server.hs.partialy.cn",
      realtimeBaseUrl: "https://pm-server.hs.partialy.cn",
    }],
    updateFeedBaseUrls: [
      "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
    ],
  },
};

describe("parseDiscoveryDocument", () => {
  it("接受当前线上 v1 文档", () => {
    expect(parseDiscoveryDocument(validDocument)).toEqual(validDocument);
  });

  it("拒绝 HTTP API 地址", () => {
    const input = structuredClone(validDocument);
    input.desktop.serviceOrigins[0].apiBaseUrl = "http://pm-server.hs.partialy.cn";
    expect(() => parseDiscoveryDocument(input)).toThrow(
      "desktop.serviceOrigins[0].apiBaseUrl 必须使用 HTTPS",
    );
  });

  it("拒绝重复 origin id", () => {
    const input = structuredClone(validDocument);
    input.desktop.serviceOrigins.push({
      ...input.desktop.serviceOrigins[0],
      priority: 200,
    });
    expect(() => parseDiscoveryDocument(input)).toThrow(
      "desktop.serviceOrigins id 不能重复：primary",
    );
  });

  it("拒绝空更新源数组", () => {
    const input = structuredClone(validDocument);
    input.desktop.updateFeedBaseUrls = [];
    expect(() => parseDiscoveryDocument(input)).toThrow("desktop.updateFeedBaseUrls");
  });
});
```

- [ ] **Step 4: 运行测试确认失败原因正确**

Run:

```powershell
pnpm --dir yixi test:service-discovery
```

Expected: FAIL，错误为无法解析 `./config`，而不是 Vitest 配置错误。

- [ ] **Step 5: 提交契约与测试骨架**

```powershell
git add yixi/electron/system/serviceDiscovery/types.ts yixi/electron/system/serviceDiscovery/config.test.ts yixi/vitest.service-discovery.config.ts yixi/package.json
git commit -m "测试：建立桌面端服务发现契约"
```

---

### Task 2: 实现严格解析、缓存选择和健康探测

**Files:**
- Create: `yixi/electron/system/serviceDiscovery/config.ts`
- Create: `yixi/electron/system/serviceDiscovery/resolver.ts`
- Create: `yixi/electron/system/serviceDiscovery/resolver.test.ts`
- Create: `yixi/electron/system/serviceDiscovery/index.ts`
- Modify: `yixi/electron/system/serviceDiscovery/config.test.ts`

**Interfaces:**
- Consumes: Task 1 的类型。
- Produces: `parseDiscoveryDocument()`、`resolveServiceDiscovery()`、`initializeServiceDiscovery()`、`refreshServiceDiscovery()`、`getServiceDiscoverySnapshot()`。

- [ ] **Step 1: 实现纯校验器和内置配置**

`config.ts` 必须导出：

```ts
export const DISCOVERY_DOCUMENT_URL =
  "https://pisamusic.partialy.cn/pm-config/config-v1.json";

export const EMBEDDED_DISCOVERY_DOCUMENT: DiscoveryDocumentV1 = {
  schemaVersion: 1,
  configVersion: 1,
  publishedAt: "2026-08-24T10:35:00+08:00",
  desktop: {
    minimumSupportedVersion: "1.0.1",
    healthCheckPath: "/api/health",
    bootstrapPath: "/api/config/bootstrap",
    serviceOrigins: [{
      id: "primary",
      priority: 100,
      apiBaseUrl: "https://pm-server.hs.partialy.cn",
      realtimeBaseUrl: "https://pm-server.hs.partialy.cn",
    }],
    updateFeedBaseUrls: [
      "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
    ],
  },
};

export function parseDiscoveryDocument(input: unknown): DiscoveryDocumentV1;
export function sortServiceOrigins(document: DiscoveryDocumentV1): ServiceOriginV1[];
```

实现要求：

```ts
function normalizeHttpsBaseUrl(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} 不能为空`);
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error(`${field} 必须使用 HTTPS`);
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${field} 不能包含认证信息、查询参数或 hash`);
  }
  return url.toString().replace(/\/+$/, "");
}
```

同时校验正整数版本、可解析日期、`x.y.z` 最低版本、唯一非空 id、有限整数 priority、相对路径以及非空更新源数组。返回全新普通对象，不把未知字段继续传入运行时。

- [ ] **Step 2: 完成解析器测试**

补齐下列场景：

```ts
it("按 priority 稳定排序候选 origin", () => {
  const input = structuredClone(validDocument);
  input.desktop.serviceOrigins = [
    { ...input.desktop.serviceOrigins[0], id: "third", priority: 300 },
    { ...input.desktop.serviceOrigins[0], id: "first", priority: 100 },
    { ...input.desktop.serviceOrigins[0], id: "second", priority: 100 },
  ];
  expect(sortServiceOrigins(parseDiscoveryDocument(input)).map((item) => item.id))
    .toEqual(["first", "second", "third"]);
});

it("拒绝非 1 schemaVersion", () => {
  expect(() => parseDiscoveryDocument({ ...validDocument, schemaVersion: 2 }))
    .toThrow("schemaVersion 只支持 1");
});

it("拒绝 configVersion=0", () => {
  expect(() => parseDiscoveryDocument({ ...validDocument, configVersion: 0 }))
    .toThrow("configVersion 必须是正整数");
});

it("拒绝 HTTP realtime 和 update feed", () => {
  const realtimeInput = structuredClone(validDocument);
  realtimeInput.desktop.serviceOrigins[0].realtimeBaseUrl = "http://socket.example.com";
  expect(() => parseDiscoveryDocument(realtimeInput)).toThrow("realtimeBaseUrl 必须使用 HTTPS");

  const feedInput = structuredClone(validDocument);
  feedInput.desktop.updateFeedBaseUrls = ["http://updates.example.com/feed"];
  expect(() => parseDiscoveryDocument(feedInput)).toThrow("updateFeedBaseUrls[0] 必须使用 HTTPS");
});

it("拒绝完整 URL 形式的 healthCheckPath", () => {
  const input = structuredClone(validDocument);
  input.desktop.healthCheckPath = "https://example.com/api/health";
  expect(() => parseDiscoveryDocument(input)).toThrow("healthCheckPath 必须是相对路径");
});

it("丢弃远程未知字段", () => {
  const parsed = parseDiscoveryDocument({ ...validDocument, unexpectedSecret: "discard-me" });
  expect("unexpectedSecret" in parsed).toBe(false);
});
```

- [ ] **Step 3: 写 resolver 失败测试**

`resolver.test.ts` 使用注入依赖，不导入 Electron：

```ts
import { describe, expect, it, vi } from "vitest";
import { EMBEDDED_DISCOVERY_DOCUMENT } from "./config";
import { resolveServiceDiscovery } from "./resolver";
import type { DiscoveryDocumentV1 } from "./types";

it("正式环境优先使用可达的远程配置", async () => {
  const result = await resolveServiceDiscovery(
    { mode: "production", explicitBaseUrl: "" },
    {
      fetchRemoteDocument: vi.fn().mockResolvedValue(EMBEDDED_DISCOVERY_DOCUMENT),
      readCachedDocument: vi.fn().mockReturnValue(null),
      writeCachedDocument: vi.fn(),
      probeHealth: vi.fn().mockResolvedValue(true),
    },
  );
  expect(result.source).toBe("remote");
  expect(result.apiBaseUrl).toBe("https://pm-server.hs.partialy.cn");
});
```

再增加以下完整用例；测试文件先定义 `makeDocument()` 与 `makeDependencies()`，避免每个用例重复样板：

```ts
function makeDocument(configVersion = 1) {
  return {
    ...structuredClone(EMBEDDED_DISCOVERY_DOCUMENT),
    configVersion,
  };
}

function makeDependencies() {
  return {
    fetchRemoteDocument: vi.fn<() => Promise<unknown>>(),
    readCachedDocument: vi.fn<() => unknown | null>().mockReturnValue(null),
    writeCachedDocument: vi.fn<(document: DiscoveryDocumentV1) => void>(),
    probeHealth: vi.fn<(url: string) => Promise<boolean>>().mockResolvedValue(true),
  };
}

it("远程失败时使用合法缓存", async () => {
  const dependencies = makeDependencies();
  dependencies.fetchRemoteDocument.mockRejectedValue(new Error("offline"));
  dependencies.readCachedDocument.mockReturnValue(makeDocument(2));
  const result = await resolveServiceDiscovery(
    { mode: "production", explicitBaseUrl: "" },
    dependencies,
  );
  expect(result.source).toBe("cache");
  expect(result.configVersion).toBe(2);
});

it("远程和缓存都非法时使用 embedded", async () => {
  const dependencies = makeDependencies();
  dependencies.fetchRemoteDocument.mockResolvedValue({});
  dependencies.readCachedDocument.mockReturnValue({ schemaVersion: 99 });
  const result = await resolveServiceDiscovery(
    { mode: "production", explicitBaseUrl: "" },
    dependencies,
  );
  expect(result.source).toBe("embedded");
  expect(result.configVersion).toBe(EMBEDDED_DISCOVERY_DOCUMENT.configVersion);
});

it("远程 configVersion 低于缓存时使用缓存", async () => {
  const dependencies = makeDependencies();
  dependencies.fetchRemoteDocument.mockResolvedValue(makeDocument(2));
  dependencies.readCachedDocument.mockReturnValue(makeDocument(3));
  const result = await resolveServiceDiscovery(
    { mode: "production", explicitBaseUrl: "" },
    dependencies,
  );
  expect(result.source).toBe("cache");
  expect(result.configVersion).toBe(3);
  expect(dependencies.writeCachedDocument).not.toHaveBeenCalled();
});

it("第一候选健康检查失败时选择下一候选", async () => {
  const document = makeDocument();
  document.desktop.serviceOrigins.push({
    id: "backup",
    priority: 200,
    apiBaseUrl: "https://backup-api.example.com",
    realtimeBaseUrl: "https://backup-socket.example.com",
  });
  const dependencies = makeDependencies();
  dependencies.fetchRemoteDocument.mockResolvedValue(document);
  dependencies.probeHealth.mockImplementation(async (url) => url.includes("backup-api"));
  const result = await resolveServiceDiscovery(
    { mode: "production", explicitBaseUrl: "" },
    dependencies,
  );
  expect(result.originId).toBe("backup");
});

it("所有候选不可达时仍返回第一候选", async () => {
  const dependencies = makeDependencies();
  dependencies.fetchRemoteDocument.mockResolvedValue(makeDocument());
  dependencies.probeHealth.mockResolvedValue(false);
  const result = await resolveServiceDiscovery(
    { mode: "production", explicitBaseUrl: "" },
    dependencies,
  );
  expect(result.originId).toBe("primary");
});

it("开发模式不拉远程配置并返回 localhost", async () => {
  const dependencies = makeDependencies();
  const result = await resolveServiceDiscovery(
    { mode: "development", explicitBaseUrl: "" },
    dependencies,
  );
  expect(result.source).toBe("development");
  expect(result.apiBaseUrl).toBe("http://127.0.0.1:53380");
  expect(dependencies.fetchRemoteDocument).not.toHaveBeenCalled();
});

it("显式环境变量覆盖开发默认地址", async () => {
  const result = await resolveServiceDiscovery(
    { mode: "development", explicitBaseUrl: "http://127.0.0.1:59999" },
    makeDependencies(),
  );
  expect(result.source).toBe("environment");
  expect(result.apiBaseUrl).toBe("http://127.0.0.1:59999");
});
```

- [ ] **Step 4: 实现纯 resolver**

`resolver.ts` 导出：

```ts
export type ResolveServiceDiscoveryInput = {
  mode: "development" | "production";
  explicitBaseUrl: string;
};

export async function resolveServiceDiscovery(
  input: ResolveServiceDiscoveryInput,
  dependencies: ServiceDiscoveryDependencies,
): Promise<ServiceDiscoverySnapshot>;
```

核心顺序必须固定：

```ts
// 1. explicitBaseUrl 非空：仅允许 production=https；development 允许 localhost http。
// 2. development 无覆盖：返回 http://127.0.0.1:53380。
// 3. production：分别安全解析 remote 和 cache。
// 4. remote.configVersion < cache.configVersion 时选择 cache，否则选择 remote。
// 5. remote 可用且未回退时写入 cache；缓存写失败只记录，不影响返回。
// 6. remote/cache 均不可用时选择 EMBEDDED_DISCOVERY_DOCUMENT。
// 7. 对选中文档的 origins 按顺序调用 probeHealth，选择首个成功项；全部失败则保留第一项。
```

健康 URL 使用：

```ts
const healthUrl = new URL(
  document.desktop.healthCheckPath,
  `${origin.apiBaseUrl}/`,
).toString();
```

- [ ] **Step 5: 实现 Electron main 单例 Adapter**

`index.ts` 使用常量：

```ts
const CACHE_KEY = "desktop-service-discovery-cache-v1";
const DISCOVERY_TIMEOUT_MS = 5_000;
const HEALTH_TIMEOUT_MS = 3_000;
```

连接真实依赖：

```ts
fetchRemoteDocument: async () => {
  const response = await fetch(DISCOVERY_DOCUMENT_URL, {
    method: "GET",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`服务发现配置请求失败：HTTP ${response.status}`);
  return response.json();
},
readCachedDocument: () =>
  getAppDatabase().getSetting<unknown>(CACHE_KEY)?.value ?? null,
writeCachedDocument: (document) =>
  void getAppDatabase().setSetting(CACHE_KEY, document, document.configVersion),
probeHealth: async (url) => {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
},
```

单例规则：

```ts
let snapshot: ServiceDiscoverySnapshot | null = null;
let pending: Promise<ServiceDiscoverySnapshot> | null = null;

export function getServiceDiscoverySnapshot() {
  if (!snapshot) throw new Error("服务发现尚未初始化");
  return snapshot;
}
```

`initializeServiceDiscovery()` 合并并发初始化；`refreshServiceDiscovery()` 强制重新执行 resolver。日志只记录 source、configVersion、originId 和 origin，不记录 token 或响应正文。

两者调用 resolver 时使用同一份明确输入：

```ts
function createResolveInput() {
  return {
    mode: app.isPackaged ? "production" as const : "development" as const,
    explicitBaseUrl: String(
      process.env.PISA_SERVER_URL ?? process.env.PM_SERVER_URL ?? "",
    ).trim(),
  };
}
```

- [ ] **Step 6: 运行测试并提交核心 Module**

```powershell
pnpm --dir yixi test:service-discovery
git add yixi/electron/system/serviceDiscovery
git commit -m "功能：实现桌面端远程服务发现"
```

Expected: 所有 serviceDiscovery 测试 PASS。

---

### Task 3: 接入启动时序与系统请求

**Files:**
- Modify: `yixi/electron/main.ts`
- Modify: `yixi/electron/system/systemClient.ts`

**Interfaces:**
- Consumes: `initializeServiceDiscovery()` 和 `getServiceDiscoverySnapshot()`。
- Produces: 启动前完成的地址快照，以及禁止重定向的系统请求链路。

- [ ] **Step 1: 在业务探测之前初始化 Module**

`main.ts` 导入并调整启动顺序：

```ts
import { initializeServiceDiscovery } from "./system/serviceDiscovery";

async function launchAppRuntime() {
  if (appRuntimeStarted) return;
  appRuntimeStarted = true;
  startupWindow.showLoading();
  try {
    await initializeServiceDiscovery();
    await prepareStartupServiceState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "当前设备不可用";
    dialog.showErrorBox("PisaMusic", message);
    quitApplication();
    return;
  }
  // 后续创建窗口逻辑保持原样。
}
```

服务发现本身通过 embedded 保证返回；只有设备封禁等原有终止条件才退出 App。

- [ ] **Step 2: 移除 systemClient 的业务域名常量**

删除：

```ts
const DEV_SERVER_URL = "http://127.0.0.1:53380";
const PRODUCTION_SERVER_URL = "http://pm-server.hs.partialy.cn/";
```

替换为：

```ts
import { getServiceDiscoverySnapshot } from "./serviceDiscovery";

function getApiBaseUrl() {
  return `${getServiceDiscoverySnapshot().apiBaseUrl}/`;
}

// Task 5 删除 renderer 兼容 IPC 前暂时保留，确保本任务可以独立构建。
export function getSystemBaseUrl() {
  return getApiBaseUrl();
}
```

`refreshBootstrap()` 使用远程配置的 path：

```ts
export async function refreshBootstrap() {
  const { bootstrapPath } = getServiceDiscoverySnapshot();
  const response = await requestSystem<BootstrapConfig>(bootstrapPath);
  cachedBootstrap = unwrapResponse(response);
  return cachedBootstrap;
}
```

- [ ] **Step 3: 替换全部系统 URL 构造点**

精确替换：

```ts
new URL("/api/feedback", getApiBaseUrl())
new URL(path, getApiBaseUrl())
new URL(raw, getApiBaseUrl())
```

覆盖 `submitFeedback()`、`requestSystem()` 和 `absoluteSystemUrl()`；不要改变 gateway 的 `rawUrl` 逻辑，因为音源地址来自第 1 层 bootstrap。

- [ ] **Step 4: 禁止系统 POST 静默跟随重定向**

在 `requestSystem()` 与 `submitFeedback()` 的 fetch 选项中增加：

```ts
redirect: "error",
```

这样将来误配 HTTP 或代理重定向时会记录网络错误并进入现有降级，而不会再次把 POST 改成 GET。

- [ ] **Step 5: 类型检查并提交系统接入**

```powershell
pnpm --dir yixi build:t
git add yixi/electron/main.ts yixi/electron/system/systemClient.ts
git commit -m "功能：系统请求接入远程服务发现"
```

Expected: `vue-tsc` 与 `electron-vite build` 均成功；不出现 `getSystemBaseUrl` 未解析错误。

---

### Task 4: 接入实时通信、头像与独立更新恢复链路

**Files:**
- Modify: `yixi/electron/listenTogether/listenTogetherSocketClient.ts`
- Modify: `yixi/electron/listenTogether/listenTogetherAvatar.ts`
- Create: `yixi/electron/updater/updaterConfig.ts`
- Create: `yixi/electron/updater/updaterConfig.test.ts`
- Modify: `yixi/electron/updater/updaterService.ts`

**Interfaces:**
- Consumes: `getServiceDiscoverySnapshot()`。
- Produces: 实时通信使用独立 origin；自动更新在 API 本地模式下仍可按候选 feed 工作。

- [ ] **Step 1: 切换 Socket.IO 和头像 origin**

Socket：

```ts
import { getServiceDiscoverySnapshot } from "../system/serviceDiscovery";

const client = io(getServiceDiscoverySnapshot().realtimeBaseUrl, {
  transports: ["websocket"],
  auth: { token: `Bearer ${token}` },
});
```

头像：

```ts
function getAccountAssetBaseUrl() {
  return `${getServiceDiscoverySnapshot().apiBaseUrl}/`;
}
```

相对头像和默认头像都基于 `getAccountAssetBaseUrl()`；外部 `https:`、`data:`、`blob:` 地址保持现状。

- [ ] **Step 2: 先写更新配置纯函数测试**

`updaterConfig.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { resolveUpdaterFeedCandidates } from "./updaterConfig";

describe("resolveUpdaterFeedCandidates", () => {
  it("bootstrap feed 优先并与发现配置去重", () => {
    expect(resolveUpdaterFeedCandidates(
      "https://updates.example.com/feed/",
      ["https://updates.example.com/feed", "https://backup.example.com/feed"],
    )).toEqual([
      "https://updates.example.com/feed",
      "https://backup.example.com/feed",
    ]);
  });

  it("bootstrap 不可用时仍返回发现配置 feed", () => {
    expect(resolveUpdaterFeedCandidates("", ["https://updates.example.com/feed"]))
      .toEqual(["https://updates.example.com/feed"]);
  });
});
```

- [ ] **Step 3: 实现更新源合并函数**

`updaterConfig.ts`：

```ts
function normalizeFeedUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("自动更新地址必须使用 HTTPS");
  return url.toString().replace(/\/+$/, "");
}

export function resolveUpdaterFeedCandidates(
  bootstrapFeedBaseUrl: string,
  discoveryFeedBaseUrls: string[],
) {
  const values = [bootstrapFeedBaseUrl, ...discoveryFeedBaseUrls]
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeFeedUrl);
  return [...new Set(values)];
}
```

- [ ] **Step 4: updater 移除硬编码 fallback 与本地模式禁用条件**

删除：

```ts
const FALLBACK_FEED_BASE_URL = "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64";
```

删除 `getStartupServiceState().localMode` 导致 updater disabled 的分支。更新候选来自：

```ts
const discoveryFeeds = getServiceDiscoverySnapshot().updateFeedBaseUrls;
const feeds = resolveUpdaterFeedCandidates(
  bootstrap?.updater?.desktop?.feedBaseUrl ?? "",
  discoveryFeeds,
);
```

保留 `app.isPackaged && win32 && x64`、后台 `enabled`、`checkOnStartup` 和 `startupDelayMs` 规则。
同步从 `updaterService.ts` import 中删除不再使用的 `getStartupServiceState`。

- [ ] **Step 5: 对候选 feed 顺序执行检查**

抽取唯一检查函数，手动与启动检查都调用它：

```ts
async function checkForUpdatesWithFallback(
  feeds: string[],
  getMainWindow: () => BrowserWindow | null,
  manual: boolean,
) {
  let lastError: unknown = new Error("没有可用的自动更新地址");
  for (const feedUrl of feeds) {
    try {
      autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
      setState(getMainWindow, { feedUrl, manual, error: "" });
      await autoUpdater.checkForUpdates();
      return;
    } catch (error) {
      lastError = error;
      logger.warn(`自动更新源不可用，准备尝试下一个：${feedUrl}`);
    }
  }
  throw lastError;
}
```

增加 `checkingFallbackFeeds` 布尔状态；`autoUpdater.on("error")` 在候选循环期间只写日志，不提前把 UI 固定为 error，全部失败后由外层统一设置最终错误。

- [ ] **Step 6: 运行测试、构建并提交消费者迁移**

```powershell
pnpm --dir yixi test:service-discovery
pnpm --dir yixi build:t
git add yixi/electron/listenTogether yixi/electron/updater
git commit -m "功能：实时通信和更新接入服务发现"
```

Expected: 更新配置测试 PASS，构建成功，`updaterService.ts` 不再含业务更新域名常量。

---

### Task 5: 收紧 renderer Interface 并同步项目文档

**Files:**
- Modify: `yixi/electron/ipc/systemIpc.ts`
- Modify: `yixi/electron/preload.ts`
- Modify: `yixi/src/types/electron.d.ts`
- Create: `docs/architecture/desktop-service-discovery.md`
- Modify: `yixi/AGENTS.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: 已完成的 main 服务发现 Module。
- Produces: renderer 不可见的地址 seam，以及可维护的远程配置操作说明。

- [ ] **Step 1: 删除未使用的 base URL IPC**

从 `systemIpc.ts` 删除 `getSystemBaseUrl` 导入和：

```ts
ipcMain.handle("system:get-base-url", () => {
  return getSystemBaseUrl();
});
```

随后从 `systemClient.ts` 删除 Task 3 暂留的 `getSystemBaseUrl()` 兼容导出；main 内部 URL 构造继续使用私有 `getApiBaseUrl()`。

从 `preload.ts` 删除：

```ts
getSystemBaseUrl: () => ipcRenderer.invoke("system:get-base-url"),
```

从 `electron.d.ts` 删除：

```ts
getSystemBaseUrl: () => Promise<string>;
```

删除前使用 `rg -n "getSystemBaseUrl" yixi/src yixi/electron` 再确认 renderer 无调用方。

- [ ] **Step 2: 编写运维文档**

`docs/architecture/desktop-service-discovery.md` 必须明确：

```text
远程地址：https://pisamusic.partialy.cn/pm-config/config-v1.json
修改规则：先修改地址，再递增 configVersion，最后更新 publishedAt
origin 顺序：priority 越小越优先
客户端降级：environment/development → remote → cache → embedded
缓存位置：SQLite settings，key=desktop-service-discovery-cache-v1
正式 URL：仅 HTTPS，不允许认证信息、query、hash
发布验证：JSON 200、Content-Type application/json、API health 200、latest.yml 可达
回滚规则：修复内容时继续递增 configVersion，不能恢复旧数字
```

同时记录 `minimumSupportedVersion` 本轮不执行强制升级，以及 v1 没有签名的明确安全模型。

- [ ] **Step 3: 更新 yixi 上下文**

将 `yixi/AGENTS.md` 中正式 HTTP 硬编码说明替换为：

```text
正式包通过 https://pisamusic.partialy.cn/pm-config/config-v1.json 做第 0 层服务发现；
systemClient、一起听 Socket、账号相对头像和 updater 只能读取 serviceDiscovery 快照。
远程失败按 cache → embedded 降级，业务探测失败才进入本地模式。
本地模式仍允许自动更新，避免 API 故障时失去客户端恢复通道。
开发环境变量 PISA_SERVER_URL / PM_SERVER_URL 仍可覆盖本地服务地址。
```

修正第 147、209、212 行附近与新行为冲突的旧描述。

- [ ] **Step 4: 更新根上下文**

在根 `AGENTS.md` 的 PC 桌面端章节补充第 0 层发现文件、字段维护规则、缓存防回退和“不得重新在调用方硬编码业务域名”的约束。

- [ ] **Step 5: 构建并提交 Interface 清理与文档**

```powershell
pnpm --dir yixi build:t
git add yixi/electron/ipc/systemIpc.ts yixi/electron/preload.ts yixi/src/types/electron.d.ts docs/architecture/desktop-service-discovery.md yixi/AGENTS.md AGENTS.md
git commit -m "文档：记录桌面端服务发现与降级规则"
```

Expected: 构建成功，renderer 类型中不再暴露服务端 base URL。

---

### Task 6: 全量审计、线上契约测试与交付边界

**Files:**
- Modify only if verification exposes a defect in Task 1-5 files.

**Interfaces:**
- Consumes: 所有前置任务。
- Produces: 自动化验证证据和待用户手动测试清单。

- [ ] **Step 1: 审计残留硬编码**

Run:

```powershell
rg -n -g "!node_modules/**" -g "!out/**" -g "!app/**" -e "http://pm-server\.hs\.partialy\.cn" -e "https://pm-server\.hs\.partialy\.cn" -e "pm\.hs\.partialy\.cn/api/config/desktop-updates" yixi
```

Expected:

- `pm-server` 只允许出现在 `serviceDiscovery/config.ts` 的 embedded 配置和对应测试。
- 更新 feed 只允许出现在 embedded 配置、测试和 `electron-builder.config.js` 的构建期 publish fallback。
- `systemClient.ts`、`listenTogetherSocketClient.ts`、`listenTogetherAvatar.ts`、`updaterService.ts` 不得出现这些域名。

- [ ] **Step 2: 运行服务发现测试**

```powershell
pnpm --dir yixi test:service-discovery
```

Expected: parser、resolver、updaterConfig 全部 PASS，覆盖 remote/cache/embedded、版本防回退、origin 探测和 feed 去重。

- [ ] **Step 3: 运行类型检查和 Electron 构建**

```powershell
pnpm --dir yixi build:t
```

Expected: `vue-tsc -b` 与 `electron-vite build` 均退出 0。

- [ ] **Step 4: 只读验证线上发现文件**

```powershell
$config = Invoke-RestMethod -Headers @{ "Cache-Control" = "no-cache" } -Uri "https://pisamusic.partialy.cn/pm-config/config-v1.json"
$config.schemaVersion
$config.configVersion
$config.desktop.serviceOrigins[0].apiBaseUrl
Invoke-RestMethod -Uri "$($config.desktop.serviceOrigins[0].apiBaseUrl)$($config.desktop.healthCheckPath)"
```

Expected:

```text
1
大于等于 1
https://pm-server.hs.partialy.cn
success = true, code = 0
```

- [ ] **Step 5: 构建 Windows 安装包但不启动**

```powershell
pnpm --dir yixi build:win
```

Expected: `yixi/app/` 下生成 NSIS 安装包和 unpacked 目录；不要执行安装包，不启动 App。

- [ ] **Step 6: 向用户交付手动验证清单**

用户启动后按顺序验证：

```text
1. 正常网络启动不再出现“服务不可用”。
2. 密码登录、验证码登录和注册请求不再出现 Not Found。
3. 账号头像相对地址能正常显示。
4. 一起听能建立 websocket 连接并正常进房。
5. 手动检查更新显示当前 feed，API 本地模式下仍可检查更新。
6. 临时把远程 primary 指向不可达地址并追加可达 backup，递增 configVersion 后验证自动选择 backup。
7. 恢复 primary 时再次递增 configVersion，不能把 configVersion 改回旧值。
8. 断网启动验证缓存；清空缓存且断网启动验证 embedded；两种情况下本地功能仍可进入。
```

- [ ] **Step 7: 最终提交验证中产生的必要修正**

仅当 Step 1-5 暴露并修复了缺陷时执行：

```powershell
git add yixi AGENTS.md docs/architecture/desktop-service-discovery.md
git commit -m "修复：完善桌面端服务发现验证"
```

不要提交 `yixi/app/` 构建产物、SQLite 数据库、日志或用户已有的 `pm/` 修改。

## 自检结论

- 契约覆盖：远程文件全部字段都有校验与明确消费位置；`minimumSupportedVersion` 明确只保留元数据，不隐式改变业务。
- 故障覆盖：远程不可用、JSON 非法、缓存非法、CDN 旧版本、primary 不可达、业务 API 不可达、更新源不可达均有确定路径。
- 安全覆盖：正式地址只接受 HTTPS，禁止重定向，不向 renderer 暴露地址，不在公开发现文件存放敏感配置。
- 恢复覆盖：API 本地模式仍可走独立更新源；远程、缓存和 embedded 三层均可启动。
- 文档覆盖：根与 yixi 上下文、独立架构文档和远程维护流程同步更新。
- 交付边界：自动化检查与打包后停止，由用户安装、启动并完成手动联调。
