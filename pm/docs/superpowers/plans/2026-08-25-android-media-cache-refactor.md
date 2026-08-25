# Android 播放缓存重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Android 在线播放缓存重构为与 PC 端语义一致的深模块，解决部分缓存被误判为完整歌曲、旧播放 URL 在缓存缺口处失效导致后半段无声，以及播放中清缓存破坏活跃 `SimpleCache` 的问题。

**Architecture:** 保留 Media3 `SimpleCache + CacheDataSource` 负责 Range、Span 锁和物理 LRU，不复制 Electron 的 Node 分片实现。播放器只持有 `pmcache://media/<cacheKey>` 逻辑地址；`RefreshingOriginDataSource` 仅在 cache miss/hole 时解析真实 URL，并只对 401/403 强制刷新一次。SQLite 只保存歌曲描述和 `partial/ready` 目录信息，真实 URL 永不落盘，完整性以 Media3 的 content length 与从字节 0 开始的连续覆盖为准。

**Tech Stack:** Kotlin 1.9.24、Android Media3 / ExoPlayer、`SimpleCache`、`CacheDataSource`、Hilt、SQLiteOpenHelper、JUnit 4。

## Global Constraints

- 只修改 `pm/`，`yixi/` 仅作为只读设计参考；禁止修改 `server/` 和 `example/`。
- 保留 `app/build.gradle.kts` 中用户未提交的版本号改动，不暂存、不覆盖。
- 不实现 Electron `protocol.handle`、Node stream、手写分片文件或第二套缓存 LRU。
- 缓存身份固定为规范化的 `source + songId + qualityKey`，不得包含临时播放 URL。
- 只有 `READY` 条目允许进入“自动切换到已缓存歌曲”；未知总长度或存在缺口一律为 `PARTIAL`。
- 每个任务单独使用中文 Git 提交；只做聚焦单测、Debug 编译和最终 Debug 构建，真机行为由用户验证。

---

## File Structure

新增目录 `app/src/main/java/cn/partialy/pm/player/cache/`：

- `PlaybackMediaCache.kt`：播放器、缓存管理页、自动回退共同依赖的唯一 facade。
- `PlaybackCacheModels.kt`：`PlaybackCacheIdentity`、`PlaybackCacheStatus`、`PlaybackCacheEntry`、`PlaybackCacheSnapshot`。
- `CacheIdentity.kt`：规范化 identity、SHA-256 cache key、逻辑 URI 构造与解析。
- `CacheCoverage.kt`：根据 total bytes 和连续缓存长度判定 `PARTIAL/READY` 的纯函数。
- `PlaybackCacheCatalog.kt`：歌曲描述和缓存状态的 SQLite 目录；不保存真实 URL。
- `OriginUrlRegistry.kt`：进程内 URL TTL、同 identity 单飞、invalidate。
- `RefreshingOriginDataSource.kt`：逻辑 URI 到 HTTP upstream 的适配；保留 `DataSpec.position/length/key`，401/403 刷新一次。
- `Media3CacheStore.kt`：唯一 `SimpleCache` 生命周期、精确统计、资源级 clear/release。
- `Media3PlaybackMediaCache.kt`：组合 catalog、origin registry、cache store，构造逻辑 `MediaItem` 和 `MediaSource.Factory`。

迁移后删除：

- `app/src/main/java/cn/partialy/pm/player/PlayerCacheProvider.kt`
- `app/src/main/java/cn/partialy/pm/utils/localdata/CachedPlaybackStore.kt`

---

### Task 1: 冻结缓存身份与完整性契约

**Files:**
- Create: `app/src/main/java/cn/partialy/pm/player/cache/PlaybackCacheModels.kt`
- Create: `app/src/main/java/cn/partialy/pm/player/cache/CacheIdentity.kt`
- Create: `app/src/main/java/cn/partialy/pm/player/cache/CacheCoverage.kt`
- Create: `app/src/main/java/cn/partialy/pm/player/cache/PlaybackMediaCache.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/cache/CacheIdentityTest.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/cache/CacheCoverageTest.kt`

**Interfaces:**
- Produces: `PlaybackCacheIdentity(source, songId, qualityKey)`, `PlaybackCacheStatus.PARTIAL/READY`, `CacheIdentity.create(...)`, `CacheCoverage.evaluate(totalBytes, contiguousBytes)`, `PlaybackMediaCache` facade。

- [x] **Step 1: Write failing identity and coverage tests**

```kotlin
@Test fun `same song and quality ignores case and temporary url`() {
    val first = CacheIdentity.create("WY", " 123 ", "AUTO")
    val second = CacheIdentity.create("wy", "123", "auto")
    assertEquals(first.cacheKey, second.cacheKey)
    assertEquals("pmcache://media/${first.cacheKey}", first.logicalUri.toString())
}

@Test fun `different quality never shares cache key`() {
    assertNotEquals(
        CacheIdentity.create("wy", "123", "wy-level:standard").cacheKey,
        CacheIdentity.create("wy", "123", "wy-level:lossless").cacheKey,
    )
}

@Test fun `only known fully continuous coverage is ready`() {
    assertEquals(PlaybackCacheStatus.PARTIAL, CacheCoverage.evaluate(0, 1024))
    assertEquals(PlaybackCacheStatus.PARTIAL, CacheCoverage.evaluate(4096, 2048))
    assertEquals(PlaybackCacheStatus.READY, CacheCoverage.evaluate(4096, 4096))
}
```

- [x] **Step 2: Run tests and confirm missing types fail**

Run: `./gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.player.cache.CacheIdentityTest" --tests "cn.partialy.pm.player.cache.CacheCoverageTest"`

Expected: FAIL because the cache module types do not exist.

- [x] **Step 3: Implement the contracts**

`PlaybackMediaCache` must expose exactly this boundary:

```kotlin
interface PlaybackMediaCache {
    fun mediaItem(song: SongInfo, qualityKey: String): MediaItem
    fun placeholderMediaItem(song: SongInfo): MediaItem
    fun mediaSourceFactory(): MediaSource.Factory
    fun cacheKeyOf(song: SongInfo, qualityKey: String): String
    fun register(song: SongInfo, qualityKey: String): PlaybackCacheIdentity
    fun syncEntry(song: SongInfo, qualityKey: String): PlaybackCacheEntry
    fun readySongs(qualityKeyOf: (SongInfo) -> String, limit: Int = 200): List<SongInfo>
    fun snapshot(): PlaybackCacheSnapshot
    fun clear(): PlaybackCacheSnapshot
    fun release()
}
```

`CacheIdentity.create()` must trim/lowercase values, reject blank source/song id, default blank quality to `default`, hash the canonical triple with SHA-256, and expose `pmcache://media/<64 lowercase hex>`.

- [x] **Step 4: Run focused tests**

Run: `./gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.player.cache.*"`

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/player/cache app/src/test/java/cn/partialy/pm/player/cache
git commit -m "重构：定义播放缓存核心契约"
```

---

### Task 2: 建立不保存 URL 的缓存目录索引

**Files:**
- Create: `app/src/main/java/cn/partialy/pm/player/cache/PlaybackCacheCatalog.kt`
- Modify: `app/src/main/java/cn/partialy/pm/utils/localdata/LocalMusicDbOpenHelper.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/cache/PlaybackCacheCatalogRulesTest.kt`

**Interfaces:**
- Consumes: `PlaybackCacheIdentity`, `PlaybackCacheEntry`, `PlaybackCacheStatus`。
- Produces: `register(song, identity)`, `updateSnapshot(cacheKey, totalBytes, cachedBytes, status)`, `listCandidates(limit)`, `clear()`。

- [x] **Step 1: Add pure catalog mapping tests**

```kotlin
@Test fun `catalog write values never contain origin url`() {
    val values = PlaybackCacheCatalogValues.from(song, identity)
    assertFalse("play_url" in values)
    assertEquals("partial", values["status"])
}

@Test fun `only ready rows map to fallback candidates`() {
    assertFalse(PlaybackCacheCatalogRules.isReady("partial", 1000, 1000))
    assertTrue(PlaybackCacheCatalogRules.isReady("ready", 1000, 1000))
}
```

- [x] **Step 2: Migrate the database to version 10**

Keep the legacy `play_url` column for in-place compatibility, but stop reading and writing it. Add idempotent columns:

```sql
ALTER TABLE cached_playback_records ADD COLUMN total_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cached_playback_records ADD COLUMN status TEXT NOT NULL DEFAULT 'partial';
ALTER TABLE cached_playback_records ADD COLUMN last_accessed_at INTEGER NOT NULL DEFAULT 0;
```

Use the helper's existing `addColumnIfMissing()` pattern and set `DB_VERSION = 10`.

- [x] **Step 3: Implement `PlaybackCacheCatalog`**

`PlaybackCacheCatalogValues.from()` returns a plain `Map<String, Any?>` so mapping rules stay JVM-testable; `PlaybackCacheCatalog` converts that map to Android `ContentValues` internally. Register song metadata before playback so process death cannot lose the candidate. Snapshot updates must store `cached_bytes`, `total_bytes`, `status`, and timestamps in one database update. `listCandidates()` returns metadata only; live completeness is revalidated by `Media3CacheStore` later.

- [x] **Step 4: Run tests and compile**

Run: `./gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.player.cache.PlaybackCacheCatalogRulesTest"`

Run: `./gradlew.bat compileDebugKotlin`

Expected: both PASS.

- [x] **Step 5: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/player/cache/PlaybackCacheCatalog.kt app/src/main/java/cn/partialy/pm/utils/localdata/LocalMusicDbOpenHelper.kt app/src/test/java/cn/partialy/pm/player/cache/PlaybackCacheCatalogRulesTest.kt
git commit -m "重构：建立播放缓存目录索引"
```

---

### Task 3: 用逻辑媒体地址实现按缺口回源

**Files:**
- Create: `app/src/main/java/cn/partialy/pm/player/cache/OriginUrlRegistry.kt`
- Create: `app/src/main/java/cn/partialy/pm/player/cache/RefreshingOriginDataSource.kt`
- Create: `app/src/main/java/cn/partialy/pm/player/cache/Media3CacheStore.kt`
- Create: `app/src/main/java/cn/partialy/pm/player/cache/Media3PlaybackMediaCache.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/cache/OriginUrlRegistryTest.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/cache/LogicalMediaUriTest.kt`

**Interfaces:**
- Consumes: `PlayUrlGetter`, `SettingsPrefs.getAudioCacheMaxBytes()`, Task 1/2 contracts。
- Produces: Hilt `@Singleton Media3PlaybackMediaCache : PlaybackMediaCache` and a `MediaSource.Factory` used by `PlayerEngine`。

- [x] **Step 1: Test TTL, invalidation and logical URI parsing**

Use an injected clock and fake suspend resolver. Verify two fresh reads resolve once, `invalidate(cacheKey)` forces the next resolve, expiration forces one resolve, and `pmcache://media/<key>` round-trips while other schemes are rejected.

- [x] **Step 2: Implement `OriginUrlRegistry`**

Use a five-minute TTL and a per-cache-key `Mutex` so concurrent holes share one resolution. Store only `url + resolvedAt` in memory. The descriptor contains `SongInfo` and quality selection; neither URL nor descriptor URL is written to SQLite.

- [x] **Step 3: Implement `RefreshingOriginDataSource`**

On `open(dataSpec)`:

1. Parse the logical cache key and find its registered descriptor.
2. Resolve the current HTTP URL through `OriginUrlRegistry` on the Media3 loader thread.
3. Copy the original `DataSpec` with the HTTP URI while preserving `position`, `length`, `key`, flags and headers.
4. Open a fresh `DefaultHttpDataSource` delegate.
5. Catch `HttpDataSource.InvalidResponseCodeException`; only for 401/403 invalidate and retry once with a new delegate. Other failures propagate unchanged.
6. `read()` and `close()` delegate directly and always release the active delegate.

- [x] **Step 4: Implement `Media3CacheStore` and facade**

Create `SimpleCache` once for the module lifetime. `snapshot(cacheKey)` must use Media3 content metadata total length and `getCachedLength(cacheKey, 0, totalBytes)`; it must never infer ready from summed bytes. `clear()` enumerates `cache.keys` and calls `removeResource(key)` instead of deleting directories or releasing a cache still used by ExoPlayer. `mediaSourceFactory()` wraps `RefreshingOriginDataSource.Factory` with `CacheDataSource.Factory`.

`mediaItem()` registers the descriptor/catalog row and returns a logical URI with `setCustomCacheKey(cacheKey)` without calling `PlayUrlGetter`. Complete cache playback therefore never opens the upstream resolver.

- [x] **Step 5: Run focused tests and compile**

Run: `./gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.player.cache.*"`

Run: `./gradlew.bat compileDebugKotlin`

Expected: PASS.

- [x] **Step 6: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/player/cache app/src/test/java/cn/partialy/pm/player/cache
git commit -m "重构：实现按缺口刷新的媒体缓存"
```

---

### Task 4: 迁移播放器与完整缓存回退

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/player/MusicController.kt`
- Modify: `app/src/main/java/cn/partialy/pm/player/MediaItemFactory.kt`
- Modify: `app/src/main/java/cn/partialy/pm/player/PlaylistManager.kt`
- Modify: `app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt`
- Modify: `app/src/main/java/cn/partialy/pm/player/PlaybackFallbackProvider.kt`
- Delete: `app/src/main/java/cn/partialy/pm/player/PlayerCacheProvider.kt`
- Delete: `app/src/main/java/cn/partialy/pm/utils/localdata/CachedPlaybackStore.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/cache/ReadyPlaybackFallbackRulesTest.kt`

**Interfaces:**
- Consumes: `PlaybackMediaCache` facade only; callers must not see `SimpleCache`, URL registry or SQLite details。
- Produces: all online queue items use logical URI; cached fallback contains only live-verified `READY` songs。

- [x] **Step 1: Write fallback rules tests**

Cover: partial row rejected; stale ready row whose live snapshot became partial rejected; unknown total rejected; ready row with matching current quality accepted; different requested quality rejected.

- [x] **Step 2: Inject the cache facade**

Inject `PlaybackMediaCache` into `MusicController` and `PlaybackFallbackProvider`. `MediaItemFactory` keeps metadata/placeholder construction but delegates online logical items and cache keys to the facade. Local files continue to use their original `content://` or file URI and bypass the cache.

- [x] **Step 3: Replace PlayerEngine cache calls**

Use `playbackMediaCache.mediaSourceFactory()` in `buildPlayer()`. Remove the persisted old URL injection path, `recordCachedPlaybackAt()` byte-only logic, `playbackRefreshRetryKeys`, and the player-level catch-all URL refresh. On transition, ready/buffering/ended, call `syncEntry()` asynchronously so the catalog reflects current spans; failure to update the catalog must not stop playback.

- [x] **Step 4: Make cached fallback cache-only by behavior**

`PlaybackFallbackProvider` calls `readySongs()`; every candidate is revalidated against current `SimpleCache`. Since its logical URI is fully covered, `CacheDataSource` reads locally and never asks `OriginUrlRegistry` for a URL. If eviction occurs between validation and playback, the upstream path resolves a fresh URL instead of using a stored stale URL.

- [x] **Step 5: Delete legacy providers and run tests**

Run: `./gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.player.cache.*" --tests "cn.partialy.pm.player.PlayNextQueueRulesTest"`

Run: `./gradlew.bat compileDebugKotlin`

Expected: PASS and `rg "PlayerCacheProvider|CachedPlaybackStore|play_url" app/src/main/java/cn/partialy/pm/player app/src/main/java/cn/partialy/pm/utils/localdata` has no runtime use except the compatible schema column.

- [x] **Step 6: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/player app/src/main/java/cn/partialy/pm/utils/localdata app/src/test/java/cn/partialy/pm/player/cache
git commit -m "修复：避免部分缓存导致播放中断"
```

---

### Task 5: 收口缓存管理、文档与最小验证

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/activity/CacheManagementActivity.kt`
- Modify: `app/src/main/java/cn/partialy/pm/utils/AppStorageInspector.kt`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-08-25-android-media-cache-refactor.md`

**Interfaces:**
- Consumes: `PlaybackMediaCache.snapshot()` and `clear()`。
- Produces: 精确歌曲缓存统计与安全清理；最终文档与代码一致。

- [x] **Step 1: Move song cache management behind the facade**

Inject `PlaybackMediaCache` into `CacheManagementActivity`. Song cache size reads `snapshot().usedBytes`; clear action calls `clear()` on `Dispatchers.IO`. Remove `AppStorageInspector.clearSongCache()` and stop classifying all non-lyric internal/external cache as song cache. Lyric and downloaded-file logic remain unchanged.

- [x] **Step 2: Document the new module boundary**

Update `pm/AGENTS.md` player rules with these invariants: logical URI, source+id+quality identity, URL memory-only TTL, complete coverage requirement, cache clear through facade, Media3 ownership of Range/Span/LRU. Remove the old direct `PlayerCacheProvider`/`CachedPlaybackStore` description.

- [x] **Step 3: Run final lightweight verification**

Run: `./gradlew.bat testDebugUnitTest --tests "cn.partialy.pm.player.cache.*"`

Run: `./gradlew.bat assembleDebug`

Run: `git diff --check`

Expected: all commands PASS. Do not install or launch the App.

- [x] **Step 4: Record manual acceptance matrix in this plan**

Append the following unchecked user tests to the document:

- First online play continues beyond the previously cached prefix.
- Replay after more than five minutes fills the old cache hole with a fresh URL.
- Complete cached song plays after disconnecting network.
- Partial cached song is absent from automatic cached fallback.
- Repeated seek does not corrupt playback or mix qualities.
- Clearing song cache during pause/play does not delete lyrics, WebView cache or downloads.

- [x] **Step 5: Commit**

```powershell
git add app/src/main/java/cn/partialy/pm/activity/CacheManagementActivity.kt app/src/main/java/cn/partialy/pm/utils/AppStorageInspector.kt AGENTS.md docs/superpowers/plans/2026-08-25-android-media-cache-refactor.md
git commit -m "完善：收口播放缓存管理与说明"
```

---

## Manual Acceptance (由用户真机验证)

- [ ] 首次在线播放越过此前缓存前缀后仍持续有声。
- [ ] URL 过期后重播，可沿同一 cache key 从缺口继续回源。
- [ ] 完整缓存歌曲断网后可播放。
- [ ] 部分缓存歌曲不进入“自动切换到已缓存歌曲”。
- [ ] 多次拖动进度不会串用不同音质缓存。
- [ ] 清除歌曲缓存不会删除歌词、WebView 缓存或下载歌曲。
