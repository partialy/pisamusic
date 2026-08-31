# PisaMusic 听歌时长与等级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 PisaMusic 建立可跨 Android/PC 复用的听歌片段账本，服务端按多设备时间并集计算累计听歌时长和等级，并在管理后台配置连续等级区间；随后由 Android 采集、补传并在“我的”页展示等级与累计时长。

**Architecture:** 客户端只记录带 `source + songId` 的真实连续播放片段，使用 `eventId` 幂等、`playSessionId` 聚合同一次歌曲播放；网络每 15 分钟批量上报，并在 App 启动或登录成功后补传。服务端使用独立 `route -> service -> store` Module 保存事实片段、合并用户全局区间与单曲区间、维护投影统计；等级根据当前累计整数分钟和后台配置动态推导，不写死在用户表。

**Tech Stack:** Node.js 22、TypeScript 6、Express 5、`node:sqlite`、React 18、Vite 5、Tailwind CSS 3；Android Kotlin、Media3、Retrofit、SQLite。

## Global Constraints

- 当前执行阶段只修改 `server/`、根 `AGENTS.md`、`server/apidoc/` 和本计划；Android Task 保留为后续实施清单，本阶段不修改 `pm/`。
- 服务端接口必须同时兼容 Android 和未来 PC；请求体不得出现 Media3、Howler、Activity、renderer 或播放列表下标等平台实现字段。
- 用户 ID 只取 User JWT；设备 ID 只取 `x-pm-device-id`；请求体中的 `platform` 仅允许 `android` 或 `desktop`。
- 歌曲身份固定为规范化小写 `source + songId`，支持 `kg`、`wy`、`kw`、`cloud`、`local`；不同音源不做标题/歌手模糊合并。
- 时间区间统一为半开区间 `[startedAtMs, endedAtMs)`；内部保存毫秒，展示与等级阈值使用 `floor(totalMs / 60000)`。
- 用户总时长对所有设备、所有歌曲区间求并集；单曲时长对同一用户、同一 `source + songId` 求并集；单曲时长之和允许大于用户总时长。
- 等级区间使用整数分钟闭区间：第一档从 0 开始，相邻档必须满足 `next.minMinutes = previous.maxMinutes + 1`，仅最后一级允许 `maxMinutes = null`。
- 默认等级只有 `Lv 1：0 分钟至无上限`，不预设未经用户确认的额外阈值。
- 客户端网络批量上报周期为 15 分钟；本地开放片段 checkpoint 为 30–60 秒；无待上报数据时不发请求。
- App 启动补传必须等待账号 session 恢复/刷新完成；每个启动周期、每个当前账号最多主动尝试一次，失败后交给后续 15 分钟调度。
- 本地歌曲不上传文件路径、`content://`、歌词、封面字节、播放 URL 或 Cookie；服务端只接收不透明本地歌曲 ID和展示快照。
- Android 展示：累计分钟少于 1000 时显示分钟；达到 1000 后显示小时，保留 1 位小数并去掉 `.0`；标签文案为 `Lv N  累计听歌 X 分钟/小时`，位于邮箱下方、VIP 到期标签之后。
- 新增或修改服务端接口时同步更新 `server/apidoc/<module>/` 文档与 `server/apidoc/index.md`；新增模块职责与客户端契约时同步更新根 `AGENTS.md`。

---

## File Structure

### Server Phase（本次执行）

- Create `server/src/db/listeningStore.ts`：只负责听歌事实、区间投影、会话投影、等级配置的 SQLite 读写与事务操作。
- Create `server/src/services/listeningService.ts`：负责批次校验、幂等接收、双维度区间合并、会话计数和权威汇总。
- Create `server/src/services/listeningService.spec.ts`：覆盖重复事件、多设备重叠、不同歌曲并发、会话计数和等级变更。
- Create `server/src/routes/listening.ts`：User JWT 保护的批量上报、汇总和单曲分页查询 HTTP Adapter。
- Create `server/src/routes/adminListening.ts`：Admin JWT 后的等级配置读取/整组替换 HTTP Adapter。
- Modify `server/src/db/appDb.ts`：创建听歌事实、区间、统计、会话与等级表，并插入单一默认等级。
- Modify `server/src/index.ts`：挂载 `/api/listening`。
- Modify `server/src/routes/admin.ts`：挂载 `/api/admin/listening`。
- Modify `server/package.json`：增加 `test:listening` 聚焦测试脚本。
- Create `server/admin/src/types/listening.ts`：后台等级配置类型。
- Create `server/admin/src/api/listening.ts`：等级配置读写请求。
- Create `server/admin/src/components/tabs/ListeningLevelsTab.tsx`：自管理等级区间编辑页面。
- Modify `server/admin/src/constants/theme.ts`：新增“听歌等级”菜单项。
- Modify `server/admin/src/App.tsx`：懒加载并渲染 `ListeningLevelsTab`，不把表单状态堆入 App。
- Create `server/apidoc/user/listening.md`：合并记录三个用户听歌接口的文档。
- Create `server/apidoc/admin/listeningLevels.md`：合并记录两个后台听歌等级接口的文档。
- Modify `server/apidoc/index.md`、`AGENTS.md`：更新模块索引与长期约束。

### Android Phase（后续执行，不在本次 server 阶段修改）

- Create `pm/app/src/main/java/cn/partialy/pm/listening/ListeningModels.kt`：平台无关 DTO、本地事实模型和展示模型。
- Create `pm/app/src/main/java/cn/partialy/pm/listening/ListeningStore.kt`：开放 checkpoint 与 pending 片段 SQLite 访问。
- Create `pm/app/src/main/java/cn/partialy/pm/listening/ListeningManager.kt`：播放器观察、单调时钟、15 分钟调度、启动/登录补传。
- Create `pm/app/src/main/java/cn/partialy/pm/listening/Media3ListeningAdapter.kt`：将当前 `SongInfo + player.isPlaying` 转换为播放观察。
- Modify `pm/app/src/main/java/cn/partialy/pm/utils/localdata/LocalMusicDbOpenHelper.kt`：新增本地表与数据库版本迁移。
- Modify `pm/app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt`：只把统一播放快照交给 Adapter，不直接写库或发网络。
- Modify `pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`、`network/config/ConfigManager.kt`：增加批量上报与查询调用。
- Modify `pm/app/src/main/java/cn/partialy/pm/activity/MainActivity.kt` 和登录成功路径：账号可用后触发一次 pending 补传。
- Modify `pm/app/src/main/res/layout/fragment_mine.xml`、`ui/mine/MineFragment.kt`、`res/values/strings.xml`：邮箱下方、VIP 标签之后展示听歌等级标签。
- Modify `pm/AGENTS.md`：记录听歌 Module、15 分钟批量上报和显示规则。

---

### Task 1: SQLite schema and default level configuration

**Files:**
- Modify: `server/src/db/appDb.ts`
- Test: `server/src/services/listeningService.spec.ts`

**Interfaces:**
- Produces: `listening_fragments`、`listening_play_sessions`、`user_listening_intervals`、`user_track_listening_intervals`、`user_listening_stats`、`user_track_stats`、`listening_level_config`、`listening_level_rules`。
- Invariant: 删除 `users` 行时所有用户听歌事实和投影通过外键级联删除。

- [x] **Step 1: Write the failing schema smoke test**

```ts
const requiredTables = [
  "listening_fragments",
  "listening_play_sessions",
  "user_listening_intervals",
  "user_track_listening_intervals",
  "user_listening_stats",
  "user_track_stats",
  "listening_level_config",
  "listening_level_rules",
];
for (const table of requiredTables) {
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}
```

- [x] **Step 2: Run the test to verify schema is missing**

Run: `pnpm --dir server build && node --test server/dist/services/listeningService.spec.js`

Expected: FAIL because the listening tables do not exist.

- [x] **Step 3: Add the schema and seed the single default level**

Use integer millisecond columns and these keys:

```sql
PRIMARY KEY (user_id, device_id, event_id)
PRIMARY KEY (user_id, device_id, play_session_id)
PRIMARY KEY (user_id, start_ms, end_ms)
PRIMARY KEY (user_id, source, song_id, start_ms, end_ms)
PRIMARY KEY (user_id, source, song_id)
```

Seed with `INSERT OR IGNORE`:

```sql
INSERT OR IGNORE INTO listening_level_config(id, version, updated_at) VALUES (1, 1, 0);
INSERT OR IGNORE INTO listening_level_rules(level, min_minutes, max_minutes, created_at, updated_at)
VALUES (1, 0, NULL, 0, 0);
```

- [x] **Step 4: Re-run the schema test**

Run: `pnpm --dir server build && node --test server/dist/services/listeningService.spec.js`

Expected: schema smoke test PASS; behavioral tests may still fail until later tasks.

### Task 2: Listening store and interval-union primitives

**Files:**
- Create: `server/src/db/listeningStore.ts`
- Test: `server/src/services/listeningService.spec.ts`

**Interfaces:**
- Produces: `insertFragmentIfAbsent()`、`mergeUserInterval()`、`mergeTrackInterval()`、`upsertPlaySession()`、`readListeningSummaryState()`、`listTrackStats()`、`readLevelConfig()`、`replaceLevelConfig()`。
- Consumes: tables from Task 1.

- [x] **Step 1: Add failing union tests**

```ts
assert.equal(mergeCoverage([[0, 30], [10, 20]], [15, 40]).credited, 10);
assert.equal(mergeCoverage([[0, 10], [20, 30]], [10, 20]).mergedEnd, 30);
```

- [x] **Step 2: Implement transactional store operations**

`mergeUserInterval()` and `mergeTrackInterval()` must query overlapping or adjacent canonical rows, sum old coverage, delete only those rows, insert one merged row, and return `creditedMs = mergedLength - oldCoverage`.

```ts
export type CoverageMergeResult = {
  startMs: number;
  endMs: number;
  creditedMs: number;
};
```

- [x] **Step 3: Implement atomic level replacement**

`replaceLevelConfig(expectedVersion, rules)` must start `BEGIN IMMEDIATE`, compare the singleton version, replace all rows, increment version, and roll back on any error. Version mismatch throws `ListeningLevelVersionConflictError`.

- [x] **Step 4: Run focused tests**

Run: `pnpm --dir server build && node --test server/dist/services/listeningService.spec.js`

Expected: interval and level-store tests PASS.

### Task 3: Listening service behavior

**Files:**
- Create: `server/src/services/listeningService.ts`
- Test: `server/src/services/listeningService.spec.ts`

**Interfaces:**
- Produces:

```ts
export function ingestListeningBatch(auth: ListeningAuth, input: unknown): ListeningIngestResult;
export function getListeningSummary(userId: string): ListeningSummary;
export function getListeningTracks(userId: string, query: ListeningTrackQuery): ListeningTrackPage;
export function getListeningLevelConfig(): ListeningLevelConfig;
export function saveListeningLevelConfig(input: unknown): ListeningLevelConfig;
```

- [x] **Step 1: Write failing behavior tests**

Cover exact outcomes:

```text
same eventId + same payload => duplicate, no increment
same eventId + different payload => rejected idempotency conflict
device A 10:00-10:30 + device B 10:10-10:20 => user total 30 minutes
device A song A 10:00-10:30 + device B song B 10:10-10:40 => user total 40, each song 30
same song overlapping on two devices => song total uses union
session crosses qualified threshold once => playCount increments once
qualified session ending natural_end => completedCount increments once
level ranges 0-999 and 1000-null => 999 is Lv1, 1000 is Lv2
```

- [x] **Step 2: Normalize and validate V1 fragments**

Rules:

```text
schemaVersion = 1
platform in android|desktop
1 <= fragments.length <= 200
UUID-like eventId/playSessionId length <= 128
source in kg|wy|kw|cloud|local
songId length 1..256
title/artist/album max 512/512/512
end > start
activeDurationMs > 0
abs((end-start)-activeDurationMs) <= 5000
continuous fragment duration <= 16 minutes
future timestamp <= serverTime + 5 minutes
```

- [x] **Step 3: Apply accepted fragments in one SQLite transaction**

For each newly accepted fragment:

```text
insert immutable fact
merge global user interval and add only credited milliseconds
merge same-track interval and add only credited milliseconds
update play session accumulated active milliseconds and terminal flags
increment playCount/completedCount only when their stored counted flags cross false -> true
refresh title/artist/album/duration snapshot and first/last timestamps
```

Qualified session threshold:

```ts
const thresholdMs = trackDurationMs && trackDurationMs > 0
  ? Math.min(30_000, Math.max(1, Math.floor(trackDurationMs * 0.5)))
  : 30_000;
```

- [x] **Step 4: Derive the current level dynamically**

```ts
const totalMinutes = Math.floor(totalMs / 60_000);
const current = rules.find((rule) =>
  totalMinutes >= rule.minMinutes &&
  (rule.maxMinutes === null || totalMinutes <= rule.maxMinutes)
);
```

Do not persist a user level column.

- [x] **Step 5: Run focused tests**

Run: `pnpm --dir server build && node --test server/dist/services/listeningService.spec.js`

Expected: all listening behavior tests PASS.

### Task 4: User and admin HTTP adapters

**Files:**
- Create: `server/src/routes/listening.ts`
- Create: `server/src/routes/adminListening.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/package.json`

**Interfaces:**
- Produces:

```text
POST /api/listening/fragments/batch
GET  /api/listening/summary
GET  /api/listening/tracks
GET  /api/admin/listening/levels
PUT  /api/admin/listening/levels
```

- [x] **Step 1: Mount the protected user router**

Apply `requireUserJwt` at router level, normalize `x-pm-device-id` to max 128 characters, and pass `{ userId, deviceId }` to the service. The POST response must include accepted, duplicate and rejected IDs plus authoritative summary and `serverTimeMs`.

- [x] **Step 2: Mount the admin router after `requireAdminJwt`**

The PUT body is the complete configuration:

```json
{
  "expectedVersion": 1,
  "rules": [
    { "level": 1, "minMinutes": 0, "maxMinutes": 999 },
    { "level": 2, "minMinutes": 1000, "maxMinutes": null }
  ]
}
```

Return HTTP 409 for `ListeningLevelVersionConflictError`, HTTP 400 for range validation, and HTTP 500 only for unexpected failures.

- [x] **Step 3: Add the focused test script**

```json
"test:listening": "pnpm build && node --test dist/services/listeningService.spec.js"
```

- [x] **Step 4: Build server**

Run: `pnpm --dir server build`

Expected: TypeScript compilation exits 0.

### Task 5: React admin level editor

**Files:**
- Create: `server/admin/src/types/listening.ts`
- Create: `server/admin/src/api/listening.ts`
- Create: `server/admin/src/components/tabs/ListeningLevelsTab.tsx`
- Modify: `server/admin/src/constants/theme.ts`
- Modify: `server/admin/src/App.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/admin/listening/levels` from Task 4.
- Produces: lazy-loaded self-contained “听歌等级” Tab.

- [x] **Step 1: Define frontend types and API client**

```ts
export type ListeningLevelRule = {
  level: number;
  minMinutes: number;
  maxMinutes: number | null;
};

export type ListeningLevelConfig = {
  version: number;
  rules: ListeningLevelRule[];
  updatedAt: number;
};
```

- [x] **Step 2: Build a controlled immutable range editor**

The Tab owns `loading`、`saving`、`config`、`draftRules` and `error` state. Array edits must use immutable `map/filter/spread`; adding a row converts the old last rule from unlimited to a finite end and creates the next unlimited rule. Removing a row reindexes `level` and requires the remaining rows to be contiguous before saving.

Page copy:

```text
标题：听歌等级
说明：按照用户全设备去重后的累计听歌分钟动态计算等级。区间必须连续且不能重叠，最后一级可设为无上限。
```

- [x] **Step 3: Reuse existing glass card/input/button styles**

Use `glassCardClasses` and `glassInputClasses`; do not add a new modal or global state. Each row shows `Lv N`、起始分钟、结束分钟；last row has an “无上限” switch/checkbox and empty max input when enabled.

- [x] **Step 4: Add lazy navigation integration**

Add one `tabs` entry and:

```tsx
const ListeningLevelsTab = lazy(() => import("./components/tabs/ListeningLevelsTab"));
// ...
{currentTab === "listeningLevels" && <ListeningLevelsTab themeColor={themeColor} />}
```

- [x] **Step 5: Build admin**

Run: `pnpm --dir server/admin build`

Expected: TypeScript and Vite build exit 0.

### Task 6: API documentation and project context

**Files:**
- Create: `server/apidoc/user/listening.md`（`POST /fragments/batch`、`GET /summary`、`GET /tracks`）
- Create: `server/apidoc/admin/listeningLevels.md`（`GET/PUT /levels`）
- Modify: `server/apidoc/index.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Documents: all five HTTP endpoints and the cross-device/per-track accounting rules.

- [x] **Step 1: Document exact request/response fields**

两份合并文档必须完整说明五个接口的 JWT/加密要求、设备 Header、半开区间语义、批次上限、幂等冲突行为、等级闭区间和示例请求/响应。

- [x] **Step 2: Add the listening module to the API index**

Insert a new top-level `/api/listening` section before system/admin and add the two admin level endpoints under the admin section; renumber later sections consistently.

- [x] **Step 3: Update root AGENTS.md**

Record that listening facts use a dedicated Module, official total uses all-device union, track stats use same-track union, levels are dynamic inclusive minute ranges, upload cadence is 15 minutes, startup/login perform pending flush, and future PC reuses the same V1 contract.

### Task 7: Server phase verification and review

**Files:**
- Review: all Server Phase files above.

- [x] **Step 1: Run listening tests**

Run: `pnpm --dir server test:listening`

Expected: all listening tests PASS.

- [x] **Step 2: Run server build**

Run: `pnpm --dir server build`

Expected: exit 0.

- [x] **Step 3: Run admin build**

Run: `pnpm --dir server/admin build`

Expected: exit 0 and Vite emits ignored `server/web-admin/` build output only.

- [x] **Step 4: Run whitespace/static review**

Run: `git diff --check`

Expected: no whitespace errors.

- [x] **Step 5: Review scope**

Run: `git status --short` and `git diff -- server AGENTS.md docs/superpowers/plans/2026-08-29-listening-time-and-levels.md`

Expected: only requested server, API docs, project context and plan files are changed; pre-existing `.superpowers/diagnostics/` remains untouched.

### Task 8: Android capture and startup flush（后续阶段）

**Files:**
- Create/Modify: Android Phase files listed in File Structure.

**Interfaces:**
- Consumes: V1 server DTO and endpoints from Task 4.
- Produces: Android Media3 Adapter、SQLite pending/checkpoint、15 分钟调度、启动/登录补传。

- [x] **Step 1: Add local schema and account isolation**

Create `listening_active_checkpoint` and `listening_pending_fragments` in `pm_local_music.db`; every row carries `account_id` and only the same logged-in account may upload it.

- [x] **Step 2: Convert Media3 state to one atomic observation**

```kotlin
data class PlaybackObservation(
    val track: ListeningTrackRef?,
    val active: Boolean,
    val terminalReason: String? = null,
)
```

The Adapter reads current `SongInfo` by `SongType + id`; `PlayerEngine` must not directly perform SQLite/network work.

- [x] **Step 3: Implement checkpoint and flush rules**

Use monotonic elapsed time for `activeDurationMs`, server-time offset for absolute timestamps, 30–60 second local checkpoint, 15 minute immutable fragment cut, startup/login single-flight flush and exact ACK deletion.

- [x] **Step 4: Add Retrofit DTO and repository calls**

Map `SongType` to lower-case source; send `schemaVersion=1`、`platform=android` and the stable device header. Keep all PC-compatible fields unchanged.

### Task 9: Android Mine display（后续阶段）

**Files:**
- Modify: `pm/app/src/main/res/layout/fragment_mine.xml`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt`
- Modify: `pm/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: authoritative `ListeningSummary` cached by `ListeningManager`.
- Produces: `Lv N  累计听歌 X 分钟/小时` tag.

- [x] **Step 1: Add the tag after VIP expiry**

Add `listeningLevelTextView` immediately after `vipExpiryTextView`, reuse `bg_mine_vip_expiry_tag`, 5dp top margin, 11sp text, and hide it for logged-out/no-summary state.

- [x] **Step 2: Add deterministic formatter**

```kotlin
fun formatListeningDuration(totalMinutes: Long): String =
    if (totalMinutes < 1000L) {
        "$totalMinutes 分钟"
    } else {
        val hours = totalMinutes / 60.0
        val formatted = if (hours % 1.0 == 0.0) hours.toLong().toString() else String.format(Locale.CHINA, "%.1f", hours)
        "$formatted 小时"
    }
```

- [x] **Step 3: Render below email/VIP state**

When logged in and summary exists, set `Lv ${level.level}  累计听歌 ${formatListeningDuration(totalMinutes)}`. A hidden VIP tag consumes no layout height, so the listening tag remains directly below the email when VIP is inactive.

- [ ] **Step 4: Run focused Android verification**

> 按用户要求，本轮不执行复杂测试或构建；保留该项待后续手动验证。

Run from `pm/`: `.\gradlew.bat :app:compileDebugKotlin`

Expected: Kotlin/resources compile exits 0; runtime acceptance remains for the user.

---

## Self-Review

- Spec coverage: server/Android split, 15 minute upload, startup/login flush, per-song facts, cross-device union, admin ranges, level display, minute/hour formatting, future PC compatibility and documentation are all assigned to concrete tasks.
- Plan completeness scan: all implementation steps and expected behaviors are specified.
- Type consistency: transport uses `eventId`、`playSessionId`、`source`、`songId`、`startedAtMs`、`endedAtMs`、`activeDurationMs`; service/store/admin/Android tasks use the same names and V1 schema.
- Current execution boundary: execute Tasks 1–7 now; Tasks 8–9 remain unchecked until the user starts the Android phase.
