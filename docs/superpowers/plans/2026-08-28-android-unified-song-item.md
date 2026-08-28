# Android 统一歌曲项与播放选中态 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机端搜索、收藏、我的音乐、歌单详情、云盘和首页推荐统一复用歌单详情歌曲项，并展示一致的当前播放选中态。

**Architecture:** 以新的 `item_song_list.xml` 作为唯一标准歌曲行，通过 `SongListItemBinder` 接收页面级显示参数、点击回调和播放状态。`SongListPlaybackStateObserver` 将 `MusicController.currentSong` 与 `isPlaying` 合并后推送给各 Adapter；封面频谱由独立自绘 View 负责，避免每个 Adapter 重复动画代码。

**Tech Stack:** Android ViewBinding、RecyclerView、Kotlin Flow、Media3 播放状态、ValueAnimator、自绘 View。

## Global Constraints

- 只处理 `pm/` 手机端和本功能计划文档，不进入 `example/`，不改 `server/`、`yixi/`。
- 当前 `dev` 分支直接开发，不创建分支。
- 本地、我的音乐页面不显示下载按钮；对应更多 Sheet 不显示下载与分享。
- 当前歌曲仅改变歌名、歌手和封面覆盖层，右侧按钮颜色不变。
- 播放时频谱跳动，暂停时频谱可见但静止。
- 不做复杂测试，只运行资源与 Kotlin 聚焦编译；不安装、不启动 App。

---

### Task 1: 建立唯一歌曲项组件

**Files:**
- Create: `pm/app/src/main/res/layout/item_song_list.xml`
- Create: `pm/app/src/main/java/cn/partialy/pm/ui/widget/PlayingSpectrumView.kt`
- Create: `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongListItemBinder.kt`
- Delete after migration: `pm/app/src/main/res/layout/item_recommend_song.xml`
- Delete after migration: `pm/app/src/main/res/layout/item_search_result.xml`
- Delete after migration: `pm/app/src/main/res/layout/item_favorite_song.xml`
- Delete after migration: `pm/app/src/main/res/layout/item_local_music.xml`

**Interfaces:**
- Produces: `SongListItemOptions(showLove, showDownload, showMore, enabled)`。
- Produces: `SongListPlaybackState(currentSong, isPlaying)`，按 `SongType + id` 判断当前歌曲。
- Produces: `SongListItemBinder.bind(song, title, artist, liked, options, playbackState, actions)`。
- Produces: `PlayingSpectrumView.setPlaybackState(selected, isPlaying)`。

- [ ] **Step 1: 创建标准布局**

  使用歌单详情现有 56dp 行高、40dp 封面、14sp/12sp 文案和 36dp 操作按钮；封面改成 FrameLayout，叠加半透明遮罩和居中的三线频谱 View，三个操作按钮都保留在布局内并由 Binder 控制显隐。

- [ ] **Step 2: 实现频谱 View**

  三条白色圆角竖线采用错位相位计算高度；`selected=false` 隐藏，`selected=true/isPlaying=false` 显示静态高度，播放时启动无限 ValueAnimator；离开窗口停止动画，重新附着时按状态恢复。

- [ ] **Step 3: 实现统一 Binder**

  Binder 统一负责封面加载、来源标签、收藏图标、按钮显隐/可用性、监听器复位、普通/primary 文案颜色及频谱状态，避免 RecyclerView 复用导致旧状态残留。

- [ ] **Step 4: 运行资源生成检查**

  Run: `pm\\gradlew.bat -p pm :app:generateDebugResources`

  Expected: `BUILD SUCCESSFUL`，生成 `ItemSongListBinding`。

### Task 2: 接入统一播放状态分发

**Files:**
- Create: `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongListPlaybackStateObserver.kt`
- Modify: 所有迁移后的歌曲列表 Adapter。

**Interfaces:**
- Produces: `SongListPlaybackStateTarget.updatePlaybackState(state)`。
- Produces: `LifecycleOwner.observeSongListPlaybackState(musicController, targetsProvider)`。
- Consumes: `MusicController.currentSong: StateFlow<SongInfo?>` 与 `MusicController.isPlaying: StateFlow<Boolean>`。

- [ ] **Step 1: 合并播放器状态**

  在生命周期 `STARTED` 阶段 combine 当前歌曲与播放布尔值，并 distinct 后发送给目标；页面销毁后协程自动取消。

- [ ] **Step 2: Adapter 精确刷新**

  每个 Adapter 保存最新 `SongListPlaybackState`，状态变化时只按 `SongType + id` 刷新旧当前项和新当前项；播放/暂停切换只刷新当前项。

### Task 3: 迁移主列表与页面按钮策略

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailContentAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/search/adapter/SearchResultsAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/home/adapters/FavoriteSongsAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/local/adapters/LocalMusicAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/local/adapters/DownloadedMusicAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/CloudMusicListAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/CloudMusicFragment.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/SearchActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/CloudMusicSearchActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/home/fragments/FavoriteSongsFragment.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/local/fragments/LocalMusicFragment.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/local/fragments/DownloadedMusicFragment.kt`
- Modify: 所有创建 `PlaylistDetailContentAdapter` 的歌单详情与歌单搜索 Activity。

**Interfaces:**
- Consumes: Task 1 的统一 Binder 与 Task 2 的状态目标接口。

- [ ] **Step 1: 迁移 Adapter 布局与绑定**

  搜索使用 `showLove=false`；收藏保持现有按钮组合；本地/已下载使用 `showLove=false, showDownload=false`；歌单详情和云盘保持收藏、下载、更多三个按钮，并保留云盘 disabled alpha 与不可下载规则。

- [ ] **Step 2: 接入页面播放状态**

  Activity 使用自身 LifecycleOwner，Fragment 使用 `viewLifecycleOwner`；云盘首页三条手工预览同步使用同一 playback state 重新绑定。

- [ ] **Step 3: 收紧本地更多菜单**

  `LocalMusicFragment` 与 `DownloadedMusicFragment` 创建 `SongMoreMenuDependencies` 时明确传入 `showDownload=false, showShare=false`，防止本地/我的歌曲从 Sheet 继续出现入口。

### Task 4: 迁移首页推荐

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/home/adapters/RecommendSongsAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/home/adapters/HomeDailySongGridAdapter.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/home/fragments/RecommendedSongsFragment.kt`
- Delete after migration: `pm/app/src/main/res/layout/item_home_daily_song.xml`
- Modify: `pm/app/src/main/res/layout/fragment_recommended_songs.xml`

**Interfaces:**
- Consumes: Task 1 Binder；横向每日歌曲继续由 Adapter 设置 90% 屏宽与 72dp 行高。

- [ ] **Step 1: 迁移普通推荐列表**

  保持推荐列表原有隐藏收藏按钮规则和点击回调，改用标准歌曲行与播放状态。

- [ ] **Step 2: 迁移横向每日歌曲**

  标准行作为内部组件，外层仍设置横向分页需要的宽高；骨架屏只调整封面/标题/歌手/按钮的 alpha 与背景，绑定真实数据时完整复位。

- [ ] **Step 3: 同步首页所有 Adapter 状态**

  当前每日列表和动态 top-card Adapter 共用一次播放器状态观察，创建较晚的 Adapter 立即收到当前状态。

### Task 5: 文档与聚焦验证

**Files:**
- Modify: `pm/components.md`
- Modify: `pm/AGENTS.md`

- [ ] **Step 1: 更新组件索引与架构说明**

  将歌曲项参考改为 `item_song_list.xml + SongListItemBinder + PlayingSpectrumView`，记录页面按钮参数与统一播放选中态规则。

- [ ] **Step 2: 检查旧布局引用已清零**

  Run: `rg -n "ItemRecommendSongBinding|ItemSearchResultBinding|ItemFavoriteSongBinding|ItemLocalMusicBinding|ItemHomeDailySongBinding|item_recommend_song|item_search_result|item_favorite_song|item_local_music|item_home_daily_song" pm/app/src/main pm/components.md`

  Expected: 无旧歌曲项布局或 Binding 引用。

- [ ] **Step 3: Kotlin 聚焦编译**

  Run: `pm\\gradlew.bat -p pm :app:compileDebugKotlin`

  Expected: `BUILD SUCCESSFUL`；不安装、不启动、不执行完整测试套件。
