# PC 端故障上报 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PC 端高级设置中提供正式环境可用的故障汇总和一键上报，把现有主进程网络错误安全、可去重地提交到统一故障后台，同时继续仅在开发环境展示原始错误记录。

**Architecture:** 继续以 Electron main 作为安全边界：SQLite 为本地错误主存储，新增稳定日志 UUID、待上报状态、脱敏映射和故障上报 service；renderer 只能读取汇总和触发上报，不能在正式环境读取原始错误。服务端向后兼容扩展现有 `/api/fault-reports` 契约，增加 PC 网络故障场景和平台信息，后台按 Android / PC 分别展示。

**Tech Stack:** Electron 37、Vue 3 + TypeScript + Naive UI、Node.js `node:sqlite`、Vitest、Express + TypeScript、React 管理后台。

**Baseline:** PC 页面头部与 HeaderBar 间距改动已提交到 `main`，提交为 `7bab4f8`；当前 `pm/app/build.gradle.kts` 是用户已有未提交改动，本计划执行时不得暂存、覆盖或回退。

**Execution Status:** 功能实现完成。服务端、管理后台和 PC 端构建通过；按用户要求未运行单元测试或功能测试，交由用户安装后验证。实际实现使用独立 `FaultReportSection.vue` 承载正式版 UI，避免继续扩大高级设置组件。

## Global Constraints

- 首页和本轮已完成的推荐页面布局不再调整。
- `设置 > 高级设置` Tab 在开发版和正式版都显示。
- 正式版只显示故障汇总、隐私说明和上报按钮；Cookie 调试、错误表格、原始详情、JSON 导出仍不显示，并且 debug IPC 在打包环境必须拒绝调用。
- PC 首版只上报现有 `network_error_records` 中的主进程网络错误，不上传 `application-*.log`、Cookie、账号凭据、缓存文件、下载文件或用户曲库。
- 上报前必须递归脱敏 URL、请求参数和响应内容；至少覆盖 `authorization`、`cookie`、`set-cookie`、`token`、`access_token`、`refresh_token`、`password`、`currentPassword`、`newPassword`、`code`、`secret`、`signature`、`sign`、`s`、`x-pm-random`。
- 单条 URL 最长 2048 字符，请求参数和响应各 4096 字符，错误信息 2048 字符；超长内容截断后再提交。
- 单批最多提交 300 条待上报日志。服务端成功响应后，只按本批 `clientLogId` 精确标记已上报；不能全表更新。
- 已登录时携带账号 Bearer token，未登录允许匿名提交；token、真实服务地址和 AES-GCM 细节只存在 main 侧。
- 故障上报请求继续使用系统 AES-GCM `POST /api/fault-reports`；该请求自身失败时不能再写入一条新的待上报错误，避免自激循环。
- 服务端扩展必须兼容当前 Android `scene=play_url` 请求；本轮不修改 `pm/` 代码。
- 不新增第三方依赖，不做复杂 Electron 端到端测试，不启动或安装 App；使用聚焦单元测试、TypeScript 构建和用户手测。
- 架构、IPC、SQLite 和服务端契约变化完成后，同步更新根 `AGENTS.md` 与 `yixi/AGENTS.md`。
- 每次 Git 提交只暂存该任务对应文件，提交消息使用中文。

---

## 文件结构与职责

### 新增文件

- `yixi/electron/faultReport/types.ts`：PC 故障统计、上报 DTO、服务端响应和本地待上报记录类型。
- `yixi/electron/faultReport/sanitizer.ts`：递归脱敏、URL 查询参数清洗和字段限长。
- `yixi/electron/faultReport/payload.ts`：把 `network_error_records` 映射为统一 `/api/fault-reports` 日志 DTO。
- `yixi/electron/faultReport/desktopFaultReportService.ts`：读取统计、组装环境、批量提交、精确回写上传状态。
- `yixi/electron/faultReport/sanitizer.test.ts`：脱敏和长度边界测试。
- `yixi/electron/faultReport/payload.test.ts`：PC 错误到服务端 DTO 的稳定映射测试。
- `yixi/electron/database/appDatabase.faultReport.test.ts`：内存 SQLite 统计、pending 查询和精确上传回写测试。
- `yixi/electron/ipc/faultReportIpc.ts`：正式环境可用的汇总/提交 IPC。
- `yixi/vitest.fault-report.config.ts`：PC 故障模块聚焦测试配置。

### 修改文件

- `yixi/electron/database/schema.ts`：为 `network_error_records` 幂等增加日志 UUID、上传状态和上传时间。
- `yixi/electron/database/types.ts`：增加待上报记录、统计和上传状态类型。
- `yixi/electron/database/appDatabase.ts`：写入稳定 UUID、查询统计/待上报日志、按 UUID 标记已上传。
- `yixi/electron/system/systemClient.ts`：增加桌面故障提交方法，并允许该请求关闭失败日志回写。
- `yixi/electron/system/types.ts`：增加故障上报系统接口 DTO。
- `yixi/electron/ipc/debugIpc.ts`：打包环境拒绝原始错误读取、详情和导出。
- `yixi/electron/main.ts`：注册独立故障上报 IPC。
- `yixi/electron/preload.ts`：只暴露统计与提交两个正式能力。
- `yixi/src/types/electron.d.ts`：同步 typed IPC 和故障统计类型。
- `yixi/src/views/setting.vue`：高级设置 Tab 始终显示。
- `yixi/src/components/setting/basic/AdvanceSetting.vue`：增加手机端同语义的故障概览与立即上报区；开发区继续受 `isDev` 控制。
- `yixi/package.json`：增加 `test:fault-report`。
- `server/src/db/appDb.ts`：为故障批次幂等增加 `platform`、`arch` 字段。
- `server/src/db/faultReportStore.ts`：增加 `desktop_network` 场景、平台环境校验和持久化。
- `server/src/db/faultReportStore.spec.ts`：覆盖 Android 兼容、PC 场景和去重。
- `server/admin/src/types/config.ts`：扩展场景及平台字段。
- `server/admin/src/utils/faultReports.ts`：增加 PC 网络故障中文标签。
- `server/admin/src/components/tabs/FaultReportsManagementTab.tsx`：支持场景筛选和 PC 环境摘要。
- `server/admin/src/components/modals/FaultReportDetailModal.tsx`：按场景展示 PC 网络错误或 Android 播放错误。
- `server/admin/src/utils/faultReportExport.ts`：导出数据补充平台和架构。
- `AGENTS.md`、`yixi/AGENTS.md`：记录模块职责、隐私边界和验证命令。

---

### Task 1: 扩展统一故障上报服务端契约

**Files:**
- Modify: `server/src/db/appDb.ts`
- Modify: `server/src/db/faultReportStore.ts`
- Modify: `server/src/db/faultReportStore.spec.ts`

**Interfaces:**
- Produces: `FaultReportScene = "play_url" | "desktop_network"`
- Produces: `FaultReportEnvironment.platform: "android" | "desktop"`
- Produces: `FaultReportEnvironment.arch: string`
- Preserves: Android 旧请求缺少 `platform/arch` 时自动归一为 `android/""`

- [ ] **Step 1: 先扩展服务端测试输入**

在 `faultReportStore.spec.ts` 保留现有 Android 用例，并增加 PC 输入构造：

```ts
function desktopInput(id: string, clientLogId: string) {
  return {
    reportId: id,
    scene: "desktop_network" as const,
    environment: {
      platform: "desktop" as const,
      arch: "x64",
      appVersion: "1.0.2",
      appVersionCode: 0,
      osVersion: "10.0.26100",
      sdkInt: 0,
      brand: "Windows_NT",
      model: "win32",
      networkType: "unknown",
    },
    logs: [{
      clientLogId,
      occurredAt: 1_700_000_000_000,
      scene: "desktop_network" as const,
      failureType: "system_request_failed",
      methodName: "/api/config/bootstrap",
      requestMethod: "GET",
      requestUrl: "https://example.com/api/config/bootstrap",
      requestParamsJson: "{}",
      nonceId: "",
      responseCode: 503,
      responseBody: "{}",
      resolvedUrl: "",
      errorType: "system",
      errorMessage: "Service Unavailable",
      stackTrace: "",
      songSource: "",
      songId: "",
      quality: "",
    }],
  };
}
```

- [ ] **Step 2: 运行测试确认新场景尚未支持**

Run: `pnpm --dir server test:fault-reports`

Expected: 新增 PC 场景测试因 `scene无效` 或缺少平台字段失败，现有 Android 用例仍通过。

- [ ] **Step 3: 增加幂等数据库迁移**

在 `fault_reports` 建表语句增加：

```sql
platform TEXT NOT NULL DEFAULT 'android',
arch TEXT NOT NULL DEFAULT '',
```

新增 `migrateFaultReports(db)`，使用 `PRAGMA table_info(fault_reports)` 检查后执行 `ALTER TABLE`，并在 `initSchema()` 中调用。已有记录必须自动保持 `platform='android'`。

- [ ] **Step 4: 扩展校验、持久化和后台返回类型**

```ts
export const FAULT_REPORT_SCENES = ["play_url", "desktop_network"] as const;
export const FAULT_REPORT_PLATFORMS = ["android", "desktop"] as const;

export type FaultReportEnvironment = {
  platform: "android" | "desktop";
  arch: string;
  appVersion: string;
  appVersionCode: number;
  osVersion: string;
  sdkInt: number;
  brand: string;
  model: string;
  networkType: string;
};
```

缺少 `platform` 时根据 scene 推导：`desktop_network -> desktop`，其余为 `android`；非空但不在白名单的值返回 400。INSERT、row mapper、列表和详情都必须带回 `platform/arch`。

- [ ] **Step 5: 补齐兼容与去重断言**

测试必须断言：旧 Android 输入归一为 `platform=android`；PC 输入成功保存并读回 `desktop/x64`；PC 相同 `clientLogId` 重复提交时仍按现有规则去重。

- [ ] **Step 6: 运行服务端测试和构建**

Run: `pnpm --dir server test:fault-reports`

Run: `pnpm --dir server build`

Expected: 故障上报用例全部 PASS，TypeScript 构建通过。

- [ ] **Step 7: 提交服务端契约**

```powershell
git add -- server/src/db/appDb.ts server/src/db/faultReportStore.ts server/src/db/faultReportStore.spec.ts
git commit -m "扩展PC端故障上报服务契约"
```

---

### Task 2: PC 本地错误上传状态与隐私脱敏

**Files:**
- Create: `yixi/electron/faultReport/types.ts`
- Create: `yixi/electron/faultReport/sanitizer.ts`
- Create: `yixi/electron/faultReport/payload.ts`
- Create: `yixi/electron/faultReport/sanitizer.test.ts`
- Create: `yixi/electron/faultReport/payload.test.ts`
- Create: `yixi/electron/database/appDatabase.faultReport.test.ts`
- Create: `yixi/vitest.fault-report.config.ts`
- Modify: `yixi/electron/database/schema.ts`
- Modify: `yixi/electron/database/types.ts`
- Modify: `yixi/electron/database/appDatabase.ts`
- Modify: `yixi/package.json`

**Interfaces:**
- Produces: `sanitizeNetworkErrorInput(input): NetworkErrorRecordInput`
- Produces: `toDesktopFaultReportLog(record): FaultReportLogPayload`
- Produces: `AppDatabase.getNetworkErrorFaultStats(): DesktopFaultReportStats`
- Produces: `AppDatabase.listPendingNetworkErrors(limit): PendingNetworkErrorRecord[]`
- Produces: `AppDatabase.markNetworkErrorsUploaded(clientLogIds, uploadedAt): number`

- [ ] **Step 1: 定义本地统计和待上报记录类型**

```ts
export type DesktopFaultReportStats = {
  totalCount: number;
  recentSevenDaysCount: number;
  pendingCount: number;
  latestOccurredAt: number | null;
  lastReportedAt: number | null;
};

export type PendingNetworkErrorRecord = NetworkErrorRecordDetail & {
  clientLogId: string;
  uploaded: false;
};
```

- [ ] **Step 2: 先写脱敏和 DTO 映射测试**

测试覆盖：URL 查询中的 token/sign/password 被替换为 `[REDACTED]`；嵌套对象和数组递归脱敏；普通字段保留；超长内容按契约截断；PC DTO 使用 `scene=desktop_network`、稳定 `clientLogId`、正确 HTTP 状态和业务码。

- [ ] **Step 3: 实现双层脱敏**

新错误写入 SQLite 前调用 `sanitizeNetworkErrorInput()`，避免继续把敏感参数落盘；历史记录转换上传 DTO 时再次调用 sanitizer，保证旧数据不会原样外发。序列化失败时回退为 `"[Unserializable]"`，不得让单条脏数据阻断整个页面。

- [ ] **Step 4: 幂等迁移本地错误表**

新建表定义增加：

```sql
client_log_id TEXT,
is_uploaded INTEGER NOT NULL DEFAULT 0,
uploaded_at TEXT,
```

`ensureNetworkErrorUploadColumns(db)` 必须：

1. 用 `PRAGMA table_info(network_error_records)` 幂等增加缺失列；
2. 为历史行逐条生成 `randomUUID()` 并回填空 `client_log_id`；
3. 建立 `CREATE UNIQUE INDEX IF NOT EXISTS ux_network_error_client_log_id`；
4. 建立 `is_uploaded, created_at` 查询索引；
5. 写入新的 `schema_migrations` 版本记录。

- [ ] **Step 5: 扩展 AppDatabase 精确上传 API**

`addNetworkErrorRecord()` 每条写入生成 UUID、`is_uploaded=0`。统计按 ISO `created_at` 计算总数、最近 7 天、待上报数、最新错误和最近 `uploaded_at`；待上报查询按时间升序最多 300 条；标记上传使用参数化 `client_log_id IN (...)`，空数组直接返回 0。

- [ ] **Step 6: 增加内存数据库测试**

使用 `new AppDatabase(":memory:")` 验证：新增两条记录得到不同 UUID；初始 pending=2；精确标记一条后 pending=1；`lastReportedAt` 有值；另一条不被误更新。

- [ ] **Step 7: 配置聚焦测试命令**

```json
"test:fault-report": "vitest run --config vitest.fault-report.config.ts"
```

配置只包含 `electron/faultReport/**/*.test.ts` 和数据库故障上传测试。

- [ ] **Step 8: 运行测试**

Run: `pnpm --dir yixi test:fault-report`

Expected: 脱敏、映射、SQLite 精确回写测试全部 PASS。

- [ ] **Step 9: 提交本地故障数据层**

```powershell
git add -- yixi/electron/faultReport yixi/electron/database/schema.ts yixi/electron/database/types.ts yixi/electron/database/appDatabase.ts yixi/vitest.fault-report.config.ts yixi/package.json
git commit -m "完善PC端故障日志上报数据层"
```

---

### Task 3: Main 侧上报服务与最小 IPC

**Files:**
- Create: `yixi/electron/faultReport/desktopFaultReportService.ts`
- Create: `yixi/electron/ipc/faultReportIpc.ts`
- Modify: `yixi/electron/system/types.ts`
- Modify: `yixi/electron/system/systemClient.ts`
- Modify: `yixi/electron/ipc/debugIpc.ts`
- Modify: `yixi/electron/main.ts`
- Modify: `yixi/electron/preload.ts`
- Modify: `yixi/src/types/electron.d.ts`

**Interfaces:**
- Produces IPC: `fault-report:stats`
- Produces IPC: `fault-report:submit-pending`
- Produces: `getDesktopFaultReportStats(): DesktopFaultReportStats`
- Produces: `submitPendingDesktopFaultReport(): Promise<DesktopFaultReportSubmitResult>`

- [ ] **Step 1: 定义系统接口 DTO 和环境采集**

PC 环境固定映射：

```ts
const environment = {
  platform: "desktop" as const,
  arch: process.arch,
  appVersion: app.getVersion(),
  appVersionCode: 0,
  osVersion: os.release(),
  sdkInt: 0,
  brand: os.type(),
  model: process.platform,
  networkType: "unknown",
};
```

不采集 hostname、用户名、完整本机路径、MAC、IP 或硬件序列号。

- [ ] **Step 2: 防止上报失败自激记录**

给 main-only `RequestOptions` 增加 `recordFailure?: boolean`，默认 `true`。`requestSystem()` 在 HTTP 失败和 catch 分支中仅当 `recordFailure !== false` 时调用 `recordNetworkError()`；其他系统接口行为不变。

- [ ] **Step 3: 实现 AES-GCM 上报方法**

```ts
export async function submitDesktopFaultReport(body: FaultReportRequest) {
  const session = getAccountSession();
  const response = await requestSystem<FaultReportSubmitData>("/api/fault-reports", {
    method: "POST",
    body,
    recordFailure: false,
    headers: session.loggedIn ? { Authorization: `Bearer ${session.token}` } : undefined,
  });
  return unwrapResponse(response);
}
```

- [ ] **Step 4: 实现批次 service**

读取最多 300 条待上报记录；为空时抛出“暂无待上报的故障信息”；使用 `randomUUID()` 生成 reportId；响应成功后无论 accepted 还是 duplicate，都只标记本批 clientLogId，因为 duplicate 表示服务端已有该日志。返回 `acceptedCount/duplicateCount/receivedCount/remainingCount/createdAt` 供 UI 提示。

- [ ] **Step 5: 注册最小正式 IPC**

`faultReportIpc.ts` 只注册统计和提交，不提供原始日志读取。`main.ts` 在 `setupAppIpc()` 中调用 `setupFaultReportIpc()`；preload 和 `electron.d.ts` 使用同名 typed API：

```ts
getFaultReportStats: () => Promise<DesktopFaultReportStats>;
submitPendingFaultReport: () => Promise<DesktopFaultReportSubmitResult>;
```

- [ ] **Step 6: 从 main 层封死正式版 debug IPC**

`debug:network-errors:list/detail/export` 每个 handler 首行调用：

```ts
function assertDevelopmentRuntime() {
  if (app.isPackaged) throw new Error("该调试功能仅开发环境可用");
}
```

这样即使正式版 renderer 被注入脚本，也不能读取或导出原始错误。

- [ ] **Step 7: 运行聚焦测试与构建**

Run: `pnpm --dir yixi test:fault-report`

Run: `pnpm --dir yixi build:t`

Expected: 测试通过，main/preload/renderer 类型一致，Electron 构建通过。

- [ ] **Step 8: 提交 main 和 IPC**

```powershell
git add -- yixi/electron/faultReport/desktopFaultReportService.ts yixi/electron/ipc/faultReportIpc.ts yixi/electron/system/types.ts yixi/electron/system/systemClient.ts yixi/electron/ipc/debugIpc.ts yixi/electron/main.ts yixi/electron/preload.ts yixi/src/types/electron.d.ts
git commit -m "接入PC端故障上报服务与安全IPC"
```

---

### Task 4: 高级设置正式版故障上报 UI

**Files:**
- Modify: `yixi/src/views/setting.vue`
- Modify: `yixi/src/components/setting/basic/AdvanceSetting.vue`

**Interfaces:**
- Consumes: `getFaultReportStats()`
- Consumes: `submitPendingFaultReport()`
- Preserves: 开发环境现有 Cookie 调试、错误分页、详情和导出交互

- [ ] **Step 1: 高级设置 Tab 始终显示**

移除 `setting.vue` 中高级设置 `n-tab-pane` 的 `v-if="isDev"`，同时删除该页面不再使用的 runtime store 引用。其他 Tab 顺序和内容不变。

- [ ] **Step 2: 在高级设置顶部增加故障上报区**

布局参考 Android：标题“故障上报”、说明“上报 PC 主进程网络请求失败信息，帮助定位服务和音源连接问题”、统计卡片、隐私提示和主按钮。统计展示：累计错误、最近 7 天、待上报、最近错误、上次上报；场景固定显示“PC 网络请求”。

- [ ] **Step 3: 增加确认和提交状态**

使用现有 Naive UI `n-popconfirm`，确认文案明确“将上传经过脱敏的请求地址、参数、响应摘要和系统版本，不包含 Cookie、账号密码和本地文件”。提交期间按钮 loading 并禁止重复点击；成功提示本批数量和剩余数量，失败显示简洁消息并保留 pending 状态。

- [ ] **Step 4: 保持开发区条件渲染**

最终模板结构必须是：

```vue
<section class="fault-report-section">...</section>

<template v-if="isDev">
  <section class="debug-section">Cookie 调试...</section>
  <section class="debug-section">Debug 网络错误记录...</section>
</template>
```

删除原正式版“当前暂无需要在正式环境展示的高级配置”空态。详情 Modal 也必须放在 `v-if="isDev"` 范围内，避免正式版创建原始错误详情组件。

- [ ] **Step 5: 检查空态和批次边界**

待上报为 0 时按钮禁用并显示“暂无待上报信息”；超过 300 条时一次只报 300 条，成功后重新加载统计并允许继续上报剩余批次；统计加载失败不展示伪造的 0，应显示加载失败提示和重试按钮。

- [ ] **Step 6: 构建验证**

Run: `pnpm --dir yixi build:t`

Expected: Vue 类型检查和 Electron 构建通过。

- [ ] **Step 7: 提交设置 UI**

```powershell
git add -- yixi/src/views/setting.vue yixi/src/components/setting/basic/AdvanceSetting.vue
git commit -m "增加PC端高级设置故障上报入口"
```

---

### Task 5: 管理后台区分 Android 与 PC 故障

**Files:**
- Modify: `server/admin/src/types/config.ts`
- Modify: `server/admin/src/utils/faultReports.ts`
- Modify: `server/admin/src/components/tabs/FaultReportsManagementTab.tsx`
- Modify: `server/admin/src/components/modals/FaultReportDetailModal.tsx`
- Modify: `server/admin/src/utils/faultReportExport.ts`

**Interfaces:**
- Consumes: `scene=desktop_network`
- Consumes: `platform/arch`
- Preserves: Android 故障筛选、详情、状态流转、单条导出和批次 ZIP 导出

- [ ] **Step 1: 扩展后台类型和标签**

```ts
export type FaultReportScene = "play_url" | "desktop_network";
export type FaultReportPlatform = "android" | "desktop";

export const FAULT_REPORT_SCENE_LABELS = {
  play_url: "获取播放地址",
  desktop_network: "PC 网络请求",
} satisfies Record<FaultReportScene, string>;
```

列表/详情类型增加 `platform` 和 `arch`。

- [ ] **Step 2: 增加 PC 场景筛选和通用文案**

场景下拉增加“PC 网络请求”；页面说明改为“查看 Android 播放故障与 PC 网络请求错误，维护处理状态”；搜索占位改为“报告 ID、用户 ID、版本、接口路径或错误信息”。

- [ ] **Step 3: 按平台显示环境摘要**

Android 继续显示 `Android <osVersion> / SDK <sdkInt> / <brand> <model>`；PC 显示 `<brand> <osVersion> / <model> <arch>`，不得再把 PC 报告硬编码显示为 Android。

- [ ] **Step 4: 按场景显示日志详情**

`play_url` 保持歌曲来源、歌曲 ID、音质、解析地址等现有块；`desktop_network` 的 summary 显示请求方法与接口路径，详情显示请求地址、HTTP/业务码、请求参数、响应摘要、错误类型和错误消息，不显示空的歌曲/音质字段。

- [ ] **Step 5: 更新导出元数据**

单条 JSON 和 ZIP 内每条 JSON 的 report 信息增加 `platform/arch`；文件名继续使用场景中文名、用户和时间，现有安全文件名规则不变。

- [ ] **Step 6: 构建管理后台**

Run: `pnpm --dir server/admin build`

Expected: TypeScript 与 Vite 构建通过，Android/PC union type 无遗漏分支。

- [ ] **Step 7: 提交管理后台适配**

```powershell
git add -- server/admin/src/types/config.ts server/admin/src/utils/faultReports.ts server/admin/src/components/tabs/FaultReportsManagementTab.tsx server/admin/src/components/modals/FaultReportDetailModal.tsx server/admin/src/utils/faultReportExport.ts
git commit -m "适配后台PC端故障上报展示"
```

---

### Task 6: 文档、审计与交付验证

**Files:**
- Modify: `AGENTS.md`
- Modify: `yixi/AGENTS.md`
- Modify: `docs/spec-plans/desktop-fault-report/desktop-fault-report.md`

**Interfaces:**
- Documents: 数据源、脱敏、300 条批次、精确回写、IPC、安全边界、服务端场景和验证命令。

- [ ] **Step 1: 更新项目上下文**

根文档补充 PC `desktop_network` 与 Android `play_url` 共用 `/api/fault-reports`；桌面端文档补充 `electron/faultReport/`、高级设置正式/开发环境展示边界，以及 debug IPC 必须由 main 校验打包状态。

- [ ] **Step 2: 执行隐私边界审计**

Run: `rg -n "fault-report:|desktop_network|client_log_id|is_uploaded|recordFailure" yixi server AGENTS.md`

Expected: renderer 仅见汇总/提交 IPC；真实 baseURL、Bearer token、SQLite 明细和脱敏实现只在 main/server；上报请求显式 `recordFailure: false`。

- [ ] **Step 3: 检查正式版调试区隔离**

Run: `rg -n "isDev|assertDevelopmentRuntime|debug:network-errors" yixi/src/components/setting/basic/AdvanceSetting.vue yixi/electron/ipc/debugIpc.ts`

Expected: 原始错误 UI 受 `isDev` 控制，三个 debug handler 都在 main 侧拒绝 packaged runtime；故障汇总区不受 `isDev` 控制。

- [ ] **Step 4: 最终自动验证**

Run: `pnpm --dir server test:fault-reports`

Run: `pnpm --dir server build`

Run: `pnpm --dir server/admin build`

Run: `pnpm --dir yixi test:fault-report`

Run: `pnpm --dir yixi build:t`

Run: `git diff --check`

Expected: 全部通过；`git status --short` 中 `pm/app/build.gradle.kts` 仍是用户原改动，未被本功能提交包含。

- [ ] **Step 5: 用户手测清单**

开发版：高级设置能看到汇总、Cookie 调试和网络错误列表；上报成功后 pending 精确减少；详情与 JSON 导出仍可用。

正式版：高级设置 Tab 可见；只出现故障汇总和上报区；不出现 Cookie、错误表格、详情、导出；通过 DevTools 手工调用 debug IPC 也应收到“仅开发环境可用”。

服务端后台：Android 报告仍按原样显示；PC 报告显示 Windows/架构和网络请求字段；匿名/登录报告都能查看、导出和流转状态。

失败场景：离线点击上报提示失败且 pending 不变；故障上报请求失败不会新增一条同类错误；重新联网后可再次上报。

- [ ] **Step 6: 完成记录与最终提交**

在本计划顶部增加实际执行状态、测试结果和提交号，然后只暂存文档：

```powershell
git add -- AGENTS.md yixi/AGENTS.md docs/spec-plans/desktop-fault-report/desktop-fault-report.md
git commit -m "补充PC端故障上报架构说明"
```

---

## 执行波次与检查点

- Wave 1：Task 1，先落服务端向后兼容契约；检查点为 Android 旧用例和 PC 新用例同时通过。
- Wave 2：Task 2，完成 PC 本地 UUID、pending 状态、脱敏和 DTO；检查点为 SQLite 精确回写测试通过。
- Wave 3：Task 3，接入 main service、AES-GCM 和安全 IPC；检查点为 `test:fault-report + build:t` 通过。
- Wave 4：Task 4 与 Task 5，分别完成 PC UI 和管理后台展示；检查点为两个前端构建通过。
- Wave 5：Task 6，完成安全审计、全量轻量验证、文档和用户手测交付。

## 自检结果

- 需求覆盖：高级设置正式版可见、故障上报区、开发版原始记录保留、正式版原始记录隐藏均有明确任务。
- 契约一致：PC 与 Android 共用现有故障接口，但通过 scene/platform 区分；Android 缺省字段向后兼容。
- 数据一致：本地日志 UUID 稳定，服务端按 UUID 去重，客户端只精确回写本批日志；单批上限与服务端 300 条一致。
- 隐私安全：新旧数据上传前都会脱敏；正式版 main IPC 也禁止原始明细读取；不上报日志文件、Cookie 和本机身份信息。
- 失败闭环：上报请求禁用自身错误记录，失败不改 pending，成功后可继续处理超过 300 条的剩余批次。
- 测试边界：覆盖高风险纯逻辑、SQLite 回写和服务端兼容，不引入复杂 UI/E2E；其余交由用户安装包手测。
