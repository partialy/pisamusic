# Android 歌单详情沉浸式封面与吸顶工具条实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`（推荐）或 `executing-plans` 按任务逐项实施。所有步骤使用复选框跟踪；本计划只定义实施方式，本轮不执行功能代码。

**Goal:** 将手机端四类歌单详情统一调整为参考图所示的沉浸式大封面 Header、右上角“搜索 / 分享 / 更多”、Header 内“播放全部 / 收藏”双按钮，以及更紧凑且真实吸顶的歌曲工具条。

**Architecture:** 继续复用 `activity_playlist_detail.xml + RecyclerView ConcatAdapter + PlaylistDetailHeaderAdapter + PlaylistDetailInteractionController`，不创建第二套详情页。Header Adapter 只负责封面、标题、描述和双按钮状态；Interaction Controller 统一负责搜索入口、播放动作、工具条跟随/吸顶及顶栏渐变；四个 Activity 只提供各自的分享、收藏、更多菜单和数据加载逻辑。

**Tech Stack:** Kotlin、Android ViewBinding、RecyclerView / ConcatAdapter、ConstraintLayout、Material 3 Button、Coil、现有 `ShareBottomSheet`、`PlaylistActionBottomSheet`、`PlaylistCollectionManager`。

## Global Constraints

- 直接在当前 `dev` 分支实施，不创建新分支或 worktree。
- 只修改 `pm/` 手机端及本计划列出的项目说明；不读取或修改 `example/`，不动 `server/`、`yixi/`。
- 当前基线为 `5a93770 功能（pm）：分享详情优化、歌单详情工具条吸顶`；必须保留现有单 View 真吸顶机制，不恢复 Header/Activity 两套工具条。
- 当前工作区已有未跟踪的 `ic_sort_24.xml`、`ic_list_check_24.xml`，它们属于老大提供的资源；实施时只做 Android VectorDrawable 兼容性修正并纳入本功能，不替换成另一套图标。
- 参考图只用于布局、间距、层级和滚动态；不加入分享人、作者关注、播放量、VIP、音质、热播、升级提示等未点名信息。
- 顶栏右侧顺序固定为“搜索、分享、更多”；搜索继续使用现有歌单内搜索能力，分享必须复用 `ShareBottomSheet.showPlaylist()`，更多必须复用 `PlaylistActionBottomSheet`。
- Header 操作区固定为两个等宽按钮：“播放全部”和“收藏 / 已收藏”。KG/WY 网络歌单可切换收藏；本地自建歌单和“我的收藏”显示禁用的“已收藏”，不产生重复收藏数据。
- 吸顶工具条只保留：左侧单独的播放图标、`n首`；右侧排序图标、批量操作图标。排序和批量操作本轮只展示禁用态，不绑定点击、Toast、弹窗或数据变更。
- 工具条高度由现有的 64dp 收紧为 52dp；最小可点击的有效操作按钮仍保持 40dp，空白区域继续消费点击，避免误触歌曲。
- 实施阶段不运行 Gradle 编译、单元测试、安装或启动 App；只允许 `git diff --check`、`rg` 和人工代码审阅。真机视觉与交互测试由老大完成。
- 本计划不授权自动提交。完成实现后先报告差异；只有老大明确要求提交时，才按目标文件精确暂存并使用中文提交消息。

---

## 目标页面行为矩阵

| 页面 | 顶栏搜索 | 顶栏分享 | 顶栏更多 | Header 收藏按钮 |
| --- | --- | --- | --- | --- |
| KG `PlaylistDetailActivity` | 展开当前 Header 内搜索框 | 分享当前 KG 歌单快照 | 现有歌单操作 Sheet | 可收藏 / 取消收藏 |
| WY `WyPlaylistDetailActivity` | 展开当前 Header 内搜索框 | 分享当前 WY 歌单快照 | 现有歌单操作 Sheet | 可收藏 / 取消收藏 |
| 本地 `LocalPlaylistDetailActivity` | 展开当前 Header 内搜索框 | 分享当前本地歌单快照 | 现有详情/分享/删除 Sheet | 显示“已收藏”，禁用 |
| 我的收藏 `LovedSongsPlaylistActivity` | 进入现有 `LovedSongsSearchActivity` | 分享“我的收藏”歌单快照 | 详情/分享 Sheet，不提供删除 | 显示“已收藏”，禁用 |

## 文件结构与职责

**新增：**

- `pm/app/src/main/res/drawable/bg_playlist_detail_hero_top_scrim.xml`：保证大封面顶部的返回、搜索、分享、更多图标有稳定对比度。
- `pm/app/src/main/res/drawable/bg_playlist_detail_hero_bottom_fade.xml`：封面底部到 `home_page_bg` 的羽化渐变。

**纳入并修正现有未跟踪资源：**

- `pm/app/src/main/res/drawable/ic_sort_24.xml`：吸顶工具条排序图标。
- `pm/app/src/main/res/drawable/ic_list_check_24.xml`：吸顶工具条批量操作图标。

**修改：**

- `pm/app/src/main/res/layout/activity_playlist_detail.xml`：顶栏动作顺序与唯一吸顶工具条宿主。
- `pm/app/src/main/res/layout/item_playlist_detail_header.xml`：沉浸式封面、标题、描述、双按钮、工具条 Anchor 与搜索框。
- `pm/app/src/main/res/layout/playlist_detail_sticky_play_all.xml`：52dp 紧凑工具条。
- `pm/app/src/main/res/values/strings_playlist_detail.xml`：新增“已收藏”、排序、批量操作无障碍文案。
- `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderAdapter.kt`：新增收藏状态和 Header 双按钮绑定。
- `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailInteractionController.kt`：统一播放、搜索、工具条真吸顶、顶栏渐变和图标色。
- `pm/app/src/main/java/cn/partialy/pm/activity/PlaylistDetailActivity.kt`：KG 分享、收藏、更多动作接线。
- `pm/app/src/main/java/cn/partialy/pm/activity/WyPlaylistDetailActivity.kt`：WY 分享、收藏、更多动作接线。
- `pm/app/src/main/java/cn/partialy/pm/activity/LocalPlaylistDetailActivity.kt`：本地歌单分享、更多动作与禁用收藏状态。
- `pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsPlaylistActivity.kt`：独立搜索、收藏列表分享、更多动作与禁用收藏状态。
- `pm/AGENTS.md`：记录新详情 Header、顶栏动作与真吸顶约束。
- `pm/design-html/components.md`：更新歌单详情可复用 UI 索引。

---

### Task 1: 准备羽化背景、工具图标与文案

**Files:**

- Create: `pm/app/src/main/res/drawable/bg_playlist_detail_hero_top_scrim.xml`
- Create: `pm/app/src/main/res/drawable/bg_playlist_detail_hero_bottom_fade.xml`
- Modify/Add: `pm/app/src/main/res/drawable/ic_sort_24.xml`
- Modify/Add: `pm/app/src/main/res/drawable/ic_list_check_24.xml`
- Modify: `pm/app/src/main/res/values/strings_playlist_detail.xml`

**Interfaces:**

- Produces: `bg_playlist_detail_hero_top_scrim`、`bg_playlist_detail_hero_bottom_fade`、`ic_sort_24`、`ic_list_check_24` 和 Header/工具条所需字符串资源。
- Consumes: `@color/home_page_bg`、现有 ImageButton `app:tint` 机制。

- [x] **Step 1: 新增封面顶部遮罩**

  创建仅用于图标可读性的垂直渐变；上方为约 38% 黑色，下方完全透明：

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <shape xmlns:android="http://schemas.android.com/apk/res/android"
      android:shape="rectangle">
      <gradient
          android:angle="270"
          android:startColor="#61000000"
          android:endColor="#00000000" />
  </shape>
  ```

- [x] **Step 2: 新增封面底部羽化背景**

  渐变结尾必须引用主题下会变化的 `home_page_bg`，保证浅色和深色模式都自然接到标题/描述区域：

  ```xml
  <?xml version="1.0" encoding="utf-8"?>
  <shape xmlns:android="http://schemas.android.com/apk/res/android"
      android:shape="rectangle">
      <gradient
          android:angle="270"
          android:startColor="#00000000"
          android:centerColor="#66000000"
          android:endColor="@color/home_page_bg" />
  </shape>
  ```

- [x] **Step 3: 已实现**

- [x] **Step 4: 添加明确文案**

  在 `strings_playlist_detail.xml` 增加：

  ```xml
  <string name="playlist_detail_collected">已收藏</string>
  <string name="playlist_detail_sort_cd">排序，暂未开放</string>
  <string name="playlist_detail_batch_cd">批量操作，暂未开放</string>
  ```

  继续复用现有 `play_all`、`collect_playlist`、`playlist_detail_search_cd`、`song_more_share` 和 `more`，不重复定义同义文案。

- [x] **Step 5: 静态确认资源边界**

  仅执行：

  ```powershell
  rg -n 'currentColor|playlist_detail_collected|playlist_detail_sort_cd|playlist_detail_batch_cd' pm/app/src/main/res
  ```

  预期：两个图标内不再出现 `currentColor`；三个新字符串各只有一个定义。不要运行 AAPT 或 Gradle。

---

### Task 2: 重做详情顶栏、沉浸式 Header 和紧凑工具条

**Files:**

- Modify: `pm/app/src/main/res/layout/activity_playlist_detail.xml`
- Modify: `pm/app/src/main/res/layout/item_playlist_detail_header.xml`
- Modify: `pm/app/src/main/res/layout/playlist_detail_sticky_play_all.xml`

**Interfaces:**

- Produces Activity binding IDs: `searchButton`、`shareButton`、`moreButton`、`stickyPlayAllBar`。
- Produces Header binding IDs: `heroCoverImageView`、`playlistTitleTextView`、`playlistDescTextView`、`headerPlayAllButton`、`headerCollectButton`、`playAllAnchor`、现有搜索框 IDs。
- Produces sticky binding IDs: `btnPlayAllSticky`、`trackCountTextViewSticky`、`sortPlaylistButton`、`batchPlaylistButton`。
- Removes obsolete IDs: `playlistCollectButton`、`coverImageView`、`headerBlurImageView`、`stickyPlayAllActionContainer`、`stickyPlayAllLabel`、`searchPlaylistStickyButton`。

- [x] **Step 1: 调整 Activity 顶栏右侧顺序**

  删除顶栏原 `playlistCollectButton`，在 `playlistTitleHeaderTextView` 与 `moreButton` 之间依次增加 `searchButton`、`shareButton`。三个按钮均为 40dp，透明背景、8dp padding；标题左对齐并约束在返回按钮和搜索按钮之间：

  ```xml
  <TextView
      android:id="@+id/playlistTitleHeaderTextView"
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:gravity="start|center_vertical"
      android:maxLines="1"
      android:ellipsize="end"
      android:visibility="gone"
      app:layout_constraintStart_toEndOf="@id/backButton"
      app:layout_constraintEnd_toStartOf="@id/searchButton" />

  <ImageButton
      android:id="@+id/searchButton"
      android:layout_width="40dp"
      android:layout_height="40dp"
      android:background="@android:color/transparent"
      android:contentDescription="@string/playlist_detail_search_cd"
      android:padding="8dp"
      android:src="@drawable/ic_search_24"
      app:layout_constraintEnd_toStartOf="@id/shareButton" />

  <ImageButton
      android:id="@+id/shareButton"
      android:layout_width="40dp"
      android:layout_height="40dp"
      android:background="@android:color/transparent"
      android:contentDescription="@string/song_more_share"
      android:padding="8dp"
      android:src="@drawable/ic_share_24"
      app:layout_constraintEnd_toStartOf="@id/moreButton" />
  ```

  `moreButton` 保持最右。顶栏继续覆盖在 RecyclerView 上方，`headerBg` 初始透明，系统栏 inset 仍加到 `headerBarContent`。

- [x] **Step 2: 用全宽大封面替换“小封面 + 模糊背景”**

  在 Header 顶部使用 340dp 高的 `FrameLayout`：单张 `heroCoverImageView` 以 `centerCrop` 全宽展示；顶部 112dp 叠加 top scrim；底部 128dp 叠加 bottom fade。删除 96dp 小封面、重复背景图和 `RenderEffect` 模糊层。

  ```xml
  <FrameLayout
      android:id="@+id/heroArtworkContainer"
      android:layout_width="0dp"
      android:layout_height="340dp"
      app:layout_constraintTop_toTopOf="parent"
      app:layout_constraintStart_toStartOf="parent"
      app:layout_constraintEnd_toEndOf="parent">

      <ImageView
          android:id="@+id/heroCoverImageView"
          android:layout_width="match_parent"
          android:layout_height="match_parent"
          android:contentDescription="@null"
          android:scaleType="centerCrop" />

      <View
          android:layout_width="match_parent"
          android:layout_height="112dp"
          android:layout_gravity="top"
          android:background="@drawable/bg_playlist_detail_hero_top_scrim" />

      <View
          android:layout_width="match_parent"
          android:layout_height="128dp"
          android:layout_gravity="bottom"
          android:background="@drawable/bg_playlist_detail_hero_bottom_fade" />
  </FrameLayout>
  ```

- [x] **Step 3: 按参考图放置标题和描述**

  标题覆盖在封面底部羽化区内，左右 20dp、底部 18dp、最多两行、22sp 粗体；描述放在封面下方，左右 20dp、顶部 8dp、最多两行、14sp 次要文字色。描述为空时 Adapter 将它设为 `GONE`，操作按钮通过 `goneMargin` 保持 14dp 间距，不显示“歌单描述”兜底文案。

- [x] **Step 4: 添加 Header 双按钮**

  在描述下方放置左右 16dp、顶部 16dp 的横向容器；两个 `MaterialButton` 等权、52dp 高、中间 8dp 间距，复用 `Widget.Material3.Button.TonalButton`：

  ```xml
  <com.google.android.material.button.MaterialButton
      android:id="@+id/headerPlayAllButton"
      style="@style/Widget.Material3.Button.TonalButton"
      android:layout_width="0dp"
      android:layout_height="52dp"
      android:layout_weight="1"
      android:text="@string/play_all"
      app:icon="@drawable/ic_play_24" />

  <com.google.android.material.button.MaterialButton
      android:id="@+id/headerCollectButton"
      style="@style/Widget.Material3.Button.TonalButton"
      android:layout_width="0dp"
      android:layout_height="52dp"
      android:layout_weight="1"
      android:text="@string/collect_playlist"
      app:icon="@drawable/ic_love_24" />
  ```

  不添加收藏数量、分享人、VIP 或其它标签。

- [x] **Step 5: 让 Anchor 与新工具条严格等高**

  `playAllAnchor` 约束到双按钮容器底部，顶部间距 18dp，高度改成 52dp。搜索框仍约束在 Anchor 下方，因此从顶栏搜索进入时，回顶后只展开这一份输入框。

- [x] **Step 6: 把唯一工具条缩成 52dp**

  `playlist_detail_sticky_play_all.xml` 改为固定 52dp 高：左侧只有 40dp 的 `btnPlayAllSticky` 和 `trackCountTextViewSticky`；右侧依次是 40dp 的 `sortPlaylistButton` 与 `batchPlaylistButton`。删除“播放全部”文字和工具条搜索按钮。

  ```xml
  <ImageButton
      android:id="@+id/btnPlayAllSticky"
      android:layout_width="40dp"
      android:layout_height="40dp"
      android:background="?attr/selectableItemBackgroundBorderless"
      android:contentDescription="@string/play_all"
      android:padding="8dp"
      android:src="@drawable/ic_play_24"
      app:tint="@color/primary" />

  <TextView
      android:id="@+id/trackCountTextViewSticky"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:layout_marginStart="8dp"
      android:text="0首"
      android:textColor="?attr/colorOnSurface"
      android:textSize="16sp"
      android:textStyle="bold" />
  ```

  排序和批量操作按钮设置 `android:enabled="false"`、`android:alpha="0.62"`，分别使用老大提供的两个图标和新 contentDescription；不设置点击监听。

---

### Task 3: 扩展 Header 状态与双按钮绑定

**Files:**

- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderAdapter.kt`

**Interfaces:**

- Produces: `updateCollectionState(visible: Boolean, enabled: Boolean, collected: Boolean)`。
- Extends: `PlaylistDetailHeaderActions` 新增 `onPlayAll`、`onToggleCollect`。
- Preserves: `updateHeader(...)`、`setSearchState(...)`、`setSearchEnabled(...)` 和搜索查询过滤契约。

- [x] **Step 1: 给 Header State 增加收藏 UI 状态**

  ```kotlin
  data class PlaylistDetailHeaderState(
      val title: String = "",
      val description: String = "",
      val artwork: PlaylistHeaderArtwork = PlaylistHeaderArtwork.DrawableRes(R.drawable.ic_playlist_24),
      val trackCountText: String = "",
      val searchExpanded: Boolean = false,
      val searchQuery: String = "",
      val searchEnabled: Boolean = true,
      val collectionVisible: Boolean = false,
      val collectionEnabled: Boolean = false,
      val collected: Boolean = false,
  )
  ```

- [x] **Step 2: 增加唯一的收藏状态更新入口**

  ```kotlin
  fun updateCollectionState(visible: Boolean, enabled: Boolean, collected: Boolean) {
      state = state.copy(
          collectionVisible = visible,
          collectionEnabled = enabled,
          collected = collected,
      )
      notifyItemChanged(0)
      onStateChanged?.invoke(state)
  }
  ```

  Activity 不直接查找或修改 Header 内按钮，避免 ViewHolder 回收后状态丢失。

- [x] **Step 3: 扩展 Header Actions**

  ```kotlin
  internal data class PlaylistDetailHeaderActions(
      val onPlayAll: () -> Unit = {},
      val onToggleCollect: () -> Unit = {},
      val onSearchQueryChanged: (String) -> Unit = {},
      val onSearchCancelled: () -> Unit = {},
  )
  ```

- [x] **Step 4: 绑定标题、描述和双按钮**

  `bind()` 中执行以下规则：

  ```kotlin
  binding.playlistTitleTextView.text = state.title
  binding.playlistDescTextView.text = state.description
  binding.playlistDescTextView.isVisible = state.description.isNotBlank()

  binding.headerPlayAllButton.setOnClickListener { actions.onPlayAll() }
  binding.headerCollectButton.isVisible = state.collectionVisible
  binding.headerCollectButton.isEnabled = state.collectionEnabled
  binding.headerCollectButton.alpha = if (state.collectionEnabled) 1f else 0.62f
  binding.headerCollectButton.text = binding.root.context.getString(
      if (state.collected) R.string.playlist_detail_collected else R.string.collect_playlist,
  )
  binding.headerCollectButton.setIconResource(
      if (state.collected) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
  )
  binding.headerCollectButton.setOnClickListener {
      if (state.collectionEnabled) actions.onToggleCollect()
  }
  ```

- [x] **Step 5: 简化封面加载**

  删除 `RenderEffect`、`Shader`、`Build` 相关 import 和两张背景图的重复 Coil 请求。`bindArtwork()` 仍复用现有 Remote / DrawableRes / LocalPlaylist 分支，但只加载到 `heroCoverImageView`：

  ```kotlin
  binding.heroCoverImageView.load(source) {
      crossfade(true)
      placeholder(R.drawable.bg_mine_header)
      error(R.drawable.bg_mine_header)
  }
  ```

  本地封面解析继续走 `MinePlaylistCoverResolver`，不改变本地封面文件与模板规则。

---

### Task 4: 统一顶栏搜索、真吸顶与折叠态渲染

**Files:**

- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailInteractionController.kt`

**Interfaces:**

- Changes `attach(...)` to consume:

  ```kotlin
  onPlayAll: () -> Unit,
  onToggleCollect: () -> Unit,
  onSearchRequested: (() -> Unit)? = null,
  ```

- `onSearchRequested == null` 表示使用 Header 内搜索；非空时由页面自行导航到独立搜索页。
- Continues to produce: `closeSearchIfOpen(): Boolean`、`dispose()`。

- [x] **Step 1: 把 Header 两个操作接到统一回调**

  构造 `PlaylistDetailHeaderActions` 时同时传入 `onPlayAll` 和 `onToggleCollect`；这样 Header 的“播放全部”和吸顶工具条播放图标调用同一个播放闭包，收藏也只经过 Activity 的原业务方法。

- [x] **Step 2: 把搜索入口移动到顶栏**

  绑定 `binding.searchButton`：普通歌单调用现有 `openSearch()`；“我的收藏”执行 `onSearchRequested` 进入 `LovedSongsSearchActivity`。删除对已移除 `searchPlaylistStickyButton` 的所有访问。

  ```kotlin
  binding.searchButton.setOnClickListener {
      onSearchRequested?.invoke() ?: openSearch()
  }
  binding.stickyPlayAllBar.btnPlayAllSticky.setOnClickListener { onPlayAll() }
  ```

- [x] **Step 3: 保留单 View 真吸顶并改用 52dp Anchor**

  继续读取 Adapter position 0 内 `playAllAnchor` 的窗口坐标。工具条初始覆盖 Anchor，滚动时同步上移，达到 `headerBar.bottom` 后固定；Header ViewHolder 离屏时按固定状态处理：

  ```kotlin
  val stickyTop = sticky.top.toFloat()
  val headerHolder = binding.recyclerView.findViewHolderForAdapterPosition(0)
  val anchor = headerHolder?.itemView?.findViewById<View>(R.id.playAllAnchor)
  val anchorTop = anchor?.let(::topInRoot) ?: stickyTop
  sticky.translationY = anchorTop.coerceAtLeast(stickyTop) - stickyTop
  ```

  不增加第二份工具条，不以 `VISIBLE/GONE` 在两份 View 之间切换。

- [x] **Step 4: 用 Anchor 的实时位置驱动顶栏渐变**

  在工具条到达吸顶位置前 72dp 开始渐显顶栏；Anchor 离屏时进度固定为 1：

  ```kotlin
  val fadeDistance = 72f * activity.resources.displayMetrics.density
  val chromeProgress = ((stickyTop + fadeDistance - anchorTop) / fadeDistance)
      .coerceIn(0f, 1f)
  binding.headerBg.alpha = chromeProgress
  binding.playlistTitleHeaderTextView.isVisible = chromeProgress >= 0.98f
  ```

  用 `ArgbEvaluator` 在白色与 `home_tab_selected` 之间插值，并统一应用到 `backButton`、`searchButton`、`shareButton`、`moreButton`。浅色主题在 `chromeProgress >= 0.55f` 时切换为深色状态栏图标；深色主题始终使用浅色状态栏图标。

- [x] **Step 5: 移除重复滚动状态依赖**

  `PlaylistDetailInteractionController` 继续持有现有 RecyclerView scroll/layout/child attach listeners，并在同一次 `updateStickyPosition()` 中完成工具条位置和顶栏状态刷新。`dispose()` 必须移除新增的 `searchButton`/Header 回调及现有监听，防止 Activity 重建后重复响应。

- [x] **Step 6: 同步 Header State 到外层 View**

  `syncHeaderState()` 只负责：

  ```kotlin
  binding.playlistTitleHeaderTextView.text = state.title
  binding.stickyPlayAllBar.trackCountTextViewSticky.text = state.trackCountText
  binding.searchButton.isVisible = state.searchEnabled || onSearchRequested != null
  binding.stickyPlayAllBar.root.post(::updateStickyPosition)
  ```

  排序和批量按钮不在 Controller 设置监听。

---

### Task 5: 接入 KG 与 WY 网络歌单

**Files:**

- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/PlaylistDetailActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/WyPlaylistDetailActivity.kt`

**Interfaces:**

- Consumes: `ShareBottomSheet.showPlaylist(FragmentActivity, CanonicalPlaylist)`。
- Consumes: `headerAdapter.updateCollectionState(...)`。
- Consumes: 新 `PlaylistDetailInteractionController.attach(..., onToggleCollect, onSearchRequested)`。
- Preserves: KG/WY 的分页加载、完整列表播放、收藏类型兼容和更多菜单。

- [x] **Step 1: 删除旧顶栏收藏按钮代码**

  两个 Activity 中删除 `playlistCollectButton` 的点击、显示、图标、tint 和 `lastHeaderIconTint` 相关代码；收藏数据读写函数保留，但状态输出改到 Header Adapter。

- [x] **Step 2: 把网络收藏状态写入 Header**

  KG：

  ```kotlin
  private fun syncPlaylistCollectButton() {
      val supported = pagingPlaylistId.startsWith("collection_")
      headerAdapter.updateCollectionState(
          visible = true,
          enabled = supported,
          collected = supported && isKgPlaylistCollected(),
      )
  }
  ```

  WY 使用 `pagingPlaylistId.isNotBlank()` 和现有 `isWyPlaylistCollected()`。收藏/取消收藏完成后继续调用各自 `syncPlaylistCollectButton()`，不改变 KG / IMPORT_KG、WY / IMPORT_WY 的兼容查找规则。

- [x] **Step 3: 顶栏分享直接复用现有 Sheet**

  KG/WY 分别复用现有 `buildKgCollectedPlaylistForStorage()`、`buildWyCollectedPlaylistForStorage()`，转为 canonical 后打开分享：

  ```kotlin
  binding.shareButton.setOnClickListener {
      ShareBottomSheet.showPlaylist(
          this,
          buildKgCollectedPlaylistForStorage().toCanonicalPlaylist(),
      )
  }
  ```

  WY 同理。未登录、创建失败、二维码和复制链接反馈全部交给现有 `ShareBottomSheet`，Activity 不复制分享请求逻辑。

- [x] **Step 4: 保留更多菜单并接入新 Controller**

  `moreButton` 继续打开现有 `PlaylistActionBottomSheet`。`attach()` 增加 `onToggleCollect = ::togglePlaylistCollect`，不传 `onSearchRequested`，使顶栏搜索展开 Header 内现有输入框。

- [x] **Step 5: 删除四散的顶栏滚动渲染**

  两个 Activity 删除仅用于 `headerBg` alpha、标题显隐和图标 tint 的 RecyclerView scroll listener、`toolbarScrollOffsetStablePx`、`mergeToolbarScrollStable()`、`applyStatusBarIconStyle()` 和不再使用的 import。分页触底加载监听如果与视觉监听分开存在则保留，不能误删 `tryLoadMoreTracks()`。

---

### Task 6: 接入本地歌单与“我的收藏”

**Files:**

- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/LocalPlaylistDetailActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsPlaylistActivity.kt`

**Interfaces:**

- Local consumes: `CollectedPlaylist.toCanonicalPlaylist()`、`ShareBottomSheet`、`PlaylistActionBottomSheet`。
- Loved produces: `buildLovedSongsCanonical(): CanonicalPlaylist`，供顶栏分享与更多菜单复用。
- Preserves: 我的收藏独立搜索页、按添加时间排序和完整收藏列表播放语义。

- [x] **Step 1: 本地歌单显示禁用的已收藏状态**

  Header 初始绑定后调用：

  ```kotlin
  headerAdapter.updateCollectionState(
      visible = true,
      enabled = false,
      collected = true,
  )
  ```

  `attach()` 的 `onToggleCollect` 传空闭包；禁用按钮不会触发该闭包。

- [x] **Step 2: 本地歌单顶栏分享复用当前数据**

  提取只读方法，分享和更多菜单都从同一份本地记录构造 canonical：

  ```kotlin
  private fun currentLocalPlaylist() =
      playlistCollectionManager.getCollectedPlaylist(CollectedPlaylistType.LOCAL, playlistId)

  binding.shareButton.setOnClickListener {
      val playlist = currentLocalPlaylist() ?: return@setOnClickListener
      ShareBottomSheet.showPlaylist(this, playlist.toCanonicalPlaylist())
  }
  ```

  `moreButton` 继续传 `deleteTarget = playlist`，保留删除确认和退出页面行为。

- [x] **Step 3: 我的收藏保留独立搜索**

  不再把 `moreButton` 改成搜索图标。顶栏现在有独立 `searchButton`；Controller 接入：

  ```kotlin
  onSearchRequested = { LovedSongsSearchActivity.start(this) }
  ```

  继续 `headerAdapter.setSearchEnabled(false)`，保证 Header 内输入框不会出现。

- [x] **Step 4: 为“我的收藏”构造稳定分享快照**

  ```kotlin
  private fun buildLovedSongsCanonical(): CanonicalPlaylist = CanonicalPlaylist(
      id = "favorite_songs",
      source = "local",
      name = getString(R.string.my_favorites),
      desc = getString(R.string.my_favorites_playlist_intro),
      cover = "",
      song_count = contentAdapter.currentSongs.size,
  )
  ```

  顶栏分享调用 `ShareBottomSheet.showPlaylist(this, buildLovedSongsCanonical())`。顶栏更多调用 `PlaylistActionBottomSheet.show(activity = this, playlist = buildLovedSongsCanonical())`，不传 manager/deleteTarget，因此只显示详情和分享，不允许删除“我的收藏”。

- [x] **Step 5: 我的收藏显示禁用的已收藏状态**

  与本地歌单一致调用 `updateCollectionState(visible = true, enabled = false, collected = true)`；收藏列表更新时只更新 `trackCountText` 和内容列表，不重建按钮监听。

- [x] **Step 6: 删除本地/收藏页重复顶栏滚动渲染**

  删除这两个 Activity 中旧的固定 180dp 触发器、滚动偏移合并、顶栏 alpha/title/tint 逻辑和旧 `playlistCollectButton` 访问；系统栏顶部 inset、底部迷你播放器 inset、完整列表播放和生命周期释放保持不变。

---

### Task 7: 更新项目约束并做无构建静态交付检查

**Files:**

- Modify: `pm/AGENTS.md`
- Modify: `pm/design-html/components.md`
- Inspect only: 本计划全部目标文件

**Interfaces:**

- Produces: 后续开发可复用且不与代码冲突的歌单详情说明。
- Produces: 老大真机测试所需验收清单。

- [x] **Step 1: 更新 `pm/AGENTS.md`**

  将现有歌单详情规则补充为：

  - Header 使用状态栏下全宽大封面、底部羽化、标题/描述和双按钮。
  - 顶栏动作顺序固定为搜索、分享、更多；分享复用 `ShareBottomSheet`。
  - 唯一工具条为 52dp，Header `playAllAnchor` 必须同高；排序和批量操作当前仅展示。
  - 本地歌单和“我的收藏”不可重复收藏，显示禁用“已收藏”。
  - 禁止加入参考图中的分享人、VIP、热播等非产品字段。

- [x] **Step 2: 更新可复用组件索引**

  在 `pm/design-html/components.md` 的“歌单详情吸顶工具条 / 搜索栏”行补充 `bg_playlist_detail_hero_*`、Header 双按钮、顶栏三动作和 52dp 工具条结构；保留“单 View 真吸顶”的说明。

- [x] **Step 3: 检查已删除 ViewBinding ID 不再被引用**

  ```powershell
  rg -n 'playlistCollectButton|coverImageView|headerBlurImageView|stickyPlayAllActionContainer|stickyPlayAllLabel|searchPlaylistStickyButton' pm/app/src/main
  ```

  预期：无输出。若有输出，必须逐项迁移到新 ID，不能靠保留隐藏 View 规避编译问题。

- [x] **Step 4: 检查新动作和资源均有唯一接线**

  ```powershell
  rg -n 'searchButton|shareButton|headerPlayAllButton|headerCollectButton|sortPlaylistButton|batchPlaylistButton|playAllAnchor' pm/app/src/main
  rg -n 'ShareBottomSheet\.showPlaylist' pm/app/src/main/java/cn/partialy/pm/activity
  ```

  预期：四个详情 Activity 都有分享入口；搜索、Header 双按钮、唯一工具条和 Anchor 均由公共布局/Controller 管理。

- [x] **Step 5: 做纯静态差异检查**

  ```powershell
  git diff --check
  git status --short --branch
  git diff -- pm/AGENTS.md pm/design-html/components.md pm/app/src/main
  ```

  预期：无空白错误；只出现本计划文件和实施目标文件。不要运行 `gradlew`、安装或启动 App。

- [ ] **Step 6: 交给老大真机验收**

  老大按以下场景测试：

  1. 浅色/深色模式分别打开 KG、WY、本地歌单、我的收藏，确认封面从屏幕顶部覆盖状态栏区域，顶部图标清晰，底部羽化自然接到标题。
  2. 确认标题最多两行、描述最多两行；描述为空不显示假文案，也不留下大空洞。
  3. 确认顶栏右侧严格为搜索、分享、更多；分享打开现有二维码 Sheet，更多仍打开现有歌单操作 Sheet。
  4. 确认网络歌单“收藏/已收藏”可切换；本地和我的收藏显示禁用“已收藏”，不会新增重复收藏。
  5. 确认 Header“播放全部”和吸顶后的单播放图标都使用完整歌单开始播放。
  6. 缓慢上下滚动，确认 52dp 工具条连续移动并固定到顶栏下方，无跳变、闪烁、重叠或两份工具条。
  7. 吸顶后确认左侧为播放图标 + `n首`，右侧为排序 + 批量操作；后两者点击不产生动作。
  8. KG/WY/本地搜索从顶栏进入现有内嵌搜索；我的收藏进入独立搜索页，播放队列语义保持不变。
  9. 在刘海屏/挖孔屏及返回滚动过程中确认封面、顶栏和状态栏 inset 不错位，底部迷你播放器不遮挡最后一首歌曲。

## 建议提交边界（仅在老大明确要求提交时执行）

单次提交即可，避免把当前分支其它改动混入：

```powershell
git add -- docs/superpowers/plans/2026-08-26-android-playlist-detail-hero-layout.md pm/AGENTS.md pm/design-html/components.md pm/app/src/main/res/drawable/bg_playlist_detail_hero_top_scrim.xml pm/app/src/main/res/drawable/bg_playlist_detail_hero_bottom_fade.xml pm/app/src/main/res/drawable/ic_sort_24.xml pm/app/src/main/res/drawable/ic_list_check_24.xml pm/app/src/main/res/layout/activity_playlist_detail.xml pm/app/src/main/res/layout/item_playlist_detail_header.xml pm/app/src/main/res/layout/playlist_detail_sticky_play_all.xml pm/app/src/main/res/values/strings_playlist_detail.xml pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderAdapter.kt pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailInteractionController.kt pm/app/src/main/java/cn/partialy/pm/activity/PlaylistDetailActivity.kt pm/app/src/main/java/cn/partialy/pm/activity/WyPlaylistDetailActivity.kt pm/app/src/main/java/cn/partialy/pm/activity/LocalPlaylistDetailActivity.kt pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsPlaylistActivity.kt
git commit -m "美化（pm）：重做歌单详情沉浸式封面与吸顶工具条"
```
