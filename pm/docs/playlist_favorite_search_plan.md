# 歌单收藏搜索功能实现计划

## 需求背景与目标

在 Android 客户端（`pm/`）的**歌单收藏**页面（`FavoritePlaylistsActivity`）右上角增加搜索图标入口，点击后跳转至独立的歌单收藏搜索页面（`FavoritePlaylistsSearchActivity`）。

页面交互与搜索逻辑直接参考**我的收藏搜索页**（`LovedSongsSearchActivity`），包括：
- 页面进入自动弹出软键盘、聚焦搜索框；
- 支持实时输入过滤（`doAfterTextChanged`）、一键清空（`clearSearchButton`）、取消返回（`cancelButton` / 实体返回键带平滑过渡动画）；
- 搜索结果按网格（3 列卡片 `HomePlaylistGridAdapter`）展示过滤后的收藏网络歌单（KG / WY 等，排除本地自建歌单）；
- 点击歌单条目与原歌单收藏页一致，分别调起 KG 或 WY 歌单详情页；
- **明确无【播放全部】工具条**（区别于歌曲收藏搜索页）；
- 底部集成统一迷你播放器（`HomeMiniPlayerBinder`），保证播放状态与切歌体验连续。

---

## 涉及文件与模块改动

### 1. 修改现有页面入口
- **[MODIFY] [FavoritePlaylistsActivity.kt](file:///e:/Projects/Project/pisamusic/pm/app/src/main/java/cn/partialy/pm/activity/FavoritePlaylistsActivity.kt)**
  - 在 `setupHeader()` 中，将原先隐藏的 `searchButton` 显示出来：`binding.searchButton.isVisible = true`；
  - 绑定点击事件，调用 `FavoritePlaylistsSearchActivity.start(this)` 启动搜索页（带 `AppActivityTransitions.applyForward` 过渡动画）。
  - *注：布局文件 `activity_home_playlist_list.xml` 原本已包含 `searchButton` 控件，直接复用即可，无需修改该布局。*

### 2. 新增搜索页面与布局
- **[NEW] [FavoritePlaylistsSearchActivity.kt](file:///e:/Projects/Project/pisamusic/pm/app/src/main/java/cn/partialy/pm/activity/FavoritePlaylistsSearchActivity.kt)**
  - 继承 `BaseActivity`，标注 `@AndroidEntryPoint`；
  - 注入 `PlaylistCollectionManager`；
  - 监听 `playlistCollectionManager.playlistsFlow`，收集用户已收藏的非 LOCAL 歌单；
  - 实现输入框实时过滤逻辑：
    - 输入为空时：隐藏结果列表与空提示；
    - 输入非空时：按歌单标题 `name.contains(query, ignoreCase = true)` 进行大小写不敏感匹配；
    - 有匹配结果时展示 3 列 `GridLayoutManager` + `HomePlaylistGridAdapter`；
    - 无匹配结果时展示居中空状态提示（`emptyView`）；
  - 点击歌单项：复用 `openPlaylist` 逻辑，根据 `sourceType`（`KG`/`IMPORT_KG` vs `WY`/`IMPORT_WY`）分别启动 `PlaylistDetailActivity` 或 `WyPlaylistDetailActivity`；
  - 底部挂载 `HomeMiniPlayerBinder` 与系统栏 / 安全区 Insets 联动适配。

- **[NEW] [activity_favorite_playlists_search.xml](file:///e:/Projects/Project/pisamusic/pm/app/src/main/res/layout/activity_favorite_playlists_search.xml)**
  - 结构参考 `activity_loved_songs_search.xml`，但**完全去除 `playAllBar`（播放全部工具条）**；
  - 包含 `statusBarSpacer`、`searchHeaderBar`（带搜索框 `bg_search_field`、清除按钮、取消按钮）、`searchResultsRecyclerView`、`emptyView` 以及底部 `homeMiniPlayer`。

### 3. 清单与文案配置
- **[MODIFY] [AndroidManifest.xml](file:///e:/Projects/Project/pisamusic/pm/app/src/main/AndroidManifest.xml)**
  - 注册 `FavoritePlaylistsSearchActivity`，配置 `exported="false"`、`theme="@style/Theme.Pm"`、`windowSoftInputMode="adjustResize"`。

- **[MODIFY] [strings.xml](file:///e:/Projects/Project/pisamusic/pm/app/src/main/res/values/strings.xml)**
  - 添加搜索提示文案：
    - `favorite_playlists_search_hint` -> `"搜索收藏的歌单"`
    - `favorite_playlists_search_empty` -> `"未找到相关歌单"`

### 4. UI 索引规范文档更新
- **[MODIFY] [components.md](file:///e:/Projects/Project/pisamusic/pm/design-html/components.md)**
  - 在“播放相关”或“列表、卡片与行项目”表中补充 `FavoritePlaylistsSearchActivity` 作为“歌单收藏独立搜索页”的索引项。

---

## 详细设计与核心逻辑

### 1. 搜索状态流转
```
┌─────────────────┐
│ 用户进入搜索页面 │
└────────┬────────┘
         │ (onEnterAnimationComplete 自动弹出软键盘)
         ▼
┌─────────────────────────────────┐
│ 输入框为空 (query.isEmpty())    │ ───► 隐藏 RecyclerView，隐藏 EmptyView
└────────┬────────────────────────┘
         │ (用户输入关键词 query)
         ▼
┌──────────────────────────────────────────────┐
│ 过滤 playlistsFlow (it.name contains query)   │
└────────┬───────────────────────────────┬──────┘
         │ 有匹配项                       │ 无匹配项
         ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│ 展示 3 列网格 RecyclerView     │ │ 展示 EmptyView ("未找到相关歌单")│
│ 点击打开对应平台歌单详情页     │ └───────────────────────────────┘
└───────────────────────────────┘
```

### 2. 歌单点击跳转路由
```kotlin
private fun openPlaylist(item: HomeRecommendPlaylist) {
    when (item.sourceType) {
        CollectedPlaylistType.KG, CollectedPlaylistType.IMPORT_KG -> {
            PlaylistDetailActivity.start(
                context = this,
                playlistId = item.id,
                title = item.name,
                coverUrl = item.coverUrl,
                playCountLabel = item.playCountLabel,
                trackCount = item.trackCount,
            )
        }
        CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY -> {
            WyPlaylistDetailActivity.start(
                context = this,
                playlistId = item.id,
                title = item.name,
                coverUrl = item.coverUrl,
                playCountLabel = item.playCountLabel,
                trackCount = item.trackCount,
                storageType = item.sourceType,
            )
        }
        CollectedPlaylistType.LOCAL -> Unit
    }
}
```

---

## 验证方案

1. **编译检查**：
   - 运行 `./gradlew :app:assembleDebug` 确保代码无编译错误、资源引用正确、数据绑定无异常。
2. **交互与功能验证**：
   - 从“我的” -> “歌单收藏”页面进入，确认右上角搜索按钮可见并正常响应点击；
   - 点击进入搜索页，验证动画流畅、搜索框自动获焦并弹起软键盘；
   - 输入歌单名称关键词，验证歌单列表实时精准过滤；
   - 验证无【播放全部】工具条，页面整洁无多余控件；
   - 点击搜索结果中的歌单卡片，验证能否正确打开酷狗/网易云歌单详情页；
   - 点击“X”清空按钮或“取消”文本按钮，验证清空与平滑返回逻辑；
   - 底部迷你播放器在歌曲播放中时能正确同步状态与点击打开播放器。
