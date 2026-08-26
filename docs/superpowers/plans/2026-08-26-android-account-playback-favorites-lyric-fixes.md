# Android 账号、播放队列、收藏与歌词修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Android 手机端账号头像、播放列表末尾循环、我的收藏默认排序与完整队列播放，以及歌词样式末尾提示文案。

**Architecture:** 继续以 `ConfigManager` 统一解析系统资源 URL，以 `PlayerEngine` 统一管理 Media3 播放模式和控制中心命令，以 `FavoriteSongsDbStore + LoveManager` 统一收藏持久化及内存顺序，以 `LovedSongsPlaylistActivity` 只负责把完整收藏列表和点击下标交给播放器。仅做局部修复，不改变服务端契约、播放器队列身份规则或页面架构。

**Tech Stack:** Kotlin、Android ViewBinding、Coil 2.5、AndroidX Media3 / ExoPlayer、SQLite、XML resources。

## Global Constraints

- 直接在当前 `dev` 分支修改，不新建分支。
- 只处理 `pm/` 手机端及本计划文档，不修改 `yixi/`、`server/`、`example/`。
- 收藏默认按添加时间倒序展示，即最新收藏优先；相同时间使用稳定次序兜底。
- 不运行完整测试、安装 App 或启动模拟器；只做 Kotlin 编译和差异检查，真机流程由用户验收。
- 不主动提交 Git；保留为当前工作区变更。

---

### Task 1: 兼容旧 HTTP 账号头像地址

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/network/config/ConfigManager.kt:139`

**Interfaces:**
- Consumes: 服务端账号 DTO 中的 `avatarUrl` / `avatar`，可能是 HTTPS 绝对地址、旧 HTTP 绝对地址或 `/static/...` 根相对地址。
- Produces: `ConfigManager.resolveSystemUrl(raw: String): String?` 始终返回 HTTPS 绝对地址或 `null`；根相对地址继续绑定当前服务发现 origin。

- [x] **Step 1: 规范化绝对头像地址**

  将合法 HTTPS 地址保持为 HTTPS；将旧 `http://` 地址只在内存中升级为 `https://`，不允许 Coil 发出明文头像请求；其他 scheme 继续拒绝。

  ```kotlin
  fun resolveSystemUrl(raw: String): String? {
      val value = raw.trim()
      if (value.isBlank()) return null
      val absoluteUrl = value.toHttpUrlOrNull()
      if (absoluteUrl != null) {
          return when {
              absoluteUrl.isHttps -> absoluteUrl.toString()
              absoluteUrl.scheme == "http" -> absoluteUrl.newBuilder()
                  .scheme("https")
                  .build()
                  .toString()
              else -> null
          }
      }
      if (!value.startsWith('/')) return null
      return runCatching { serviceDiscoveryManager.resolveApiUrl(value) }.getOrNull()
  }
  ```

- [x] **Step 2: 核对两个账号头像入口继续复用统一解析器**

  确认 `MineFragment.resolveAccountAvatarUrl()` 和 `AccountProfileActivity.resolveAccountAvatarUrl()` 不新增硬编码域名，仍调用 `configManager.resolveSystemUrl(raw)`；无需改服务端或 SharedPreferences。

### Task 2: 让播放模式作用于新播放器并修正控制中心命令

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt:128`
- Modify: `pm/app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt:451`
- Modify: `pm/app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt:564`

**Interfaces:**
- Consumes: `SettingsPrefs.PlayMode.Order / Shuffle / Single`。
- Produces: `Order` 与 `Shuffle` 使用 `Player.REPEAT_MODE_ALL`，`Single` 使用 `Player.REPEAT_MODE_ONE`；控制中心获得正确的 `Player.Commands`。

- [x] **Step 1: 把播放模式应用到明确的新播放器实例**

  抽出接收 `ExoPlayer` 参数的方法，避免 `buildPlayer()` 构建期间通过尚未赋值或已经释放的字段 `exoPlayer` 配置错误实例。

  ```kotlin
  private fun applyPlayModeToPlayer(player: ExoPlayer, mode: SettingsPrefs.PlayMode) {
      when (mode) {
          SettingsPrefs.PlayMode.Order -> {
              player.shuffleModeEnabled = false
              player.repeatMode = Player.REPEAT_MODE_ALL
          }
          SettingsPrefs.PlayMode.Shuffle -> {
              player.shuffleModeEnabled = true
              player.repeatMode = Player.REPEAT_MODE_ALL
          }
          SettingsPrefs.PlayMode.Single -> {
              player.shuffleModeEnabled = false
              player.repeatMode = Player.REPEAT_MODE_ONE
          }
      }
  }
  ```

  `buildPlayer()` 的新实例直接调用：

  ```kotlin
  .apply {
      applyPlayModeToPlayer(this, SettingsPrefs.getPlayMode(context))
      addListener(playerListener)
      audioEffectsManager.bindAudioSession(audioSessionId)
  }
  ```

  公开切换入口继续委托当前实例：

  ```kotlin
  fun applyPlayMode(mode: SettingsPrefs.PlayMode) {
      exoPlayer?.let { applyPlayModeToPlayer(it, mode) }
  }
  ```

- [x] **Step 2: 修正 MediaSession 连接命令集合**

  `Player.COMMAND_*` 必须加入 `availablePlayerCommands`，不能加入 `availableSessionCommands`。

  ```kotlin
  override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
  ): MediaSession.ConnectionResult {
      val result = super.onConnect(session, controller)
      val playerCommands = result.availablePlayerCommands.buildUpon()
          .add(Player.COMMAND_SEEK_TO_NEXT)
          .add(Player.COMMAND_SEEK_TO_PREVIOUS)
          .add(Player.COMMAND_PLAY_PAUSE)
          .build()
      return MediaSession.ConnectionResult.accept(
          result.availableSessionCommands,
          playerCommands,
      )
  }
  ```

- [x] **Step 3: 保留 Media3 原生末尾循环**

  不在 `STATE_ENDED` 中再次调用 `next()`；`REPEAT_MODE_ALL` 负责自然播放从末曲回到首曲，现有手动 `next()` 的末尾索引 `0` 逻辑继续处理 App 内按钮和 MediaSession 回调。

### Task 3: 收藏默认按添加时间倒序并从点击项播放完整列表

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/utils/loveUtil/FavoriteSongsDbStore.kt:18`
- Modify: `pm/app/src/main/java/cn/partialy/pm/utils/loveUtil/LoveManager.kt:57`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsPlaylistActivity.kt:198`

**Interfaces:**
- Consumes: SQLite `favorite_songs.created_at`、`LoveManager.loveListFlow`、`PlaylistDetailContentAdapter.currentSongs`。
- Produces: 收藏默认最新添加优先；点击歌曲调用 `MusicController.setPlayListLazy(allSongs, startIndex)`，队列包含所有收藏歌曲。

- [x] **Step 1: 明确 SQLite 默认排序**

  ```kotlin
  "created_at DESC, rowid DESC"
  ```

  读取时以 `created_at` 倒序，`rowid` 只用于毫秒时间相同时提供稳定次序。

- [x] **Step 2: 保持运行期新增收藏与数据库顺序一致**

  在 `LoveManager` 增加锁内辅助方法，新收藏插入内存列表头部；已有歌曲更新内容时保持原添加位置。

  ```kotlin
  private fun putNewestFirstLocked(song: SongInfo) {
      val key = song.storageKey()
      val reordered = LinkedHashMap<String, SongInfo>(songsByKey.size + 1)
      reordered[key] = song
      songsByKey.forEach { (existingKey, existingSong) ->
          if (existingKey != key) reordered[existingKey] = existingSong
      }
      songsByKey.clear()
      songsByKey.putAll(reordered)
  }
  ```

  本地新增收藏在 `db.addSong()` 成功后调用该方法；同步新增根据 `db.addSong()` 返回值决定插入表头或仅更新原位置，然后刷新 Flow。

- [x] **Step 3: 点击收藏歌曲时交付完整列表和起始下标**

  替换截断列表的 `subList(index, songs.size)`：

  ```kotlin
  private fun playFromSong(song: SongInfo) {
      val songs = contentAdapter.currentSongs
      val index = songs.indexOfFirst { it.id == song.id && it.type == song.type }
      if (index < 0) return
      musicController.setPlayListLazy(songs, startIndex = index)
  }
  ```

  `currentSongs` 仍取 Adapter 的完整 `allSongs`，因此即使页面处于搜索过滤态，播放队列也不会被过滤结果截断。

### Task 4: 删除歌词样式末尾提示文案

**Files:**
- Modify: `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml:373`
- Modify: `pm/app/src/main/res/values/strings.xml:146`

**Interfaces:**
- Consumes: `lyric_settings_hint` 末尾提示 TextView。
- Produces: 歌词样式 Sheet 在对齐方式控件后结束，不再显示“字号也可使用播放器上的 A− / A+ 快速调整。”。

- [x] **Step 1: 删除末尾提示视图**

  从 `bottom_sheet_lyric_settings.xml` 删除只承载 `@string/lyric_settings_hint` 的末尾 `TextView`，不保留空白占位。

- [x] **Step 2: 删除孤儿字符串**

  从 `strings.xml` 删除 `lyric_settings_hint`，并用全文搜索确认没有引用。

### Task 5: 轻量验证与交付

**Files:**
- Verify: `pm/` 本轮差异

**Interfaces:**
- Consumes: Tasks 1–4 的工作区变更。
- Produces: Kotlin 编译通过、无空白错误、无越界修改的可真机验收工作区。

- [x] **Step 1: 检查差异边界与资源引用**

  Run: `git diff --check`

  Expected: 无输出，退出码为 `0`。

  Run: `rg -n "lyric_settings_hint" pm/app/src/main`

  Expected: 无匹配。

- [x] **Step 2: 只运行 Debug Kotlin 编译**

  Run: `./gradlew.bat :app:compileDebugKotlin`（工作目录 `pm/`）

  Expected: `BUILD SUCCESSFUL`；允许项目既有弃用警告，不运行完整测试、安装或启动 App。

- [x] **Step 3: 复核最终工作区**

  Run: `git status --short`

  Expected: 仅本计划和 Tasks 1–4 指定文件发生变化，没有 `server/`、`yixi/`、构建产物或用户无关文件。

  用户真机验收清单：账号自定义头像在“我的”和“我的资料”显示；默认顺序模式末曲控制中心下一曲可点且回到首曲；末曲自然结束循环；收藏最新添加优先，23 首点第 20 首时队列仍有 23 首且当前下标为 19；歌词样式末尾提示消失。
