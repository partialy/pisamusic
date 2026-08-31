# PisaMusic PC 听歌时长与等级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `yixi/` PC 客户端接入现有听歌时长 V1 契约，可靠采集并补传真实播放片段，并在头像下拉菜单中用两个独立 item 显示“等级：Lv N”和“累计听歌：n分钟”。

**Architecture:** renderer 只把 Howler 的实际播放边沿转换为平台无关的 `ListeningPlaybackObservation`，不直接持有账号 token、服务端地址或 SQLite。main 进程的独立 listening Module 负责账号隔离、单调时钟计时、60 秒本地 checkpoint、最长 15 分钟切片、15 分钟批量上报、启动/登录补传和权威汇总缓存；网络直接复用外层 `server` 已有 `/api/listening/*` V1 接口与 `requestSystem()` 加密鉴权链路。

**Tech Stack:** Electron 37、Vue 3、TypeScript 5.8、Pinia、Howler、Naive UI、Node `node:sqlite`、Vitest。

## Global Constraints

- 本计划只修改 `yixi/`、`yixi/AGENTS.md` 和本计划文件；不修改 `server/`、`pm/`、`pm-electron/` 或现有服务端接口。
- 服务端权威契约以 `server/apidoc/user/listening.md` 为准：`schemaVersion=1`、`platform="desktop"`、每批 `1..200` 条、Header 必须携带稳定的 `x-pm-device-id`。
- 只为已登录的 PisaMusic 系统账号采集和上报；KG/WY 第三方 Cookie 登录不能代替系统账号。
- 本地 checkpoint、pending 片段和汇总缓存必须按 `accountId` 隔离；切换账号时绝不能把旧账号片段用新账号 token 上报。
- 支持的统计来源固定为 `kg`、`wy`、`kw`、`cloud`、`local`；当前 `Song.source="qq"` 不在 V1 契约内，必须跳过且不得伪装成其他来源。
- 本地歌曲只上传不透明的 `song.id` 和展示快照；不得上传 `filePath`、`file://`、播放 URL、歌词、封面、Cookie 或 renderer/Howler 实现字段。
- 真实播放计时只覆盖 Howler 已触发 `onplay` 且尚未 `onpause/onstop/onend/onplayerror` 的区间；加载、缓冲、暂停和播放失败时间不得累计。
- 使用单调时钟计算 `activeDurationMs`，使用校准后的墙钟生成绝对区间；单个不可变片段最长 15 分钟，满足服务端 16 分钟上限和时间差误差不超过 5 秒的校验。
- 每 60 秒持久化开放片段 checkpoint，每 15 分钟尝试批量上报；没有 pending 片段时不发请求。
- App 启动必须等待账号 session 刷新完成后再补传；每个启动周期、每个账号最多主动补传一次，失败后交给后续 15 分钟调度。
- 头像下拉中新增两个不可点击 item，文案固定为 `等级：Lv N`、`累计听歌：n分钟`；累计值始终使用服务端 `totalMinutes=floor(totalMs/60000)`，本轮不转换成小时。
- 汇总请求失败时保留最近一次账号隔离缓存；从未成功获取时回退为 `等级：Lv 1`、`累计听歌：0分钟`，不得因菜单打开失败弹出重复错误提示。
- 不做复杂测试：只新增纯规则聚焦单测，运行 `pnpm --dir yixi test:listening`、`pnpm --dir yixi build:t` 和 `git diff --check`；不启动 Electron、不打包、不做完整测试套件。
- 修改 SQLite、IPC、账号生命周期或播放器采集边界后同步更新 `yixi/AGENTS.md`。

---

## File Structure

### Shared and renderer

- Create `yixi/src/types/listening.ts`：renderer、preload 与 main 共用的播放观察、片段、批量响应和汇总类型；不包含 token、URL 或文件路径。
- Create `yixi/src/listening/listeningPlaybackAdapter.ts`：把 `Song` 与 Howler 回调归一化为一个原子观察，并过滤 `qq`、无 ID 与不合规本地 ID。
- Modify `yixi/src/store/audio.ts`：只在已有 Howler 回调和明确的换歌/失败路径调用 Adapter，不写 SQLite、不发 HTTP。
- Modify `yixi/src/components/Header.vue`：头像下拉加入两个统计 item，并在菜单展开时刷新权威汇总。
- Modify `yixi/src/App.vue`：renderer 初始化完成后同步当前播放快照，卸载前发送最后一次 inactive 观察。
- Modify `yixi/src/types/electron.d.ts`：为 listening IPC 增加完整类型。

### Main process

- Create `yixi/electron/listening/listeningRules.ts`：纯校验、来源映射、片段时长/切片规则和默认汇总。
- Create `yixi/electron/listening/listeningRules.test.ts`：覆盖 V1 来源、本地 ID、片段上限和默认汇总。
- Create `yixi/electron/listening/listeningStore.ts`：只负责 active checkpoint、pending fragment、rejected 状态与 summary cache 的 SQLite 读写。
- Create `yixi/electron/listening/listeningClient.ts`：封装 `/api/listening/fragments/batch` 与 `/api/listening/summary`，复用 `requestSystem()`。
- Create `yixi/electron/listening/listeningManager.ts`：播放状态机、单调时钟、账号隔离、checkpoint、切片、补传、ACK 和汇总编排。
- Create `yixi/electron/listening/index.ts`：提供进程级单例与生命周期入口。
- Create `yixi/electron/ipc/listeningIpc.ts`：注册 `listening:observe` 和 `listening:summary`。
- Modify `yixi/electron/database/schema.ts`：幂等创建三张 listening 本地表与索引。
- Modify `yixi/electron/database/types.ts`、`yixi/electron/database/appDatabase.ts`：增加 listening 数据类型，并把 SQL 委托给 `ListeningStore`，不把业务状态机堆回数据库类。
- Modify `yixi/electron/system/systemClient.ts`：导出当前同步已复用的稳定桌面设备 ID 方法，供 `x-pm-device-id` 使用。
- Modify `yixi/electron/ipc/systemIpc.ts`：在刷新/登录/注册成功和退出账号时通知 `ListeningManager`，但不让补传阻塞登录响应。
- Modify `yixi/electron/preload.ts`：暴露最小化 typed listening API。
- Modify `yixi/electron/main.ts`：注册 listening IPC，并在 `before-quit`、数据库关闭之前同步封存开放片段。
- Create `yixi/vitest.listening.config.ts`、Modify `yixi/package.json`：增加单一聚焦测试命令。

---

### Task 1: 定义 PC V1 DTO 与纯规则

**Files:**
- Create: `yixi/src/types/listening.ts`
- Create: `yixi/electron/listening/listeningRules.ts`
- Create: `yixi/electron/listening/listeningRules.test.ts`
- Create: `yixi/vitest.listening.config.ts`
- Modify: `yixi/package.json`

**Interfaces:**
- Produces: `ListeningPlaybackObservation`、`ListeningFragment`、`ListeningBatchResult`、`ListeningSummary`、`normalizeListeningTrack()`、`defaultListeningSummary()`。
- Consumes: `Song` from `yixi/src/types/song.d.ts` and the V1 field constraints in `server/apidoc/user/listening.md`.

- [ ] **Step 1: Add the focused test command**

Add to `yixi/package.json`:

```json
"test:listening": "vitest run --config vitest.listening.config.ts"
```

Create `yixi/vitest.listening.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/listening/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 2: Write failing pure-rule tests**

Cover exact behavior:

```ts
expect(normalizeListeningTrack({ source: "kg", id: "123", name: "歌", singer: "歌手", album: "专辑", duration: 180000 })).toMatchObject({ source: "kg", songId: "123" });
expect(normalizeListeningTrack({ source: "qq", id: "123" })).toBeNull();
expect(normalizeListeningTrack({ source: "local", id: "file:C:/music/a.mp3" })).toBeNull();
expect(clampListeningFragmentDuration(16 * 60_000)).toBe(15 * 60_000);
expect(defaultListeningSummary()).toEqual({
  totalMs: 0,
  totalMinutes: 0,
  level: { level: 1, minMinutes: 0, maxMinutes: null },
});
```

Run: `pnpm --dir yixi test:listening`

Expected: FAIL because the rules and types do not exist.

- [ ] **Step 3: Add the shared DTOs**

Use these stable contracts in `yixi/src/types/listening.ts`:

```ts
export type ListeningSource = "kg" | "wy" | "kw" | "cloud" | "local";
export type ListeningTerminalReason = "natural_end" | "manual_next" | "stop" | "error" | "app_exit";

export type ListeningTrackSnapshot = {
  source: ListeningSource;
  songId: string;
  title: string;
  artist: string;
  album: string;
  trackDurationMs: number | null;
};

export type ListeningPlaybackObservation = {
  track: ListeningTrackSnapshot | null;
  active: boolean;
  terminalReason: ListeningTerminalReason | null;
};

export type ListeningFragment = ListeningTrackSnapshot & {
  eventId: string;
  playSessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  activeDurationMs: number;
  terminalReason: ListeningTerminalReason | null;
};

export type ListeningSummary = {
  totalMs: number;
  totalMinutes: number;
  level: { level: number; minMinutes: number; maxMinutes: number | null };
};

export type ListeningBatchResult = {
  accepted: string[];
  duplicate: string[];
  rejected: Array<{ eventId: string; reason: string }>;
  summary: ListeningSummary;
  serverTimeMs: number;
};
```

- [ ] **Step 4: Implement strict normalization and defaults**

`normalizeListeningTrack()` must trim IDs/text, cap title/artist/album at 512 characters, convert duration to positive integer milliseconds or `null`, reject `qq`, and reject local IDs beginning with `file:`/`content:` or containing `/`/`\\`. It must never copy `url` or `filePath`.

- [ ] **Step 5: Run the focused rules test**

Run: `pnpm --dir yixi test:listening`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- yixi/src/types/listening.ts yixi/electron/listening/listeningRules.ts yixi/electron/listening/listeningRules.test.ts yixi/vitest.listening.config.ts yixi/package.json
git commit -m "功能（yixi）：定义听歌时长V1客户端契约"
```

### Task 2: 增加账号隔离的本地 listening 存储

**Files:**
- Create: `yixi/electron/listening/listeningStore.ts`
- Modify: `yixi/electron/database/schema.ts`
- Modify: `yixi/electron/database/types.ts`
- Modify: `yixi/electron/database/appDatabase.ts`

**Interfaces:**
- Produces: `saveActiveCheckpoint()`、`readActiveCheckpoint()`、`clearActiveCheckpoint()`、`insertPendingFragment()`、`listPendingFragments()`、`ackFragments()`、`rejectFragments()`、`readSummaryCache()`、`saveSummaryCache()`。
- Consumes: `ListeningFragment` and `ListeningSummary` from Task 1.

- [ ] **Step 1: Add three idempotent tables**

Add to `migrateDatabase()`:

```sql
CREATE TABLE IF NOT EXISTS listening_active_checkpoint (
  account_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  play_session_id TEXT NOT NULL,
  track_json TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  active_duration_ms INTEGER NOT NULL,
  checkpointed_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS listening_pending_fragments (
  event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  fragment_json TEXT NOT NULL,
  upload_state TEXT NOT NULL DEFAULT 'pending' CHECK (upload_state IN ('pending', 'rejected')),
  reject_reason TEXT NOT NULL DEFAULT '',
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listening_pending_account_state
  ON listening_pending_fragments(account_id, device_id, upload_state, created_at_ms);

CREATE TABLE IF NOT EXISTS listening_summary_cache (
  account_id TEXT PRIMARY KEY,
  summary_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
```

- [ ] **Step 2: Implement a focused SQL store**

`ListeningStore` receives the existing `DatabaseSync` from `AppDatabase`. All writes use prepared statements; pending selection is ordered by `created_at_ms` and limited to 200. `ackFragments()` deletes only server `accepted` and `duplicate` IDs for the same account/device; `rejectFragments()` marks IDs as `rejected` with the returned reason so they do not retry forever.

- [ ] **Step 3: Delegate through AppDatabase**

Construct one `ListeningStore` beside the existing database helpers and expose thin methods. Do not expose raw `DatabaseSync` through preload or IPC.

- [ ] **Step 4: Perform the schema smoke check**

Run: `pnpm --dir yixi build:t`

Expected: TypeScript and Electron Vite build exit 0; no runtime database file is committed.

- [ ] **Step 5: Commit**

```powershell
git add -- yixi/electron/listening/listeningStore.ts yixi/electron/database/schema.ts yixi/electron/database/types.ts yixi/electron/database/appDatabase.ts
git commit -m "功能（yixi）：增加听歌片段本地存储"
```

### Task 3: 封装听歌接口与 main 进程状态机

**Files:**
- Create: `yixi/electron/listening/listeningClient.ts`
- Create: `yixi/electron/listening/listeningManager.ts`
- Create: `yixi/electron/listening/index.ts`
- Modify: `yixi/electron/system/systemClient.ts`

**Interfaces:**
- Produces:

```ts
class ListeningManager {
  observe(observation: ListeningPlaybackObservation): void;
  onAccountSessionReady(accountId: string): Promise<void>;
  onAccountLogout(): void;
  getCurrentSummary(): Promise<ListeningSummary>;
  flush(reason: "startup" | "login" | "interval" | "manual"): Promise<void>;
  shutdown(): void;
}
```

- Consumes: Task 1 DTO/rules, Task 2 store, `requestSystem()` and the stable desktop device client ID.

- [ ] **Step 1: Export the stable desktop device ID**

Change the existing private `getDesktopDeviceClientId()` in `systemClient.ts` to an exported function without changing its SQLite key (`desktop-device-client-id`) or generation behavior. Listening must use the same stable client ID already used by sync.

- [ ] **Step 2: Implement the encrypted listening client**

```ts
export async function uploadListeningFragments(deviceId: string, fragments: ListeningFragment[]) {
  const response = await requestSystem<ListeningBatchResult>("/api/listening/fragments/batch", {
    method: "POST",
    headers: { "x-pm-device-id": deviceId },
    body: { schemaVersion: 1, platform: "desktop", fragments },
  });
  return unwrapResponse(response);
}

export async function fetchListeningSummary() {
  return unwrapResponse(await requestSystem<ListeningSummary>("/api/listening/summary"));
}
```

Do not manually add `Authorization`; `requestSystem()` reads the main-side account session and applies encryption. Do not persist signed URLs or token values.

- [ ] **Step 3: Implement playback edge handling**

The manager keeps the latest normalized observation in memory. An active edge with a valid account/device/track opens a segment and creates a `playSessionId` if no compatible session exists. Pause closes the current segment without ending the play session; `natural_end/manual_next/stop/error/app_exit` closes the segment and ends the play session. Duplicate observations are no-ops, and a track identity change defensively closes the old session as `manual_next` before starting the new one.

- [ ] **Step 4: Implement checkpoint and 15-minute cutting**

Use `performance.now()` or `process.hrtime.bigint()` for active elapsed time. Every 60 seconds persist the open checkpoint; at 15 minutes, terminal events, pause, account logout or shutdown, materialize one immutable fragment and reopen the same session only when playback remains active. On next launch, recover only the duration saved in the last checkpoint, so a crash can lose at most 60 seconds but never invent post-crash listening time.

- [ ] **Step 5: Implement account-safe flush and cache**

For one flush, snapshot current `accountId + deviceId`, select at most 200 matching `pending` rows, and re-check that the account is unchanged before applying ACKs. Delete accepted/duplicate IDs, mark rejected IDs, persist response `summary`, update the in-memory server-time offset from `serverTimeMs`, and single-flight concurrent flush requests.

`onAccountSessionReady()` must attempt startup/login recovery at most once per account per process. If the latest renderer observation is still active, start a new segment at the login/session-ready moment and never backfill logged-out playback time. The 15-minute interval can retry later. `getCurrentSummary()` first attempts the authoritative GET, saves it on success, and falls back to the same account's cache/default on failure.

- [ ] **Step 6: Commit**

```powershell
git add -- yixi/electron/listening yixi/electron/system/systemClient.ts
git commit -m "功能（yixi）：实现听歌计时与批量补传"
```

### Task 4: 接入账号、IPC 与进程生命周期

**Files:**
- Create: `yixi/electron/ipc/listeningIpc.ts`
- Modify: `yixi/electron/ipc/systemIpc.ts`
- Modify: `yixi/electron/preload.ts`
- Modify: `yixi/src/types/electron.d.ts`
- Modify: `yixi/electron/main.ts`

**Interfaces:**
- Produces: `window.electronAPI.observeListeningPlayback(observation)` and `window.electronAPI.getListeningSummary()`.
- Consumes: `getListeningManager()` from Task 3.

- [ ] **Step 1: Register minimal listening IPC**

```ts
ipcMain.on("listening:observe", (_event, observation) => {
  getListeningManager().observe(observation);
});

ipcMain.handle("listening:summary", () => {
  return getListeningManager().getCurrentSummary();
});
```

Validate and clone renderer input before it reaches the manager. Do not expose flush, token, device ID, database rows or rejection diagnostics to renderer.

- [ ] **Step 2: Add typed preload methods**

```ts
observeListeningPlayback: (observation: ListeningPlaybackObservation) =>
  ipcRenderer.send("listening:observe", cloneIpcPayload(observation)),
getListeningSummary: () => ipcRenderer.invoke("listening:summary") as Promise<ListeningSummary>,
```

- [ ] **Step 3: Notify manager from account IPC**

After account refresh/password login/code login/register succeeds, return the session immediately and trigger `void manager.onAccountSessionReady(session.user.id)`; a补传 failure must not turn a successful login into failure. On refresh failure and explicit logout, call `manager.onAccountLogout()` before clearing/replacing the old account session.

- [ ] **Step 4: Wire application lifecycle**

Call `setupListeningIpc()` from `setupAppIpc()`. In `before-quit`, call `getListeningManager().shutdown()` before `closeAppDatabase()` so an active span is stored with `terminalReason="app_exit"`; do not wait for network during shutdown.

- [ ] **Step 5: Build the IPC contract**

Run: `pnpm --dir yixi build:t`

Expected: main/preload/renderer type checking and Electron Vite build exit 0.

- [ ] **Step 6: Commit**

```powershell
git add -- yixi/electron/ipc/listeningIpc.ts yixi/electron/ipc/systemIpc.ts yixi/electron/preload.ts yixi/src/types/electron.d.ts yixi/electron/main.ts
git commit -m "功能（yixi）：接入听歌统计进程通信"
```

### Task 5: 从 Howler 真实播放事件采集观察

**Files:**
- Create: `yixi/src/listening/listeningPlaybackAdapter.ts`
- Modify: `yixi/src/store/audio.ts`
- Modify: `yixi/src/App.vue`

**Interfaces:**
- Produces: one normalized `ListeningPlaybackObservation` per meaningful playback edge.
- Consumes: typed preload API from Task 4 and `normalizeListeningTrack()` rules from Task 1.

- [ ] **Step 1: Create the renderer Adapter**

Expose explicit methods instead of watching progress ticks:

```ts
export const listeningPlaybackAdapter = {
  active(song: Song, durationMs: number): void,
  paused(song: Song | null, durationMs: number): void,
  terminal(song: Song | null, durationMs: number, reason: ListeningTerminalReason): void,
  sync(song: Song | null, isPlaying: boolean, durationMs: number): void,
};
```

The Adapter only maps fields and sends IPC. It must not generate timestamps, access account state or retain tokens.

- [ ] **Step 2: Emit from exact Howler callbacks**

- `onplay` → `active`。
- `onpause` → `paused`，不结束本次 `playSessionId`。
- `onend` → first emit `terminal(..., "natural_end")`, then execute existing一起听、定时关闭和自动下一首 logic。
- `onloaderror/onplayerror` → emit `terminal(..., "error")` before existing failure handling。
- Explicitly replacing the current song → emit `manual_next` for the old track before `destroyPlayer()` removes callbacks。
- Reset/clear without another track → emit `stop`。

Seeking, quality switching and duplicate `onplay` callbacks must not create a new session or double-count. Single-song repeat creates a new session only after the previous `natural_end` has closed.

- [ ] **Step 3: Synchronize initial and final renderer state**

After `userStore.init()` and `player.loadState()` settle in `bootstrapApp()`, call `listeningPlaybackAdapter.sync(...)`. On renderer unmount send an inactive observation; main `before-quit` remains the authoritative crash/quit safeguard.

- [ ] **Step 4: Run focused compile**

Run: `pnpm --dir yixi build:t`

Expected: build exits 0; existing playback behavior remains unchanged outside the extra observation calls.

- [ ] **Step 5: Commit**

```powershell
git add -- yixi/src/listening/listeningPlaybackAdapter.ts yixi/src/store/audio.ts yixi/src/App.vue
git commit -m "功能（yixi）：采集真实播放片段"
```

### Task 6: 在头像下拉显示等级与累计分钟

**Files:**
- Modify: `yixi/src/components/Header.vue`

**Interfaces:**
- Consumes: `window.electronAPI.getListeningSummary()` from Task 4.
- Produces: two non-interactive account dropdown items with exact requested copy.

- [ ] **Step 1: Make account options reactive**

Change `dropDownOptions` from a static array to `computed<DropdownOption[]>`. The first two entries are:

```ts
{
  label: `等级：Lv ${listeningSummary.value.level.level}`,
  key: "listening-level",
  disabled: true,
},
{
  label: `累计听歌：${listeningSummary.value.totalMinutes}分钟`,
  key: "listening-total",
  disabled: true,
},
{ key: "listening-divider", type: "divider" },
```

Keep the existing “用户资料 / 编辑用户资料 / 退出登录” order after this divider. The two statistics are display-only and `handleSelect()` must not route them to `/user/*`.

- [ ] **Step 2: Refresh when the dropdown opens**

Add `@update:show="handleUserMenuVisible"` to the account `n-dropdown`. When `show=true` and the system account is logged in, call `getListeningSummary()` with a latest-request guard; update both items together on success. On failure keep the cached/default summary and do not toast.

- [ ] **Step 3: Reset across account changes**

Watch `userInfo.id`. Immediately reset to the default Lv1/0-minute summary when logged out or changing accounts, then load the new account summary. This prevents the previous account's values flashing in the new account menu.

- [ ] **Step 4: Preserve existing header behavior**

Do not change avatar、昵称、VIP `V` 标识、资料路由、退出登录、设置菜单或本地模式“重新链接”。The account dropdown remains hidden when the PisaMusic system account is logged out.

- [ ] **Step 5: Commit**

```powershell
git add -- yixi/src/components/Header.vue
git commit -m "功能（yixi）：头像菜单展示听歌等级"
```

### Task 7: 文档与轻量验证

**Files:**
- Modify: `yixi/AGENTS.md`
- Review: all files in this plan.

**Interfaces:**
- Documents: PC listening ownership, V1 upload cadence, account isolation, source rules and header copy.

- [ ] **Step 1: Update desktop project rules**

Add a “听歌时长与等级” section recording:

```text
renderer only emits playback observations from Howler edges
main owns SQLite, account token, timekeeping, checkpoint and upload
60-second checkpoint, 15-minute fragment/batch cadence
startup/login once-per-account recovery flush
account/device/event idempotency and exact ACK handling
supported sources kg/wy/kw/cloud/local; qq is not reported
header dropdown copy: 等级：Lv N / 累计听歌：n分钟
```

- [ ] **Step 2: Run only the requested focused checks**

```powershell
pnpm --dir yixi test:listening
pnpm --dir yixi build:t
git diff --check
```

Expected: focused rules tests PASS, TypeScript/Electron Vite build exits 0, and no whitespace errors.

- [ ] **Step 3: Review scope without runtime testing**

Run:

```powershell
git status --short
git diff -- yixi yixi/AGENTS.md docs/superpowers/plans/2026-08-31-desktop-listening-time-and-levels.md
```

Expected: only this PC feature and its plan/documentation are included. Do not start Electron, package Windows, run all Vitest configurations or claim UI/runtime acceptance.

- [ ] **Step 4: Commit**

```powershell
git add -- yixi/AGENTS.md docs/superpowers/plans/2026-08-31-desktop-listening-time-and-levels.md
git commit -m "文档（yixi）：补充PC听歌时长实现约束"
```

---

## Self-Review

- Spec coverage: PC 端真实播放采集、账号隔离、60 秒 checkpoint、15 分钟批量上传、启动/登录补传、服务端权威汇总、头像下拉两个 item、固定分钟文案和轻量验证均已分配到具体任务。
- Contract consistency: `eventId`、`playSessionId`、`source`、`songId`、`startedAtMs`、`endedAtMs`、`activeDurationMs`、`terminalReason` 与既有 V1 API 保持一致；PC 固定发送 `platform="desktop"`。
- Process boundary: renderer 不接触 token/SQLite/服务地址，preload 只暴露 observe/summary，main 统一处理数据库、加密网络、设备 ID 与账号生命周期。
- Data safety: pending、checkpoint、summary cache 均按系统 `accountId` 隔离；第三方登录和新账号不会读取或上传旧账号数据。
- Test boundary: 只规划纯规则聚焦单测、`build:t` 与静态检查，不包含 Electron 启动、Windows 打包或复杂端到端测试。
