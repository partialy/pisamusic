# Server 后台统计仪表盘与官网访问分析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`（推荐）或 `executing-plans` 按任务逐项实施。Steps use checkbox (`- [ ]`) syntax for tracking；每个任务完成验证后按计划单独提交。

**Goal:** 为 `server/admin` 增加默认仪表盘页面，展示用户、设备、官网下载和官网日访问趋势，并补充运营健康、版本分布、转化率、同步规模和存储规模等必要指标。

**Architecture:** 统计原始事件继续写入外层统一 SQLite `pm.db`：官网访问、官网下载、设备日活分别使用独立表；用户和设备新增趋势直接读取现有业务表。公开上报接口只负责校验和写入，管理端聚合接口通过独立 `dashboardStore` 生成 7/30/90 天零填充序列；后台使用懒加载的 Recharts 图表页，避免继续扩大 `App.tsx` 的业务职责和首屏包体。

**Tech Stack:** Node.js 22+、TypeScript 6、Express 5、`node:sqlite`、React 18、Vite 5、Tailwind CSS 3、Recharts 3.3、`react-is` 18.3。

## Global Constraints

- 只实施 `server/`、根 `AGENTS.md` 和本计划文件，不修改当前工作区已有的 `pm/` 变更。
- 当前分支为 `dev`，不创建新分支；实施前后都必须检查 `git status --short --branch`。
- 所有 Git 提交必须分步进行，提交消息严格使用 `功能（server）：xxxxx` 格式；每次只暂存该步骤列出的文件。
- 官网“访问量”定义为按 Asia/Shanghai 自然日去重的官网日 UV：同一浏览器资料目录中的持久访客 ID，一天最多计 1 次；刷新、同日重复打开和 React StrictMode 重复 effect 不增加计数。
- `localStorage` 只负责减少重复请求，SQLite 唯一索引才是最终去重保障；不能仅依赖前端标记。
- “一个设备”在 Web 端只能近似为一个浏览器资料目录：换浏览器、无痕模式或清除站点数据后会被视为新访客，计划和后台说明必须明确这个边界。
- 服务端使用自身时间计算 `visit_day/download_day/activity_day`，不信任客户端日期；全部统计按 `Asia/Shanghai` 展示。
- 访问记录保存经过规范化的 IP、User-Agent、来源页面和基础终端信息，但仪表盘 API 只能返回聚合数据，不得返回单条 IP、访客 hash 或完整 User-Agent。
- 原始访问和下载记录默认保留 180 天；通过 `ANALYTICS_RETENTION_DAYS` 可调整为 90-730 天。清理只删除统计事件表，不触碰用户、设备、发布、文件或业务日志。
- 官网访客 ID 进入数据库前使用 `SHA-256(ANALYTICS_HASH_SALT + visitorId)`；生产环境应配置独立 `ANALYTICS_HASH_SALT`，不得存储 localStorage 原始 UUID。
- 官网访问上报和官网下载重定向必须加入强制明文路径，因为官网不持有系统加密密钥；后台 `/api/admin/dashboard` 继续经过现有加密和管理员 JWT 鉴权。
- 下载趋势定义为“官网点击并进入服务端下载重定向的次数”；PC 自动更新的 `latest.yml`、blockmap 和自动升级文件拉取不计入官网下载趋势。
- 统计写入失败不得阻断设备上报或文件下载；记录错误到服务端日志后继续原业务流程。
- 后台图表依赖使用 Context7 已核对的 `recharts@^3.3.0 + react-is@^18.3.1`；通过 `ResponsiveContainer` 响应式渲染，并给图表开启 `accessibilityLayer`。
- 不引入第三方统计 SaaS、IP 地理库、浏览器指纹库或额外状态管理库。
- 实施验证至少包含统计 Store 聚焦测试、服务端 TypeScript 构建、管理后台构建、官网构建；不启动或部署生产服务。

---

## 指标口径

### 顶部核心指标

| 指标 | 数据源 | 口径 |
| --- | --- | --- |
| 用户总数 | `users` | 当前用户记录总数 |
| 今日新增用户 | `users.created_at` | 今日 00:00 至现在注册 |
| 7 日新增用户 | `users.created_at` | 含今天最近 7 个自然日注册 |
| 7 日登录用户 | `users.last_login_at` | 最近 7 天发生过登录的用户数；不等同于完整 DAU |
| 设备总数 | `device_info` + `desktop_device_info` | Android 与 PC 唯一设备合计 |
| 7 日活跃设备 | `device_daily_activity` | 最近 7 天至少上报过一次的 Android/PC 设备去重数 |
| 今日官网访客 | `site_visit_records` | 今日去重访客数 |
| 7 日官网访客 | `site_visit_records` | 最近 7 天各日 UV 之和 |
| 今日官网下载 | `download_records` | 今日官网服务端重定向次数 |
| 7 日官网下载 | `download_records` | 最近 7 天 Android + PC 下载次数 |
| 7 日下载转化率 | 两张事件表 | `7日官网下载 / 7日官网访客 × 100%`，访客为 0 时返回 0 |

### 趋势图

1. 用户趋势：每日新增用户 + 累计用户。
2. 设备趋势：每日 Android/PC 新设备；每日 Android/PC 活跃设备。
3. 下载量趋势：每日 Android/PC 官网下载，堆叠柱状图。
4. 访问量趋势：每日官网 UV，面积图。

### 推荐的必要运营信息

1. 待处理反馈数：`feedback.status = 'pending'`。
2. 待处理故障数：`fault_reports.status = 'pending'`。
3. 有效分享数与累计分享访问次数：`share_records.valid/access_count`。
4. 云端同步条目数：`user_sync_items.deleted = 0`。
5. 已上传文件数量和总字节：`file_records.status = 'uploaded'`。
6. Android/PC 设备占比。
7. Android 与 PC 当前 App 版本分布，各取数量前 6，剩余合并为“其他”。

---

## 数据表设计

### `site_visit_records`

```sql
CREATE TABLE IF NOT EXISTS site_visit_records (
    id              TEXT    PRIMARY KEY,
    visit_day       TEXT    NOT NULL,
    visitor_hash    TEXT    NOT NULL,
    ip_address      TEXT    NOT NULL DEFAULT '',
    path            TEXT    NOT NULL DEFAULT '/',
    referrer        TEXT    NOT NULL DEFAULT '',
    user_agent      TEXT    NOT NULL DEFAULT '',
    language        TEXT    NOT NULL DEFAULT '',
    timezone        TEXT    NOT NULL DEFAULT '',
    screen_width    INTEGER NOT NULL DEFAULT 0,
    screen_height   INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_site_visit_day_visitor
ON site_visit_records (visit_day, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_site_visit_day
ON site_visit_records (visit_day);
CREATE INDEX IF NOT EXISTS idx_site_visit_created
ON site_visit_records (created_at);
```

### `download_records`

```sql
CREATE TABLE IF NOT EXISTS download_records (
    id              TEXT    PRIMARY KEY,
    download_day    TEXT    NOT NULL,
    platform        TEXT    NOT NULL CHECK (platform IN ('android', 'desktop')),
    version         TEXT    NOT NULL DEFAULT '',
    file_record_id  TEXT,
    ip_address      TEXT    NOT NULL DEFAULT '',
    referrer        TEXT    NOT NULL DEFAULT '',
    user_agent      TEXT    NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_download_day_platform
ON download_records (download_day, platform);
CREATE INDEX IF NOT EXISTS idx_download_created
ON download_records (created_at);
```

### `device_daily_activity`

```sql
CREATE TABLE IF NOT EXISTS device_daily_activity (
    activity_day    TEXT    NOT NULL,
    device_type     TEXT    NOT NULL CHECK (device_type IN ('android', 'desktop')),
    device_id       TEXT    NOT NULL,
    app_version     TEXT    NOT NULL DEFAULT '',
    first_seen_at   INTEGER NOT NULL,
    last_seen_at    INTEGER NOT NULL,
    PRIMARY KEY (activity_day, device_type, device_id)
);
CREATE INDEX IF NOT EXISTS idx_device_daily_day_type
ON device_daily_activity (activity_day, device_type);
CREATE INDEX IF NOT EXISTS idx_device_daily_last_seen
ON device_daily_activity (last_seen_at);
```

不设置到设备表或文件表的外键：设备/文件被后台删除后，历史聚合数据仍需保留到统计保留期结束。

---

## 管理端 API 契约

`GET /api/admin/dashboard?days=7|30|90`，默认 `30`。

```ts
export type DashboardDailyPoint = {
  date: string;
  newUsers: number;
  totalUsers: number;
  newAndroidDevices: number;
  newDesktopDevices: number;
  activeAndroidDevices: number;
  activeDesktopDevices: number;
  siteVisits: number;
  androidDownloads: number;
  desktopDownloads: number;
};

export type DashboardNamedValue = {
  name: string;
  value: number;
};

export type AdminDashboardData = {
  rangeDays: 7 | 30 | 90;
  timezone: "Asia/Shanghai";
  generatedAt: number;
  summary: {
    totalUsers: number;
    newUsersToday: number;
    newUsers7d: number;
    loggedInUsers7d: number;
    totalDevices: number;
    androidDevices: number;
    desktopDevices: number;
    activeDevices7d: number;
    siteVisitsToday: number;
    siteVisits7d: number;
    downloadsToday: number;
    downloads7d: number;
    downloadConversion7d: number;
    pendingFeedback: number;
    pendingFaultReports: number;
    validShares: number;
    shareAccesses: number;
    syncedLibraryItems: number;
    uploadedFiles: number;
    uploadedFileBytes: number;
  };
  daily: DashboardDailyPoint[];
  distributions: {
    devicePlatforms: DashboardNamedValue[];
    androidVersions: DashboardNamedValue[];
    desktopVersions: DashboardNamedValue[];
    downloadsByPlatform: DashboardNamedValue[];
  };
};
```

`daily` 必须从范围起始日到今天完整返回，没数据的日期用 0 填充；不允许让前端猜日期或自行补洞。

---

## 文件结构与职责

**新增服务端文件：**

- `server/src/utils/analyticsDate.ts`：Asia/Shanghai 自然日、范围起点和日期序列。
- `server/src/db/analyticsStore.ts`：访问、下载、设备日活写入与保留期清理。
- `server/src/db/analyticsStore.spec.ts`：日 UV 去重、设备日活 upsert、下载记录、清理测试。
- `server/src/db/dashboardStore.ts`：跨表聚合并生成 `AdminDashboardData`。
- `server/src/db/dashboardStore.spec.ts`：汇总、趋势零填充、平台拆分和敏感字段隔离测试。
- `server/src/routes/analytics.ts`：公开官网访问上报接口。
- `server/src/routes/adminDashboard.ts`：管理员仪表盘查询接口。
- `server/src/types/dashboard.ts`：服务端仪表盘 DTO。

**新增官网文件：**

- `server/frontend/src/api/analytics.ts`：访客 ID、每日 localStorage 标记和访问上报。

**新增后台文件：**

- `server/admin/src/types/dashboard.ts`：后台仪表盘 DTO 镜像。
- `server/admin/src/components/dashboard/DashboardMetricCard.tsx`：核心指标卡。
- `server/admin/src/components/dashboard/DashboardTrendCard.tsx`：统一玻璃拟态图表容器。
- `server/admin/src/components/dashboard/DashboardChartTooltip.tsx`：统一中文 Tooltip。
- `server/admin/src/components/tabs/DashboardTab.tsx`：范围选择、加载/错误态、指标与图表编排。

**新增文档：**

- `server/docs/admin-dashboard-analytics.md`：口径、表结构、隐私、保留期和运维说明。

**修改现有文件：**

- `server/src/db/appDb.ts`
- `server/src/index.ts`
- `server/src/routes/config.ts`
- `server/src/routes/device.ts`
- `server/src/routes/admin.ts`
- `server/package.json`
- `server/.env.example`
- `server/frontend/src/Home/HomePage.tsx`
- `server/frontend/src/api/update.ts`
- `server/frontend/src/Home/components/HeroSection.tsx`
- `server/frontend/src/Home/components/DownloadSection.tsx`
- `server/admin/package.json`
- `server/admin/pnpm-lock.yaml`
- `server/admin/src/api/client.ts`
- `server/admin/src/constants/theme.ts`
- `server/admin/src/App.tsx`
- `server/admin/src/types/config.ts`
- `AGENTS.md`

---

### Task 1: 官网日 UV 的 SQLite 存储、公开接口和 localStorage 上报

**Files:**

- Create: `server/src/utils/analyticsDate.ts`
- Create: `server/src/db/analyticsStore.ts`
- Create: `server/src/db/analyticsStore.spec.ts`
- Create: `server/src/routes/analytics.ts`
- Create: `server/frontend/src/api/analytics.ts`
- Modify: `server/src/db/appDb.ts`
- Modify: `server/src/index.ts`
- Modify: `server/package.json`
- Modify: `server/.env.example`
- Modify: `server/frontend/src/Home/HomePage.tsx`
- Modify: `server/admin/src/types/config.ts`
- Include in commit: `docs/superpowers/plans/2026-08-26-server-admin-analytics-dashboard.md`

**Interfaces:**

- Produces: `toShanghaiDay(timestamp: number): string`。
- Produces: `buildShanghaiDayRange(days: 7 | 30 | 90, now?: number): { startAt: number; dates: string[] }`。
- Produces: `recordSiteVisit(input: SiteVisitInput): { accepted: boolean; visitDay: string }`。
- Produces: `POST /api/analytics/site-visit`。
- Consumes: `ANALYTICS_HASH_SALT`、`ANALYTICS_RETENTION_DAYS`。

- [ ] **Step 1: 先写日 UV 去重测试**

  `analyticsStore.spec.ts` 使用工作区内固定测试数据库 `server/data/analytics-store-test.db`，只删除这个文件及其 `-wal/-shm`。至少写出以下断言：

  ```ts
  test("同一访客同一上海自然日只记录一次", async () => {
    const store = await import("./analyticsStore.js");
    const first = store.recordSiteVisit(siteVisit("visitor-a", Date.parse("2026-08-26T01:00:00+08:00")));
    const duplicate = store.recordSiteVisit(siteVisit("visitor-a", Date.parse("2026-08-26T23:59:00+08:00")));
    assert.equal(first.accepted, true);
    assert.equal(duplicate.accepted, false);
    assert.equal(first.visitDay, "2026-08-26");
  });

  test("同一访客跨自然日和不同访客正常计数", async () => {
    const store = await import("./analyticsStore.js");
    assert.equal(store.recordSiteVisit(siteVisit("visitor-a", Date.parse("2026-08-27T00:01:00+08:00"))).accepted, true);
    assert.equal(store.recordSiteVisit(siteVisit("visitor-b", Date.parse("2026-08-27T08:00:00+08:00"))).accepted, true);
  });
  ```

  测试还要直接查询表，确认数据库没有保存 `visitor-a` 原文，只保存 64 位十六进制 hash。

- [ ] **Step 2: 在 `appDb.ts` 创建三张统计表和索引**

  将“数据表设计”中的 SQL 原样加入 `CREATE_SQL`。使用 `CREATE TABLE/INDEX IF NOT EXISTS`，不删除、不重命名现有表，也不恢复旧 JSON 迁移。

- [ ] **Step 3: 实现统一上海日期工具**

  ```ts
  const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

  export function toShanghaiDay(timestamp: number): string {
    return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
  }

  export function shanghaiDayStart(day: string): number {
    return Date.parse(`${day}T00:00:00+08:00`);
  }
  ```

  `buildShanghaiDayRange()` 从今天向前生成固定数量日期，返回升序数组；后续访问、下载、设备和仪表盘全部复用，不允许各模块自行计算时区。

- [ ] **Step 4: 实现访问写入与 hash**

  `SiteVisitInput` 只接受服务端已规范化字段：

  ```ts
  export type SiteVisitInput = {
    visitorId: string;
    ipAddress: string;
    path: string;
    referrer: string;
    userAgent: string;
    language: string;
    timezone: string;
    screenWidth: number;
    screenHeight: number;
    occurredAt?: number;
  };
  ```

  使用 `node:crypto` 的 `createHash("sha256")`，salt 优先读取 `ANALYTICS_HASH_SALT`，开发环境回退到 `ADMIN_JWT_SECRET` 或固定 dev 值。执行：

  ```sql
  INSERT INTO site_visit_records (...)
  VALUES (...)
  ON CONFLICT(visit_day, visitor_hash) DO NOTHING
  ```

  根据 `run(...).changes === 1` 返回 `accepted`。不要先 SELECT 再 INSERT，避免并发重复。

- [ ] **Step 5: 实现输入校验明确的公开路由**

  `POST /api/analytics/site-visit` body：

  ```ts
  type SiteVisitPayload = {
    visitorId: string;
    path?: string;
    referrer?: string;
    language?: string;
    timezone?: string;
    screenWidth?: number;
    screenHeight?: number;
  };
  ```

  校验规则：`visitorId` 必须是 UUID；path 必须以 `/` 开头且最多 256 字符；referrer 最多 512；language 最多 32；timezone 最多 64；宽高为 0-20000 整数。IP 只取已启用 `trust proxy = 1` 后的 `req.ip`，删除 `::ffff:` 前缀并截到 64 字符；User-Agent 从请求头取最多 512 字符。

  成功统一返回：

  ```ts
  res.json(ok({ accepted: result.accepted, visitDay: result.visitDay }));
  ```

  同日重复上报仍返回 200 和 `accepted=false`，不当成错误。

- [ ] **Step 6: 挂载公开路由并强制明文**

  `server/src/index.ts`：

  ```ts
  import { analyticsRouter } from "./routes/analytics";

  // DEFAULT_PLAINTEXT_PATHS 与 MANDATORY_PLAINTEXT_PATHS 都加入：
  "/api/analytics/site-visit",

  app.use("/api/analytics", analyticsRouter);
  ```

  同步把 `/api/analytics/site-visit` 加到后台 `DEFAULT_PLAINTEXT_PATHS` 类型常量，避免后台保存白名单时误删官网必需路径。

- [ ] **Step 7: 在官网封装访客 ID 和每日标记**

  `server/frontend/src/api/analytics.ts` 使用以下键名：

  ```ts
  const VISITOR_ID_KEY = "pm_site_visitor_id";
  const VISIT_DAY_KEY = "pm_site_visit_day";
  let reportPromise: Promise<void> | null = null;
  ```

  访客 ID 优先 `crypto.randomUUID()`；若不可用，用 `crypto.getRandomValues()` 生成 UUID v4 格式。日键使用 `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" })`。同日已有成功标记直接返回；否则 POST：

  ```ts
  await fetch("/api/analytics/site-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    keepalive: true,
    body: JSON.stringify({
      visitorId,
      path: window.location.pathname,
      referrer: safeReferrerWithoutQueryOrHash(document.referrer),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    }),
  });
  ```

  只有 2xx 且响应 `success=true` 后才写 `VISIT_DAY_KEY`；失败静默，不影响官网内容，下一次页面加载再试。模块级 `reportPromise` 用于抑制 React StrictMode 的同一次重复 effect。

- [ ] **Step 8: 只在官网主页触发上报**

  `HomePage.tsx` 增加：

  ```tsx
  useEffect(() => {
    void reportDailySiteVisit();
  }, []);
  ```

  `/scan/` 分享展示和 `/download/` 中转静态页不单独计数；进入官网主页后按同一日 UV 规则计一次。

- [ ] **Step 9: 增加保留期配置和测试脚本**

  `server/.env.example`：

  ```dotenv
  # 官网统计访客 ID 哈希盐；生产必须设置独立随机值
  ANALYTICS_HASH_SALT=
  # 原始访问、下载和设备日活保留天数，允许 90-730
  ANALYTICS_RETENTION_DAYS=180
  ```

  `server/package.json`：

  ```json
  "test:analytics": "pnpm build && node --test dist/db/analyticsStore.spec.js"
  ```

- [ ] **Step 10: 验证并提交第 1 步**

  ```powershell
  pnpm --dir server test:analytics
  pnpm --dir server/frontend build
  git diff --check
  git status --short --branch
  git add -- docs/superpowers/plans/2026-08-26-server-admin-analytics-dashboard.md server/.env.example server/package.json server/src/db/appDb.ts server/src/utils/analyticsDate.ts server/src/db/analyticsStore.ts server/src/db/analyticsStore.spec.ts server/src/routes/analytics.ts server/src/index.ts server/frontend/src/api/analytics.ts server/frontend/src/Home/HomePage.tsx server/admin/src/types/config.ts
  git commit -m "功能（server）：增加官网日访问统计"
  ```

  预期：聚焦测试通过、官网构建通过；提交中不出现 `pm/` 文件。

---

### Task 2: 记录设备日活和可追踪的官网下载

**Files:**

- Modify: `server/src/db/analyticsStore.ts`
- Modify: `server/src/db/analyticsStore.spec.ts`
- Modify: `server/src/routes/device.ts`
- Modify: `server/src/routes/config.ts`
- Modify: `server/src/index.ts`
- Modify: `server/admin/src/types/config.ts`
- Modify: `server/frontend/src/api/update.ts`
- Modify: `server/frontend/src/Home/components/HeroSection.tsx`
- Modify: `server/frontend/src/Home/components/DownloadSection.tsx`

**Interfaces:**

- Produces: `recordDeviceDailyActivity(input: DeviceDailyActivityInput): void`。
- Produces: `recordDownload(input: DownloadRecordInput): void`。
- Produces: `GET /api/config/download/:platform`，platform 仅允许 `android|desktop`。
- Produces frontend: `trackedDownloadHref(platform: "android" | "desktop", release?: ReleaseInfo): string`。

- [ ] **Step 1: 先补写设备日活和下载记录测试**

  ```ts
  test("设备日活同一设备同日 upsert 且刷新最后活跃时间", async () => {
    const store = await import("./analyticsStore.js");
    store.recordDeviceDailyActivity(deviceActivity("android", "device-a", "1.0.0", morning));
    store.recordDeviceDailyActivity(deviceActivity("android", "device-a", "1.0.1", evening));
    const row = db.prepare("SELECT * FROM device_daily_activity WHERE device_id = ?").get("device-a") as Record<string, unknown>;
    assert.equal(row.app_version, "1.0.1");
    assert.equal(row.last_seen_at, evening);
  });

  test("官网下载按平台保存每次有效重定向", async () => {
    const store = await import("./analyticsStore.js");
    store.recordDownload(download("android", "1.2.3", noon));
    store.recordDownload(download("android", "1.2.3", noon + 1_000));
    const count = db.prepare("SELECT COUNT(*) AS total FROM download_records").get() as { total: number };
    assert.equal(count.total, 2);
  });
  ```

- [ ] **Step 2: 实现设备日活 UPSERT**

  ```sql
  INSERT INTO device_daily_activity (
    activity_day, device_type, device_id, app_version, first_seen_at, last_seen_at
  ) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(activity_day, device_type, device_id) DO UPDATE SET
    app_version = excluded.app_version,
    last_seen_at = excluded.last_seen_at
  ```

  Android 与 PC 使用同一函数，`device_type` 严格为 `android|desktop`。

- [ ] **Step 3: 接入两个设备上报流程**

  在 `device.ts` 的 Android 和 desktop upsert 成功、已取得最终 `deviceId` 后调用 `recordDeviceDailyActivity()`。统计写入使用 `try/catch` 单独保护：失败只 `console.warn`，设备上报仍返回原成功响应。

- [ ] **Step 4: 实现下载事件写入**

  `DownloadRecordInput`：

  ```ts
  export type DownloadRecordInput = {
    platform: "android" | "desktop";
    version: string;
    fileRecordId: string | null;
    ipAddress: string;
    referrer: string;
    userAgent: string;
    occurredAt?: number;
  };
  ```

  每次有效官网下载重定向写一行，不按 IP 去重；失败请求和未开放下载不写入。

- [ ] **Step 5: 增加统一官网下载重定向**

  在 `configRouter` 增加 `GET /download/:platform`：

  1. 只接受 `android|desktop`。
  2. 读取当前 `readAppConfig().releases[platform]`。
  3. `available=false` 或 `downloadUrl` 为空返回 404。
  4. 从 `/api/config/release-files/:id/download` 格式提取可选 `fileRecordId`。
  5. 尝试记录下载事件；失败只写日志。
  6. `res.redirect(302, release.downloadUrl)`。

  必须检测目标地址不能再次等于 `/api/config/download/:platform`，避免管理员误配置导致重定向循环。

- [ ] **Step 6: 把下载路由加入强制明文**

  在服务端和后台默认白名单都加入：

  ```ts
  "/api/config/download/*"
  ```

- [ ] **Step 7: 官网所有主下载按钮改走统一入口**

  `update.ts` 导出：

  ```ts
  export function trackedDownloadHref(platform: "android" | "desktop", release?: ReleaseInfo): string {
    return release?.available && release.downloadUrl
      ? `/api/config/download/${platform}`
      : "#download";
  }
  ```

  `HeroSection` 和 `DownloadSection` 都调用该函数，不再把原始 `release.downloadUrl` 直接放到 `<a href>`。这保证手填直链和七牛托管包都进入同一统计入口，同时保持接口 DTO 的 `downloadUrl` 兼容。

- [ ] **Step 8: 实现每日一次的保留期清理门禁**

  `analyticsStore.ts` 使用模块级 `lastCleanupDay`；访问、下载或设备日活任一写入时，仅在上海日期变化后执行一次：

  ```sql
  DELETE FROM site_visit_records WHERE created_at < ?;
  DELETE FROM download_records WHERE created_at < ?;
  DELETE FROM device_daily_activity WHERE last_seen_at < ?;
  ```

  保留天数读取后限制在 90-730，默认 180。清理失败不阻断当前事件写入。

- [ ] **Step 9: 验证并提交第 2 步**

  ```powershell
  pnpm --dir server test:analytics
  pnpm --dir server/frontend build
  git diff --check
  git add -- server/src/db/analyticsStore.ts server/src/db/analyticsStore.spec.ts server/src/routes/device.ts server/src/routes/config.ts server/src/index.ts server/admin/src/types/config.ts server/frontend/src/api/update.ts server/frontend/src/Home/components/HeroSection.tsx server/frontend/src/Home/components/DownloadSection.tsx
  git commit -m "功能（server）：记录设备日活与官网下载"
  ```

---

### Task 3: 增加后台仪表盘聚合 Store 和管理员 API

**Files:**

- Create: `server/src/types/dashboard.ts`
- Create: `server/src/db/dashboardStore.ts`
- Create: `server/src/db/dashboardStore.spec.ts`
- Create: `server/src/routes/adminDashboard.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/package.json`

**Interfaces:**

- Produces: `readAdminDashboard(days: DashboardRangeDays, now?: number): AdminDashboardData`。
- Produces: `GET /api/admin/dashboard?days=7|30|90`。
- Consumes: `buildShanghaiDayRange()`、现有业务表和三张统计表。

- [ ] **Step 1: 定义服务端 DTO**

  在 `server/src/types/dashboard.ts` 放入“管理端 API 契约”中的完整类型，并定义：

  ```ts
  export type DashboardRangeDays = 7 | 30 | 90;
  export const DASHBOARD_RANGE_DAYS: readonly DashboardRangeDays[] = [7, 30, 90];
  ```

- [ ] **Step 2: 先写聚合测试**

  使用独立 `server/data/dashboard-store-test.db`，种入跨日用户、Android/PC 设备、日活、访问和下载数据，至少断言：

  ```ts
  test("仪表盘返回固定天数并对缺失日期补零", async () => {
    const { readAdminDashboard } = await import("./dashboardStore.js");
    const result = readAdminDashboard(7, Date.parse("2026-08-26T12:00:00+08:00"));
    assert.equal(result.daily.length, 7);
    assert.equal(result.daily[0]?.date, "2026-08-20");
    assert.equal(result.daily[6]?.date, "2026-08-26");
    assert.ok(result.daily.some((point) => point.siteVisits === 0));
  });

  test("汇总区正确拆分平台并计算转化率", async () => {
    const { readAdminDashboard } = await import("./dashboardStore.js");
    const result = readAdminDashboard(30, now);
    assert.equal(result.summary.totalDevices, result.summary.androidDevices + result.summary.desktopDevices);
    assert.equal(result.summary.downloadConversion7d, 50);
    assert.deepEqual(result.distributions.devicePlatforms.map((item) => item.name), ["Android", "PC"]);
  });
  ```

  再用 `JSON.stringify(result)` 断言不包含测试 IP、visitor hash 和 User-Agent。

- [ ] **Step 3: 实现零填充日序列聚合**

  所有 SQL 只取选定区间；用户/新设备的毫秒时间戳使用 SQLite：

  ```sql
  strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', '+8 hours')
  ```

  访问、下载、设备日活直接按已存的 `*_day` 分组。先创建 `Map<date, DashboardDailyPoint>` 的全零日期，再把各查询结果合并，最后按日期升序返回。

- [ ] **Step 4: 计算累计用户**

  先查询范围开始时间之前的用户数作为 baseline，再按日累加 `newUsers`：

  ```ts
  let totalUsers = usersBeforeRange;
  for (const point of daily) {
    totalUsers += point.newUsers;
    point.totalUsers = totalUsers;
  }
  ```

  最后一日 `totalUsers` 应与 summary 的当前用户总数相等。

- [ ] **Step 5: 聚合运营健康与版本分布**

  使用单值查询获取待处理反馈、故障、有效分享、分享访问总数、同步条目数、上传文件数量/字节。版本分布分别从 `device_info.app_version`、`desktop_device_info.app_version` 分组，过滤空版本，按数量降序；前 6 个保留，其余求和为“其他”。

- [ ] **Step 6: 增加鉴权路由**

  `adminDashboardRouter.get("/")` 解析 `days`，只接受 `7/30/90`，其它值返回 400：

  ```ts
  const days = Number(req.query.days ?? 30);
  if (!DASHBOARD_RANGE_DAYS.includes(days as DashboardRangeDays)) {
    return res.status(400).json(fail("days 仅支持 7、30、90", 400));
  }
  return res.json(ok(readAdminDashboard(days as DashboardRangeDays)));
  ```

  在 `admin.ts` 的 `adminRouter.use(requireAdminJwt)` 之后挂载：

  ```ts
  adminRouter.use("/dashboard", adminDashboardRouter);
  ```

  不把后台仪表盘加入明文白名单。

- [ ] **Step 7: 扩展聚焦测试脚本**

  ```json
  "test:analytics": "pnpm build && node --test dist/db/analyticsStore.spec.js dist/db/dashboardStore.spec.js"
  ```

- [ ] **Step 8: 验证并提交第 3 步**

  ```powershell
  pnpm --dir server test:analytics
  pnpm --dir server build
  git diff --check
  git add -- server/src/types/dashboard.ts server/src/db/dashboardStore.ts server/src/db/dashboardStore.spec.ts server/src/routes/adminDashboard.ts server/src/routes/admin.ts server/package.json
  git commit -m "功能（server）：增加仪表盘统计接口"
  ```

---

### Task 4: 接入 Recharts、后台 DTO 与 API 客户端

**Files:**

- Create: `server/admin/src/types/dashboard.ts`
- Modify: `server/admin/package.json`
- Modify: `server/admin/pnpm-lock.yaml`
- Modify: `server/admin/src/api/client.ts`

**Interfaces:**

- Produces: 后台 `AdminDashboardData`、`DashboardRangeDays` 类型。
- Produces: `fetchAdminDashboard(days: DashboardRangeDays, signal?: AbortSignal): Promise<AdminDashboardData>`。
- Produces: Recharts 图表组件依赖。

- [ ] **Step 1: 使用 pnpm 安装已核对版本**

  ```powershell
  pnpm --dir server/admin add recharts@^3.3.0 react-is@^18.3.1
  ```

  预期只修改 `server/admin/package.json` 和 `server/admin/pnpm-lock.yaml`。Recharts 3.3 支持 React 18，并提供 TypeScript 类型、`ResponsiveContainer` 和 `accessibilityLayer`。

- [ ] **Step 2: 添加后台 DTO 镜像**

  `server/admin/src/types/dashboard.ts` 完整复制管理端 API 契约的字段名和数值类型；不要使用 `any`，也不要把服务端 Store 类型跨 tsconfig 直接 import 到 Vite 项目。

- [ ] **Step 3: 增加 API 客户端函数**

  ```ts
  export async function fetchAdminDashboard(
    days: DashboardRangeDays,
    signal?: AbortSignal,
  ): Promise<AdminDashboardData> {
    const res = await fetchWithAuth(`/api/admin/dashboard?days=${days}`, { signal });
    const body = await parseJson<AdminDashboardData>(res);
    if (!res.ok || !body.success || body.data == null) {
      throw new Error(body.msg || `HTTP ${res.status}`);
    }
    return body.data;
  }
  ```

  继续使用现有 `encryptedFetch + Bearer token + 401 handler`，不得新增裸 `fetch` 绕过管理后台加密流程。

- [ ] **Step 4: 构建并提交第 4 步**

  ```powershell
  pnpm --dir server/admin build
  git diff --check
  git add -- server/admin/package.json server/admin/pnpm-lock.yaml server/admin/src/types/dashboard.ts server/admin/src/api/client.ts
  git commit -m "功能（server）：接入后台图表与统计数据契约"
  ```

---

### Task 5: 新增后台仪表盘页面并设为默认页

**Files:**

- Create: `server/admin/src/components/dashboard/DashboardMetricCard.tsx`
- Create: `server/admin/src/components/dashboard/DashboardTrendCard.tsx`
- Create: `server/admin/src/components/dashboard/DashboardChartTooltip.tsx`
- Create: `server/admin/src/components/tabs/DashboardTab.tsx`
- Modify: `server/admin/src/constants/theme.ts`
- Modify: `server/admin/src/App.tsx`

**Interfaces:**

- `DashboardTab` consumes: `themeColor: string`。
- `DashboardTab` owns: `rangeDays`、`data`、`loading`、`error`、`AbortController`。
- `DashboardMetricCard` consumes: `label`、`value`、`hint`、`accentColor`。
- `DashboardTrendCard` consumes: `title`、`description`、`children`。

- [ ] **Step 1: 创建可复用指标卡和图表容器**

  指标卡沿用后台 `glassCardClasses` 的玻璃拟态语言，但禁止 hover 位移造成数据墙抖动；数字使用 `Intl.NumberFormat("zh-CN")`，字节使用独立 `formatBytes()`。图表容器必须给内部图表固定的响应式高度：

  ```tsx
  <div className="h-[260px] w-full sm:h-[300px]">
    <ResponsiveContainer width="100%" height="100%" debounce={120}>
      {children}
    </ResponsiveContainer>
  </div>
  ```

  Recharts 的百分比容器只有在父容器具有明确高度时才能稳定显示，因此不能只写 `height="100%"` 而不给外层高度。

- [ ] **Step 2: 创建统一 Tooltip**

  Tooltip 展示 `YYYY-MM-DD` 和中文系列名，数值做千分位；卡片使用白色半透明背景、圆角、轻边框，与现有后台风格一致。不要在每张图重复 Tooltip JSX。

- [ ] **Step 3: 实现 DashboardTab 数据生命周期**

  默认 30 天，可切换 7/30/90 天；切换时取消上一次请求。核心结构：

  ```tsx
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(30);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAdminDashboard(rangeDays, controller.signal)
      .then(setData)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "加载失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [rangeDays, refreshKey]);
  ```

  页面内提供“刷新”按钮递增 `refreshKey`。首次加载显示骨架块；失败显示错误卡与重试；旧数据存在时刷新不清空旧图，避免闪白。

- [ ] **Step 4: 布置 8 张主要指标卡**

  第一屏响应式网格：

  1. 用户总数（副文案：今日 +x）。
  2. 7 日新增用户（副文案：7 日登录 x）。
  3. 设备总数（副文案：Android x / PC x）。
  4. 7 日活跃设备。
  5. 今日官网访客。
  6. 7 日官网访客。
  7. 今日官网下载。
  8. 7 日官网下载（副文案：转化率 x%）。

  手机 1 列、`sm` 2 列、`xl` 4 列；数值为 0 时正常展示 `0`，不显示 `--`。

- [ ] **Step 5: 实现四张趋势图**

  1. 用户趋势：`AreaChart`，`newUsers` 面积 + `totalUsers` 折线，累计用户使用右轴。
  2. 设备趋势：`ComposedChart`，Android/PC 新设备为柱，Android/PC 活跃设备为折线。
  3. 官网下载：`BarChart`，Android/PC 使用相同 `stackId` 堆叠。
  4. 官网访问：`AreaChart`，`siteVisits` 单面积。

  每张图使用：

  ```tsx
  <AreaChart data={data.daily} accessibilityLayer margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
    <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} />
    <YAxis allowDecimals={false} />
    <Tooltip content={<DashboardChartTooltip />} />
  </AreaChart>
  ```

  主色使用 `themeColor`；平台色固定 Android `#22c55e`、PC `#0ea5e9`。不得把四张图一次性放进 `App.tsx`。

- [ ] **Step 6: 实现运营健康与分布区**

  第二组紧凑卡显示待处理反馈、待处理故障、有效分享/访问次数、同步条目、上传文件数/总大小。设备占比用 `PieChart`；版本分布用横向 `BarChart`，Android/PC 分开显示，数据为空时显示“暂无版本数据”。

- [ ] **Step 7: 加入侧栏并设为默认页**

  `tabs` 首项：

  ```ts
  { id: "dashboard" as const, name: "仪表盘", icon: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-12h8V3h-8v6z" },
  ```

  `App.tsx`：

  ```tsx
  const DashboardTab = lazy(() => import("./components/tabs/DashboardTab"));
  const [currentTab, setCurrentTab] = useState<TabId>("dashboard");

  {currentTab === "dashboard" && <DashboardTab themeColor={themeColor} />}
  ```

  当前顶栏的“重新拉取 / 导出 JSON 配置”只服务配置管理；`currentTab === "dashboard"` 时隐藏，仪表盘使用页面自己的日期范围与刷新按钮。

- [ ] **Step 8: 管理后台响应式和可访问性检查**

  - 所有图表设置 `accessibilityLayer`。
  - 7/30/90 日按钮使用原生 button 和明确选中态。
  - 图例不能只靠颜色，显示“Android / PC / 新增 / 活跃”文字。
  - `prefers-reduced-motion` 时把 Recharts `isAnimationActive` 设为 false。
  - 360px 宽度下卡片不横向溢出；图表允许减少 X 轴刻度，不出现横向页面滚动。

- [ ] **Step 9: 构建并提交第 5 步**

  ```powershell
  pnpm --dir server/admin build
  git diff --check
  git add -- server/admin/src/components/dashboard/DashboardMetricCard.tsx server/admin/src/components/dashboard/DashboardTrendCard.tsx server/admin/src/components/dashboard/DashboardChartTooltip.tsx server/admin/src/components/tabs/DashboardTab.tsx server/admin/src/constants/theme.ts server/admin/src/App.tsx
  git commit -m "功能（server）：增加后台统计仪表盘"
  ```

---

### Task 6: 文档、隐私说明与跨模块验收

**Files:**

- Create: `server/docs/admin-dashboard-analytics.md`
- Modify: `AGENTS.md`
- Inspect: Task 1-5 的全部目标文件和提交历史

**Interfaces:**

- Produces: 统计口径、数据保留和部署配置说明。
- Produces: 后续 Agent 不会把日 UV、下载量和设备日活混为一谈的项目上下文。

- [ ] **Step 1: 编写统计运维文档**

  文档必须写清：

  - 日 UV 是浏览器 localStorage 访客 ID 的近似设备口径。
  - 服务端唯一索引是去重权威。
  - IP/User-Agent 仅用于内部安全排障和聚合，不由仪表盘 API 下发。
  - 默认保留 180 天，清理门禁每日最多执行一次。
  - 下载只统计 `/api/config/download/:platform` 官网入口，不含自动更新拉取。
  - `ANALYTICS_HASH_SALT` 生产必填，变更 salt 会让同一访客被视为新访客。
  - 仪表盘支持 7/30/90 天，时区固定 Asia/Shanghai。
  - 上线前应在后台现有隐私政策中披露本地访客标识、IP、终端信息、用途和保留时间；代码不得自动覆盖运营人员已保存的隐私政策正文。

- [ ] **Step 2: 更新根 `AGENTS.md`**

  在服务端说明中追加：

  - 公开 `POST /api/analytics/site-visit` 与 `GET /api/config/download/:platform`。
  - 管理端 `GET /api/admin/dashboard?days=7|30|90`。
  - 三张统计表和日 UV/官网下载/设备日活口径。
  - 后台 Recharts 懒加载页及禁止返回统计明细中的 IP/visitor hash。

- [ ] **Step 3: 运行完整但聚焦的验证**

  ```powershell
  pnpm --dir server test:analytics
  pnpm --dir server build
  pnpm --dir server/admin build
  pnpm --dir server/frontend build
  git diff --check
  git status --short --branch
  git log -6 --oneline
  ```

  预期：

  - 两个统计 spec 全部通过。
  - 三个 TypeScript/Vite 构建通过。
  - 当前 `pm/` 用户改动仍原样存在且未进入任何 server 提交。
  - 最近 6 个功能提交依次对应官网访问、设备/下载、接口、图表契约、仪表盘 UI、说明文档。

- [ ] **Step 4: 做 API 静态安全检查**

  ```powershell
  rg -n 'visitor_hash|ip_address|user_agent' server/src/routes/adminDashboard.ts server/src/types/dashboard.ts server/admin/src/types/dashboard.ts
  rg -n '/api/analytics/site-visit|/api/config/download/\*' server/src/index.ts server/admin/src/types/config.ts
  rg -n 'release\.downloadUrl' server/frontend/src/Home/components/HeroSection.tsx server/frontend/src/Home/components/DownloadSection.tsx
  ```

  预期：第一条无输出；第二条在强制/默认白名单中存在；第三条不再用于直接下载 href。

- [ ] **Step 5: 提交文档**

  ```powershell
  git add -- AGENTS.md server/docs/admin-dashboard-analytics.md
  git commit -m "功能（server）：补充仪表盘统计说明"
  ```

---

## 老大手动验收清单

1. 首次打开官网，SQLite 当天新增 1 条 `site_visit_records`；同日刷新、关闭重开不增加。
2. 删除 `pm_site_visit_day` 但保留 visitor ID 后再次打开，前端会重试，服务端仍因唯一索引不增加。
3. 更换浏览器或清除全部站点数据会成为新访客，符合 Web 端近似设备边界。
4. 官网 Hero 与下载区的 Android/PC 按钮都先进入 `/api/config/download/:platform`，成功跳转后下载趋势增加；未开放平台返回 404 且不计数。
5. Android/PC 设备重复上报时，同设备同日只有一条 `device_daily_activity`，`last_seen_at/app_version` 会更新。
6. 登录后台后默认打开“仪表盘”；切换 7/30/90 天会刷新全部图表和平台分布。
7. 新注册用户、设备首次上报、访问官网、点击下载后，相应日期趋势变化；无数据日期连续显示 0。
8. 待处理反馈/故障、分享访问次数、同步条目和上传文件大小与数据库聚合一致。
9. 浏览器开发者工具确认后台仪表盘响应中没有 IP、visitor hash 或完整 User-Agent。
10. 360px 手机宽度与桌面宽度下，卡片和图表均不横向溢出；主题色切换后图表主线同步变化。

## 分步提交总览

1. `功能（server）：增加官网日访问统计`
2. `功能（server）：记录设备日活与官网下载`
3. `功能（server）：增加仪表盘统计接口`
4. `功能（server）：接入后台图表与统计数据契约`
5. `功能（server）：增加后台统计仪表盘`
6. `功能（server）：补充仪表盘统计说明`
