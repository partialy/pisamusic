# Android 播放页背景与下一首队列修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一播放页无封面时的新图标回退，并保证“下一首播放”不会制造重复歌曲或错误高亮。

**Architecture:** 播放页继续由 Coil 加载并模糊封面，但 Android 12 以上与旧版 RenderScript 分支统一使用 `ic_pm_icon` 作为空数据和加载失败回退。插播队列仍由 `PlaylistManager` 维护 FIFO 顺序，主播放列表只保留 `type + id` 唯一项；消费插播项时移动已有媒体项到目标位置，只有确实不存在时才插入。播放队列 UI 使用同一复合身份判断当前歌曲。

**Tech Stack:** Kotlin、Android ViewBinding、Coil 2.5、AndroidX Media3 / ExoPlayer、JUnit 4

## Global Constraints

- 只修改 `pm/` Android 项目，不处理 `yixi/` 现有改动。
- 保留用户在 `SongMoreMenu.kt` 等文件中的现有修改。
- 不启动或安装 App；完成自动化测试和 Debug 构建后交给用户手测。
- 歌曲唯一身份统一为 `SongType + id`，不能只比较 `id`。

---

### Task 1: 播放页无封面背景统一回退

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`

**Interfaces:**
- Consumes: `SongCoverUrl.getSongCoverData(song, SIZE_XLARGE): Any?`、`R.drawable.ic_pm_icon`
- Produces: `applyBlurBackground(model)` 在空模型和加载失败时都显示并模糊新图标

- [x] **Step 1: 修正 Android 12 以上回退资源**

把 `placeholder/error` 从旧披萨 `ic_pisa_piece_24` 改为 `ic_pm_icon`，并为 `model == null` 使用同一资源：

```kotlin
val backgroundModel = model ?: R.drawable.ic_pm_icon
binding.blurredBgImageView.load(backgroundModel) {
    crossfade(true)
    placeholder(R.drawable.ic_pm_icon)
    error(R.drawable.ic_pm_icon)
    fallback(R.drawable.ic_pm_icon)
}
```

- [x] **Step 2: 补齐 Android 12 以下失败回退并复用模糊逻辑**

为 `ImageRequest.Builder` 设置 `error/fallback`，同时处理 `onSuccess/onError`：

```kotlin
val request = ImageRequest.Builder(this)
    .data(backgroundModel)
    .error(R.drawable.ic_pm_icon)
    .fallback(R.drawable.ic_pm_icon)
    .target(
        onSuccess = ::applyLegacyBlurBackground,
        onError = ::applyLegacyBlurBackground,
    )
    .build()
```

新增只负责 Drawable 转 Bitmap 并模糊显示的私有方法，空 Drawable 直接返回。

- [x] **Step 3: 编译检查**

Run: `./gradlew.bat compileDebugKotlin`

Expected: `BUILD SUCCESSFUL`，不存在 Coil target、Drawable 或资源引用错误。

### Task 2: 插播队列去重并保持业务列表和 ExoPlayer 顺序一致

**Files:**
- Create: `app/src/main/java/cn/partialy/pm/player/PlayNextQueueRules.kt`
- Modify: `app/src/main/java/cn/partialy/pm/player/PlaylistManager.kt`
- Modify: `app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/PlayNextQueueRulesTest.kt`

**Interfaces:**
- Consumes: 歌曲复合键 `SongType + id`、目标插入索引
- Produces: `enqueueUniqueBy(...)`、`planPlayNextPlacement(...)` 和 `PlaylistManager.placePlayNextAt(index, song): Int`

- [x] **Step 1: 写失败测试**

覆盖以下规则：同一复合键重复入队只保留一次；同 ID 不同音源允许并存；列表尾部已有占位歌曲时消费插播只移动不复制；已有项位于目标位置之前时正确修正最终索引；歌曲不存在时只插入一次；历史持久化列表中的重复歌曲恢复时去重并保持当前歌曲指针。

```kotlin
assertEquals(listOf(kgA), enqueueUniqueBy(listOf(kgA), kgA, ::songIdentityKey))
assertEquals(listOf(kgA, wyA), enqueueUniqueBy(listOf(kgA), wyA, ::songIdentityKey))
assertEquals(listOf(current, queued, normal), planPlayNextPlacement(
    songs = listOf(current, normal, queued), requestedIndex = 1,
    song = queued, keyOf = ::songIdentityKey,
).songs)
```

- [x] **Step 2: 运行聚焦测试确认失败**

Run: `./gradlew.bat testDebugUnitTest --tests cn.partialy.pm.player.PlayNextQueueRulesTest`

Expected: FAIL，提示规则函数尚不存在。

- [x] **Step 3: 实现纯队列规则**

`PlayNextQueueRules.kt` 提供：

```kotlin
internal fun songIdentityKey(song: SongInfo): String = "${song.type}_${song.id}"

internal data class PlayNextPlacement(
    val songs: List<SongInfo>,
    val previousIndex: Int?,
    val targetIndex: Int,
)
```

`planPlayNextPlacement` 从列表移走同一复合键的已有项并放到目标位置；若已有项在目标之前，目标索引减一；不存在时插入一次。
`normalizePlaylist` 按复合键清理旧版本已持久化的重复项，并把旧索引映射到同一首当前歌曲的新索引。

- [x] **Step 4: 接入 PlaylistManager 和 PlayerEngine**

`addPlayNext` 使用唯一入队规则，并保持“首次加入且主列表不存在时追加占位项”的现有可见行为。新增 `placePlayNextAt` 同步 `_playList` 与 ExoPlayer：已有项调用 `moveMediaItem(previousIndex, targetIndex)`，不存在时调用 `addMediaItem(targetIndex, placeholder)`。`PlayerEngine` 的自动切歌和手动下一曲两处都改为调用该方法并使用返回的真实目标索引；启动恢复时先规范化旧持久化列表。

- [x] **Step 5: 运行聚焦测试**

Run: `./gradlew.bat testDebugUnitTest --tests cn.partialy.pm.player.PlayNextQueueRulesTest`

Expected: PASS。

### Task 3: 播放队列当前歌曲高亮使用复合身份

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`
- Test: `app/src/test/java/cn/partialy/pm/player/PlayNextQueueRulesTest.kt`

**Interfaces:**
- Consumes: `songIdentityKey(song)`
- Produces: `PlaylistAdapter.setCurrentPlayingSong(song)`，只高亮 `type + id` 完全一致的行

- [x] **Step 1: 补充身份回归测试**

```kotlin
assertNotEquals(songIdentityKey(kgA), songIdentityKey(wyA))
```

- [x] **Step 2: 修改队列适配器和滚动定位**

把 `currentPlayingId: String?` 改为 `currentPlayingKey: String?`，构造、刷新、绑定和 `scrollPlaylistToNowPlaying` 都使用复合键，避免相同 ID 的不同音源一起高亮。

- [x] **Step 3: 运行完整单元测试和 Debug 构建**

Run: `./gradlew.bat testDebugUnitTest`

Expected: `BUILD SUCCESSFUL`，全部单元测试通过。

Run: `./gradlew.bat assembleDebug`

Expected: `BUILD SUCCESSFUL`，生成 Debug APK；不执行安装或启动。

### Task 4: 差异复核

**Files:**
- Review: 本计划涉及的所有 Android 文件

**Interfaces:**
- Consumes: `git diff`、测试和构建结果
- Produces: 只包含目标修复且不覆盖用户已有改动的交付差异

- [x] **Step 1: 检查目标文件差异与工作树**

Run: `git diff -- app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt app/src/main/java/cn/partialy/pm/player/PlaylistManager.kt app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt app/src/main/java/cn/partialy/pm/player/PlayNextQueueRules.kt app/src/test/java/cn/partialy/pm/player/PlayNextQueueRulesTest.kt`

Expected: 不包含 `yixi/`，不回退 `SongMoreMenu.kt` 或其他用户修改。

- [x] **Step 2: 人工验收项交接**

用户在真机/模拟器验证：无封面与坏封面地址都显示蓝底白音符模糊背景；搜索结果对同一首歌多次点“下一首播放”后主队列仅一条；手动下一曲后该歌曲移动到当前项且队列无重复；不同音源同 ID 时只高亮当前音源歌曲。
