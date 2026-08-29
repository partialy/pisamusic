# Android 歌单详情推拉门折叠效果实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 KG、WY、本地歌单和“我的收藏”四类详情页完全复用“我的”页的三层推拉门折叠结构：顶部 Header 渐显、底部播放工具条上移、封面信息区在两者后方做视差折叠并最终闭合。

**Architecture:** 将歌单详情根布局改为 `CoordinatorLayout + AppBarLayout + CollapsingToolbarLayout + RecyclerView`。封面、标题、描述和双按钮进入 `CollapsingToolbarLayout` 并使用 `parallax`；唯一的 52dp 播放工具条成为无滚动标记的 `AppBarLayout` 直接子项；固定 Header 继续作为 Coordinator 顶层 Overlay。移除基于 RecyclerView Anchor 坐标的手动 `translationY`，改由 AppBar 原生嵌套滚动产生与“我的”页相同的闭合运动。

**Tech Stack:** Kotlin、Android ViewBinding、CoordinatorLayout、Material Components 1.12、AppBarLayout、CollapsingToolbarLayout、RecyclerView、Coil。

## Global Constraints

- 直接在当前 `dev` 分支修改，不创建分支，不提交 Git。
- 只修改 `pm/` 与本计划文档；不进入 `example/`，不修改 `server/` 或 `yixi/`。
- 四类详情页必须共享同一布局、Header 绑定器、内容 Adapter 和交互控制器。
- 顶部 Header、封面信息区、底部播放工具条必须是三个独立区域，运动关系与 `fragment_mine.xml` 一致。
- 只保留一份 52dp 播放工具条，不恢复双 View 显隐切换，也不保留手动 Anchor 吸顶。
- 保持播放、收藏、搜索、分享、排序、分页、迷你播放器和状态栏安全区业务不变。
- 使用现有 `bg_mine_playlist_sheet` 的 10dp 顶部圆角，保证门板视觉与“我的”页一致。
- 不新增或运行单元测试；只做 Kotlin/资源编译和静态语法检查，不安装、不启动 App，全部功能与真机手感交由老大验证。

---

## 文件结构与职责

**新增：**

- `pm/app/src/main/java/cn/partialy/pm/ui/collapsing/CollapsingHeaderPolicy.kt`：统一“我的”页与歌单页的状态栏高度、折叠最小高度和 Header 渐显阈值。
- `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderController.kt`：绑定静态折叠 Header，替代仅为 RecyclerView Header 服务的 Adapter。

**修改：**

- `pm/app/src/main/res/layout/activity_playlist_detail.xml`：改为与“我的”页同构的三层折叠布局。
- `pm/app/src/main/res/layout/item_playlist_detail_header.xml`：移除工具条 Anchor，作为 CollapsingToolbar 的静态内容。
- `pm/app/src/main/res/layout/playlist_detail_sticky_play_all.xml`：复用“我的”页顶部圆角门板背景。
- `pm/app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt`：使用共享折叠策略，确保两页阈值来源一致。
- `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailInteractionController.kt`：监听 AppBar offset，统一 Header 渐显和系统栏状态，删除手动吸顶。
- 四个详情 Activity：改用静态 Header Controller 和单独的内容 RecyclerView Adapter。
- `pm/AGENTS.md`、`pm/components.md`：记录原生推拉门折叠结构和共享边界。

**兼容保留：**

- `pm/app/src/main/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicy.kt`：保留原接口供现有测试使用，内部委托共享策略。
- `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderAdapter.kt`：静态 Header 不再作为 RecyclerView Adapter。

---

### Task 1: 建立“我的”页与歌单页共享折叠策略

**Files:**

- Create: `pm/app/src/main/java/cn/partialy/pm/ui/collapsing/CollapsingHeaderPolicy.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/mine/MineFragment.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/mine/MineHeaderLayoutPolicy.kt`

**Interfaces:**

- Produces `CollapsingHeaderPolicy.resolveLayout(baseHeaderHeightPx, statusBarTopPx): CollapsingHeaderLayoutMetrics`。
- Produces `CollapsingHeaderPolicy.resolveChrome(verticalOffset, triggerPx): CollapsingHeaderChromeState`。
- `CollapsingHeaderChromeState` 固定提供 `progress`、`useSurfaceIcons`、`showTitle`。

- [x] **Step 1:** 实现共享策略，渐显公式保持“我的”页当前行为：`(-verticalOffset / triggerPx).coerceIn(0f, 1f)`，图标阈值 `0.5f`，标题阈值 `0.9f`。
- [x] **Step 2:** 将 `MineFragment` 切换到共享策略，视觉行为不得变化。
- [x] **Step 3:** 将旧 Mine 专用策略保留为兼容包装；保留现有测试文件不动，不新增或运行测试。

### Task 2: 把歌单详情改成与“我的”页同构的三层布局

**Files:**

- Modify: `pm/app/src/main/res/layout/activity_playlist_detail.xml`
- Modify: `pm/app/src/main/res/layout/item_playlist_detail_header.xml`
- Modify: `pm/app/src/main/res/layout/playlist_detail_sticky_play_all.xml`

**Interfaces:**

- Produces binding IDs `playlistAppBar`、`playlistCollapsingHeader`、`playlistHeader`、`recyclerView`、`headerBar`、`stickyPlayAllBar`。
- `playlistCollapsingHeader` 使用 `scroll|exitUntilCollapsed`；`playlistHeader` 使用 `layout_collapseMode="parallax"`。
- `stickyPlayAllBar` 是 AppBar 的无滚动标记直接子项，完整保留 52dp 高度。

- [x] **Step 1:** 将根布局换成 `CoordinatorLayout`，建立 AppBar、Collapsing Header、固定工具条、带 `appbar_scrolling_view_behavior` 的 RecyclerView、顶层 Header Overlay 和底部迷你播放器。
- [x] **Step 2:** 从 Header XML 删除 `playAllAnchor`，搜索区直接约束到双按钮下方；Header 静态放进 CollapsingToolbar。
- [x] **Step 3:** 工具条背景改为 `@drawable/bg_mine_playlist_sheet`，得到与“我的/歌单”Tab 区完全一致的 10dp 顶部圆角门板。
- [x] **Step 4:** 校对绘制顺序：封面在后、Header Overlay 和底部工具条在前，闭合时不露缝。

### Task 3: 将 RecyclerView Header Adapter 改为静态 Header Controller

**Files:**

- Create: `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderController.kt`
- Delete: `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailHeaderAdapter.kt`

**Interfaces:**

- Controller 构造函数接收 `ItemPlaylistDetailHeaderBinding`。
- 保留原接口：`state`、`updateHeader(...)`、`updateCollectionState(...)`、`setSearchState(...)`、`rememberSearchQuery(...)`、`setSearchEnabled(...)`、`setActions(...)`、`onStateChanged`。
- 每次状态变化直接 `render()`，不再调用 RecyclerView `notifyItemChanged(0)`。

- [x] **Step 1:** 迁移 Header state、artwork 和 actions 类型到新 Controller 文件。
- [x] **Step 2:** 将原 ViewHolder 的标题、描述、按钮、搜索框、Coil 封面绑定迁入 `render()`。
- [x] **Step 3:** 保持搜索 TextWatcher 只注册一份，并增加 `dispose()` 清理监听。
- [x] **Step 4:** 删除旧 Header Adapter，确认不存在 RecyclerView Header 占位或重复 Header。

### Task 4: 用 AppBar offset 替代手动工具条吸顶

**Files:**

- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/playlistdetail/PlaylistDetailInteractionController.kt`

**Interfaces:**

- 构造参数改为 `headerController: PlaylistDetailHeaderController`。
- 使用 `AppBarLayout.OnOffsetChangedListener` 调用共享 `CollapsingHeaderPolicy.resolveChrome()`。
- `dispose()` 必须移除 AppBar listener、Header 回调、Insets listener 和点击监听。

- [x] **Step 1:** 删除 RecyclerView scroll/layout/child attach listener、`topInRoot()`、Anchor 查询和 `translationY`。
- [x] **Step 2:** 注册 AppBar offset listener，以与“我的”页相同的 200dp trigger 驱动 Header 背景、标题、按钮颜色和状态栏图标。
- [x] **Step 3:** 在 Header inset 回调中同时设置 Header Overlay 总高度、内容顶部 padding 和 CollapsingToolbar 最小高度，使闭合位置严格等于 Header 底边。
- [x] **Step 4:** 双击 Header 回顶时同时展开 AppBar，并将内容 RecyclerView 滚到第 0 项。
- [x] **Step 5:** 保持播放、搜索、收藏、排序等现有回调不变。

### Task 5: 四类详情 Activity 统一接入静态 Header

**Files:**

- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/PlaylistDetailActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/WyPlaylistDetailActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/LocalPlaylistDetailActivity.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/LovedSongsPlaylistActivity.kt`

**Interfaces:**

- 四页都构造 `PlaylistDetailHeaderController(binding.playlistHeader)`。
- `recyclerView.adapter` 只设置 `PlaylistDetailContentAdapter`，删除 `ConcatAdapter`。
- 业务代码继续通过统一 Header Controller 更新标题、封面、数量和收藏状态。

- [x] **Step 1:** 逐页替换 `headerAdapter` 为 `headerController`，移除 `ConcatAdapter` 和重复顶部 inset 代码。
- [x] **Step 2:** KG/WY 保留分页、收藏与分享；本地歌单保留删除；“我的收藏”保留本地 Flow 与独立搜索。
- [x] **Step 3:** 四页销毁时先释放 Interaction Controller，再释放 Header Controller，避免 TextWatcher 持有 Activity。
- [x] **Step 4:** 用 `rg` 确认四页都引用同一 Activity layout、Header Controller 和 Interaction Controller。

### Task 6: 文档同步与轻量验证

**Files:**

- Modify: `pm/AGENTS.md`
- Modify: `pm/components.md`

- [x] **Step 1:** 将“Anchor 手动吸顶”说明改为 AppBar 三层推拉门结构，明确四类详情页共享。
- [x] **Step 2:** 运行 `./gradlew.bat :app:compileDebugKotlin`，只验证 Kotlin/ViewBinding/资源能够编译。
- [x] **Step 3:** 运行 `git diff --check`、`git status --short` 和目标引用搜索，确认没有残留 `playAllAnchor`、旧 Header Adapter 或手动吸顶监听。
- [x] **Step 4:** 交由老大完成全部功能与真机验证；本轮不运行单元测试、不安装、不启动 App。

## 真机验收标准

1. 初始状态下，封面信息区完整显示，顶部 Header 背景透明，52dp 播放工具条位于封面信息区下方并带 10dp 顶部圆角。
2. 上滑时封面信息区以与“我的”页头像背景相同的 parallax 速度移动，视觉上近似停在两扇门后。
3. 顶部 Header 背景按与“我的”页相同的 200dp 进度逐渐显现，形成从上向下盖住封面的视觉。
4. 播放工具条与内容区同步向上，最终停在 Header 下方；闭合点不得跳动、重叠或露缝。
5. 下拉时两扇门按相反方向连续打开，不出现两份工具条或显隐闪烁。
6. KG、WY、本地歌单、“我的收藏”四页动画完全一致，差异只来自业务数据和按钮状态。
