# Android 播放加载状态与收藏独立搜索实施计划

> **For Codex:** 在当前 `dev` 分支直接执行；基线提交为 `1273ddf`。按任务顺序实施，每个任务完成后做局部检查，最后只运行 Kotlin 编译与 diff 检查，不安装、不启动、不跑完整测试。

**目标：** 播放器缓冲时显示持续旋转的加载图标，歌词请求期间立即显示“正在加载歌词...”，并把“我的收藏”搜索改为右上角入口跳转独立搜索页；搜索结果点击后仍以完整收藏列表为播放队列。

**实现原则：** 继续复用 `MusicController` 已公开的 Media3 播放状态、`LyricContent.message()`、歌单详情歌曲 Adapter 和 `HomeMiniPlayerBinder`。SVG 导入后的 VectorDrawable 只负责图形，旋转动画由统一 Kotlin 渲染器管理生命周期。收藏搜索页只过滤展示数据，播放队列始终使用 `LoveManager.loveListFlow` 的完整、当前顺序列表。

**技术栈：** Kotlin、Android ViewBinding、RecyclerView、StateFlow、Media3 Player、ObjectAnimator、Hilt。

---

## 任务 1：统一播放按钮的缓冲图标与旋转动画

**文件：**

- 新建：`pm/app/src/main/java/cn/partialy/pm/ui/widget/PlaybackButtonStateRenderer.kt`
- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`
- 修改：`pm/app/src/main/java/cn/partialy/pm/ui/home/HomeMiniPlayerBinder.kt`
- 复用：`pm/app/src/main/res/drawable/ic_loading_loop_24.xml`

**步骤：**

1. 新建小型状态渲染器，公开 `render(playbackState, isPlaying)` 与 `release()`。
2. 当 `playbackState == Player.STATE_BUFFERING` 时设置 `ic_loading_loop_24`，使用 `ObjectAnimator` 按原 SVG 的 1.5 秒周期做 `0f -> 360f` 无限线性旋转。
3. 离开缓冲态或页面销毁时取消动画、归零 `rotation`，再按 `isPlaying` 恢复播放/暂停图标。
4. 主播放页和所有迷你播放器都使用 `combine(playbackState, isPlaying)` 单一收集链驱动渲染，避免两个状态收集器互相覆盖。

## 任务 2：增加歌词加载文案并消除快速切歌竞态

**文件：**

- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`
- 修改：`pm/app/src/main/res/values/strings.xml`

**步骤：**

1. 增加字符串资源 `player_lyric_loading = 正在加载歌词...`。
2. 每次收到非空新歌曲后，在任何本地兜底或网络请求之前立即提交 `LyricContent.message(...)`。
3. 使用 latest-wins 的歌词加载 Job：新歌先取消旧 Job，完成时再用现有 `songIdentityKey(type + id)` 校验当前歌曲后更新歌词。
4. 当前歌曲为空时取消歌词 Job 并清为“暂无歌词”，防止上一首歌词残留。

## 任务 3：把收藏页右上角改为独立搜索入口

**文件：**

- 修改：`pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsPlaylistActivity.kt`
- 修改：`pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderAdapter.kt`

**步骤：**

1. 把收藏详情顶栏右侧的更多图标替换为 `ic_search_24`，点击进入新的收藏搜索页。
2. 给通用详情 Header 增加 `searchEnabled` 状态；收藏页关闭旧的内嵌搜索按钮，同时隐藏吸顶播放栏中的重复搜索按钮。
3. 其他网络歌单和自建歌单保持原内嵌搜索行为，不改变公共默认值。

## 任务 4：实现收藏独立搜索页

**文件：**

- 新建：`pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsSearchActivity.kt`
- 新建：`pm/app/src/main/res/layout/activity_loved_songs_search.xml`
- 修改：`pm/app/src/main/AndroidManifest.xml`
- 修改：`pm/app/src/main/res/values/strings.xml`

**步骤：**

1. 页面顶部使用现有 `bg_search_field`、搜索/关闭图标和主题色“取消”，进入后自动聚焦并弹出键盘。
2. 查询为空时只显示顶部输入区与底部迷你播放器；输入后显示“播放全部”行和匹配歌曲列表，清空按钮随查询文字显隐。
3. 使用 `PlaylistDetailContentAdapter` 复用封面、歌源标签、收藏、下载和更多菜单；查询仍按现有规则匹配歌名或歌手。
4. 单击结果时，在完整收藏列表中按 `type + id` 定位，调用 `setPlayListLazy(allSongs, startIndex)`；“播放全部”也播放完整收藏列表。
5. 订阅 `loveListFlow`，收藏被取消后页面实时重算结果；底部继续复用 `HomeMiniPlayerBinder`。
6. 注册 Activity，并按现有全屏页面处理系统栏、底部安全区和软键盘 `adjustResize`。

## 任务 5：同步项目上下文与轻量验证

**文件：**

- 修改：`pm/AGENTS.md`
- 修改：`pm/design-html/components.md`

**步骤：**

1. 记录播放器缓冲按钮、歌词加载状态和收藏独立搜索页的职责与完整队列语义。
2. 在 `pm/` 运行 `./gradlew.bat :app:compileDebugKotlin`，只验证 Kotlin/资源/Manifest 编译。
3. 在仓库根目录运行 `git diff --check` 和 `git status --short`；不执行完整单测、不安装、不启动，真机交互由老大验证。

