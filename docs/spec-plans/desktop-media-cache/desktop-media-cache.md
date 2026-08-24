# 桌面端媒体缓存 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让桌面端在线歌曲真正写入用户配置的缓存目录，支持流式播放、Range 拖动、离线命中、容量统计、LRU 清理和手动清空。

**Architecture:** 在 Electron main 中新增深模块 `mediaCache`，renderer 只拿到 `pisacache://media/<cacheKey>` 播放地址。模块内部负责懒解析源站临时 URL、自定义协议流式代理、分片原子落盘、独立 SQLite 索引、缓存目录策略与 LRU；播放调用方不感知文件路径、分片和清理细节。

**Tech Stack:** Electron 37 `protocol.handle`、Node.js Web Streams/文件流、`node:sqlite`、Vue 3 + Pinia、Vitest、TypeScript。

**Execution Status:** 全部完成；缓存协议无扩展名导致 Howler 拒绝加载的问题已补充格式提示，连续播放失败已增加最多 3 首熔断。11 项聚焦测试、`build:t`、`build:win` 和 `git diff --check` 已通过。当前集成测试包（含热门歌曲扁平布局与内容区刷新优化）SHA-256：`ADAC946910E3E49A2F7DF9BE89D6048F31AFD49E78A5A471EF2D8A720BEE509D`。

## Global Constraints

- 只修改 `yixi/`、项目文档和相关 `AGENTS.md`，不得触碰或暂存用户现有 `pm/` 修改。
- 自定义 scheme 必须在 Electron `ready` 之前通过 `protocol.registerSchemesAsPrivileged` 注册，并启用 `standard`、`secure`、`supportFetchAPI`、`stream`。
- renderer 不得获取源站播放 URL、缓存真实文件路径或 SQLite 访问能力。
- 缓存键固定由 `source + songId + qualityKey` 生成，不允许用会过期的源站 URL 作为身份。
- 用户选择的目录下只写入应用专属 `.pisamusic-cache/v1`，清理时只能删除这个受管目录内的文件。
- 空缓存目录使用 `app.getPath("userData")/data/media-cache` 默认目录；目录不可写时回退默认目录并保持在线播放能力。
- `cacheLimitGb = 0` 表示禁用播放缓存；超过上限后按 LRU 清理到上限的 90%。
- 缓存与下载、本地歌曲、Chromium Cache 分离；“清理缓存”不得删除下载歌曲、收藏、账号、日志或主数据库。
- 不新增第三方依赖；不做复杂 Electron 端到端测试，必须通过纯逻辑测试与 `pnpm --dir yixi build:t`。
- 本轮不启动、不安装 App；完成后由用户安装包手测。Git 如需提交，必须仅暂存本任务文件并使用中文消息。

---

## 文件结构与职责

### 新增文件

- `yixi/electron/mediaCache/types.ts`：缓存策略、状态、条目、分片和可播放歌曲类型。
- `yixi/electron/mediaCache/cacheKey.ts`：规范化歌曲身份并生成稳定 SHA-256 cacheKey。
- `yixi/electron/mediaCache/range.ts`：解析单段 Range、Content-Range 和响应区间。
- `yixi/electron/mediaCache/cacheRepository.ts`：独立 `media-cache-index.db` 的 schema 与查询。
- `yixi/electron/mediaCache/cacheStorage.ts`：受管目录、临时文件、分片路径、安全删除和目录可写检查。
- `yixi/electron/mediaCache/mediaCacheManager.ts`：对外深模块，负责 prepare、协议请求、流式写入、状态和 LRU。
- `yixi/electron/mediaCache/index.ts`：注册 scheme、初始化 handler、关闭模块的最小入口。
- `yixi/electron/ipc/mediaCacheIpc.ts`：`media-cache:status/policy/clear` IPC。
- `yixi/electron/mediaCache/*.test.ts`：缓存键、Range、Repository/LRU 关键逻辑测试。
- `yixi/vitest.media-cache.config.ts`：本模块 Vitest 配置。

### 修改文件

- `yixi/electron/main.ts`：ready 前注册 scheme，ready 后挂载协议和 IPC，退出时关闭索引。
- `yixi/electron/ipc/musicIpc.ts`：在线播放改走 `prepareMediaPlaybackUrl`；下载内部仍走原始取链。
- `yixi/electron/preload.ts`：暴露最小缓存状态、刷新策略和清理接口。
- `yixi/src/types/electron.d.ts`：同步缓存状态和 Electron IPC 类型。
- `yixi/src/store/settingStore.ts`：缓存目录/上限保存后通知 main 刷新策略。
- `yixi/src/components/setting/basic/LocalSetting.vue`：显示实际目录、用量、歌曲数和清理按钮。
- `yixi/package.json`：增加 `test:media-cache`。
- `yixi/AGENTS.md`、根 `AGENTS.md`：记录媒体缓存模块、数据边界和验证命令。

---

### Task 1: 缓存契约、缓存键与 Range 规则

**Files:**
- Create: `yixi/electron/mediaCache/types.ts`
- Create: `yixi/electron/mediaCache/cacheKey.ts`
- Create: `yixi/electron/mediaCache/range.ts`
- Create: `yixi/electron/mediaCache/cacheKey.test.ts`
- Create: `yixi/electron/mediaCache/range.test.ts`
- Create: `yixi/vitest.media-cache.config.ts`
- Modify: `yixi/package.json`

**Interfaces:**
- Produces: `createMediaCacheKey(track): string`
- Produces: `parseByteRange(value, totalBytes): ByteRange | null`
- Produces: `parseContentRange(value): ContentRange | null`
- Produces: `MediaCachePolicy`、`MediaCacheStatus`、`MediaCacheTrack`

- [ ] **Step 1: 定义最小对外类型**

```ts
export type MediaCacheTrack = {
  source: "kg" | "wy" | "kw" | "local" | string;
  id?: string;
  urlParam?: string;
  filePath?: string;
  qualityKey?: string;
};

export type MediaCacheStatus = {
  enabled: boolean;
  directory: string;
  limitBytes: number;
  usedBytes: number;
  entryCount: number;
  readyCount: number;
  writingCount: number;
  fallbackDirectory: boolean;
};
```

- [ ] **Step 2: 先写缓存键与 Range 的失败测试**

测试必须覆盖：相同身份得到相同 key、音质变化得到不同 key、单段 Range、开放尾部 Range、非法多段 Range、Content-Range 总长度。

- [ ] **Step 3: 实现缓存键和 Range 纯函数**

缓存身份使用规范化后的 `source`、`urlParam || id`、`qualityKey || "default"`，输出 64 位小写十六进制 SHA-256。Range 只接受 `bytes=start-end`、`bytes=start-` 和 `bytes=-suffix`，多段直接返回 `null`。

- [ ] **Step 4: 配置并运行聚焦测试**

Run: `pnpm --dir yixi test:media-cache`

Expected: 新增纯逻辑测试全部 PASS。

---

### Task 2: 独立缓存索引与安全文件存储

**Files:**
- Create: `yixi/electron/mediaCache/cacheRepository.ts`
- Create: `yixi/electron/mediaCache/cacheStorage.ts`
- Create: `yixi/electron/mediaCache/cacheRepository.test.ts`

**Interfaces:**
- Consumes: `MediaCacheTrack`、`ByteRange`
- Produces: `MediaCacheRepository`
- Produces: `resolveManagedCacheRoot(configuredDirectory)`、`createSegmentPaths(...)`、`removeManagedFiles(...)`

- [ ] **Step 1: 创建可重建的独立索引 schema**

```sql
CREATE TABLE IF NOT EXISTS media_cache_entries (
  cache_key TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  song_id TEXT NOT NULL,
  quality_key TEXT NOT NULL,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  cached_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  status TEXT NOT NULL DEFAULT 'partial',
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_cache_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL,
  start_byte INTEGER NOT NULL,
  end_byte INTEGER NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  UNIQUE(cache_key, start_byte, end_byte)
);
```

- [ ] **Step 2: 实现 Repository 查询接口**

必须实现 `upsertEntry`、`findCoveringSegment`、`recordSegment`、`touchHit`、`getStats`、`listEvictionCandidates`、`deleteEntry`、`clearAll` 和 `close`。`recordSegment` 使用事务同步刷新 entry 的 `cached_bytes/status/total_bytes`。

- [ ] **Step 3: 实现受管目录规则**

配置目录写入 `<selected>/.pisamusic-cache/v1`；默认目录写入 `<userData>/data/media-cache/.pisamusic-cache/v1`。所有分片路径固定为 `segments/<key前2位>/<cacheKey>/<start>-<end>.bin`，临时文件追加 `.part-<uuid>`。

- [ ] **Step 4: 增加 Repository 最小测试**

使用 `:memory:` 验证覆盖分片查询、统计、LRU 顺序和删除条目返回受管文件路径。

- [ ] **Step 5: 运行测试**

Run: `pnpm --dir yixi test:media-cache`

Expected: Repository 与纯逻辑测试全部 PASS。

---

### Task 3: MediaCache 深模块与自定义流媒体协议

**Files:**
- Create: `yixi/electron/mediaCache/mediaCacheManager.ts`
- Create: `yixi/electron/mediaCache/index.ts`
- Modify: `yixi/electron/main.ts`
- Modify: `yixi/electron/ipc/musicIpc.ts`

**Interfaces:**
- Consumes: `resolvePlayableUrl(track)` 作为仅 main 可见的源站 URL resolver
- Produces: `registerMediaCacheScheme()`
- Produces: `setupMediaCacheProtocol()`
- Produces: `prepareMediaPlaybackUrl(track): Promise<string>`
- Produces: `getMediaCacheStatus()`、`refreshMediaCachePolicy()`、`clearMediaCache()`、`closeMediaCache()`

- [ ] **Step 1: ready 前注册 scheme**

```ts
protocol.registerSchemesAsPrivileged([{
  scheme: "pisacache",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    corsEnabled: true,
  },
}]);
```

- [ ] **Step 2: 实现播放准备接口**

本地歌曲直接沿用 `file://`。缓存禁用时返回源站 URL。缓存启用时只注册内存 descriptor 并返回 `pisacache://media/<cacheKey>`；不提前请求源站，因此完整缓存可在断网时直接命中。

- [ ] **Step 3: 实现协议读取命中**

协议只接受 host=`media` 和 64 位 cacheKey。命中覆盖分片时返回本地文件流；Range 请求返回 `206`、`Content-Range`、`Accept-Ranges: bytes` 和精确 `Content-Length`，无 Range 且存在完整分片时返回 `200`。

- [ ] **Step 4: 实现协议 miss 流式代理**

缓存 miss 时懒调用现有 `resolvePlayableUrl` 获取 HTTPS 源站 URL，用 `net.fetch` 转发单段 Range。对响应 body 使用 `tee()`：一支立即返回播放器，另一支写 `.part`；写完原子改名并记录分片。401/403 时只允许重新解析源站 URL 重试一次，不把 URL 持久化。

- [ ] **Step 5: 实现单飞和失败降级**

相同 `cacheKey + Range` 的并发写入复用一个完成 Promise；落盘失败只记录 warning，播放器仍消费网络分支。缓存目录不可写时切换默认目录；默认目录仍失败时关闭本次缓存但继续远程播放。

- [ ] **Step 6: 实现 LRU**

每次分片完成后计算总大小；超过上限时跳过当前写入 key，从最旧条目开始删除，直到 `usedBytes <= limitBytes * 0.9`。删除前校验路径位于 `.pisamusic-cache/v1`。

- [ ] **Step 7: 接入 IPC 播放链路和生命周期**

`music:resolve-playable-url` 改调 `prepareMediaPlaybackUrl`；`downloadService` 继续直接调用原始 `resolvePlayableUrl`。main 在 `whenReady` 最前面 setup protocol，在 `before-quit` close 索引。

- [ ] **Step 8: 运行聚焦测试与 TypeScript 构建**

Run: `pnpm --dir yixi test:media-cache`

Run: `pnpm --dir yixi build:t`

Expected: 测试通过，Vue/TypeScript/Electron 构建无错误。

---

### Task 4: 缓存 IPC、设置页状态与清理操作

**Files:**
- Create: `yixi/electron/ipc/mediaCacheIpc.ts`
- Modify: `yixi/electron/main.ts`
- Modify: `yixi/electron/preload.ts`
- Modify: `yixi/src/types/electron.d.ts`
- Modify: `yixi/src/store/settingStore.ts`
- Modify: `yixi/src/components/setting/basic/LocalSetting.vue`

**Interfaces:**
- Produces IPC: `media-cache:status`
- Produces IPC: `media-cache:refresh-policy`
- Produces IPC: `media-cache:clear`

- [ ] **Step 1: 注册 typed IPC**

renderer 只允许读取汇总状态、通知 main 重新读取 SQLite 设置、请求清空受管缓存。任何 IPC 都不得接收真实文件路径或 cacheKey 删除参数。

- [ ] **Step 2: 设置变更后刷新策略**

`updateCacheDirectory`、`updateCacheLimitGb` 在保存 `local-setting` 后调用 `refreshMediaCachePolicy()`。失败只上报日志，不回滚用户设置，main 使用默认目录保障播放。

- [ ] **Step 3: 设置页展示真实状态**

显示 `格式化已用空间 / 上限`、缓存歌曲数、实际生效目录以及“清理缓存”按钮。页面挂载和清理后刷新状态；清理按钮使用确认交互，清理期间禁用重复点击。

- [ ] **Step 4: 验证设置语义**

确认 `0GB` 显示“已关闭”，空目录显示 main 返回的默认目录，清理只把 `usedBytes/entryCount/readyCount` 归零，不改下载记录。

- [ ] **Step 5: 运行构建**

Run: `pnpm --dir yixi build:t`

Expected: Vue、preload、main 全部类型检查和构建通过。

---

### Task 5: 文档、边界审计与交付验证

**Files:**
- Modify: `yixi/AGENTS.md`
- Modify: `AGENTS.md`
- Modify: `docs/spec-plans/desktop-media-cache/desktop-media-cache.md`

**Interfaces:**
- Documents: cacheKey、scheme、目录布局、SQLite 索引、LRU、IPC、0GB、默认目录和验证命令。

- [ ] **Step 1: 更新项目上下文**

明确播放缓存由 `electron/mediaCache/` 独占；renderer、下载模块、Chromium Cache 不得绕过该模块或复用其目录。

- [ ] **Step 2: 审计路径和调用链**

Run: `rg -n "cacheDirectory|cacheLimitGb|pisacache|media-cache:" yixi/electron yixi/src`

Expected: 配置字段存在实际 main 消费者；播放 IPC 经过 MediaCache；renderer 无真实缓存路径访问能力。

- [ ] **Step 3: 最终验证**

Run: `pnpm --dir yixi test:media-cache`

Run: `pnpm --dir yixi build:t`

Run: `git diff --check`

Expected: 全部通过；`git status --short` 中本任务变更不包含任何 `pm/` 文件。

- [ ] **Step 4: 交付用户手测清单**

手测覆盖：首次播放目录增长、第二次播放缓存命中、拖动进度、断网播放完整缓存、容量触发 LRU、0GB 禁用、目录切换、手动清理、下载歌曲不受影响。

- [ ] **Step 5: 生成 Windows 测试包**

Run: `pnpm --dir yixi build:win`

Expected: `yixi/app/PisaMusic Setup 1.0.1.exe` 生成成功；不启动、不安装应用。

---

## 自检结果

- 需求覆盖：目录实际落盘、容量限制、Range、离线命中、统计、清理和异常降级均有任务归属。
- 接口一致：renderer 只见三个缓存管理 IPC 和一个播放 URL；源站 URL、SQLite、文件路径均留在 main。
- 安全边界：自定义协议只接受 opaque key；删除只处理 `.pisamusic-cache/v1`；不会把用户所选目录当成可递归清空根目录。
- 测试边界：只测试高风险纯逻辑与 Repository，协议/播放器行为留给用户安装包手测，符合“不做复杂测试”的要求。
