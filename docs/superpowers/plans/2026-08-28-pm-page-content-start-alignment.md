# PM Page Content Start Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PM 手机端除主播放界面外的普通页面统一到歌曲列表当前使用的 12dp 左侧视觉基线，并让返回箭头、菜单图标的图形本身精确落在该基线上。

**Architecture:** 在 `dimens.xml` 建立唯一的页面内容起始边距 `pm_page_content_start=12dp`。顶部前导动作统一为 48dp 点击区 + 12dp drawable 区起点，并将返回/菜单 vector 的左侧透明画布移除，使实际笔画而非 ImageButton 外框精确从 12dp 开始；页面级容器引用同一 token。卡片内部间距、封面与文字间距、按钮内部间距等不属于页面基线的值保持不变，避免机械替换破坏组件结构。

**Tech Stack:** Android XML layouts、Material Components、Kotlin/ViewBinding、Gradle Android plugin。

## Global Constraints

- 目标基线固定为 12dp，来源是 `item_song_list.xml` 中通用歌曲行封面的现有起点。
- 主播放界面 `activity_player.xml`、播放队列、歌词面板和播放页内部控件不参与。
- BottomSheet、Dialog、抽屉内部、卡片内部和“封面到文字”等组件内部间距不按页面边距处理。
- 嵌套 RecyclerView 不允许叠加页面 padding 与行项目 padding，最终以首个可见封面/卡片/文字的实际 X 坐标为准。
- 返回箭头和三条杠菜单图标的实际笔画左缘必须位于 12dp；点击区域统一为 48dp，不缩成 24dp。
- 只处理 `pm/` 与本计划文档，不修改 `server/`、`yixi/` 或 `example/`。
- 速度优先，仅执行 XML/Kotlin 编译和差异检查，不安装、不启动 App、不跑完整测试。

---

### Task 1: 建立统一页面边距与顶部前导动作组件

**Files:**
- Modify: `pm/app/src/main/res/values/dimens.xml`
- Modify: `pm/app/src/main/res/values/styles.xml`
- Modify: `pm/app/src/main/res/drawable/ic_back_24.xml`
- Modify: `pm/app/src/main/res/drawable/ic_menu_24.xml`
- Modify: `pm/components.md`

**Interfaces:**
- Produces: `@dimen/pm_page_content_start`，值为 `12dp`。
- Produces: `@style/Widget.Pm.PageLeadingAction`，固定 48dp 点击区与 12dp padding。
- Produces: 去除左透明画布后的 `ic_back_24` / `ic_menu_24`，图标实际笔画从 drawable 左缘开始。

- [x] **Step 1: 增加页面级尺寸 token**

```xml
<dimen name="pm_page_content_start">12dp</dimen>
```

- [x] **Step 2: 建立 48dp 前导动作样式并校正 vector 光学边界**

`Widget.Pm.PageLeadingAction` 统一 `48dp × 48dp`、`12dp` padding 和 borderless ripple。`ic_back_24.xml` 将原路径从 `M328,112L184,256l144,144` 左移 160 viewport 单位为 `M168,112L24,256l144,144`；`ic_menu_24.xml` 三条横线路径整体左移 3 viewport 单位，使实际笔画起点均为 drawable x=0。

- [x] **Step 3: 在组件索引记录基线规则**

在“基础控件”补充“页面内容左基线 / 顶部前导按钮”，明确普通页面内容用 `pm_page_content_start`；返回/菜单按钮使用 `Widget.Pm.PageLeadingAction` 和无左透明留白的专用 vector，图形笔画左缘最终为 12dp。

- [x] **Step 4: 运行资源处理验证 token 可解析**

Run: `cd pm; .\gradlew.bat :app:processDebugResources`

Expected: `BUILD SUCCESSFUL`，无缺失 dimen。

### Task 2: 统一首页、发现页与我的页的顶部图标和内容基线

**Files:**
- Modify: `pm/app/src/main/res/layout/activity_main.xml`
- Modify: `pm/app/src/main/res/layout/fragment_discover.xml`
- Modify: `pm/app/src/main/res/layout/fragment_mine.xml`
- Modify: `pm/app/src/main/res/layout/fragment_recommended_songs.xml`
- Modify: `pm/app/src/main/res/layout/item_home_recommend_playlist.xml`
- Modify: `pm/app/src/main/res/layout/item_mine_favorites_row.xml`
- Modify: `pm/app/src/main/res/layout/item_mine_local_music_row.xml`
- Modify: `pm/app/src/main/res/layout/item_mine_cover_title_row.xml`
- Modify: `pm/app/src/main/res/layout/item_mine_local_playlist_section_header.xml`
- Modify: `pm/app/src/main/res/layout/item_mine_playlist_row.xml`
- Modify: `pm/app/src/main/res/layout/item_mine_new_local_playlist_row.xml`

**Interfaces:**
- Consumes: `@dimen/pm_page_content_start`、`@style/Widget.Pm.PageLeadingAction`。
- Produces: 首页功能卡、标题、歌单封面、歌曲封面和我的页列表均以 12dp 为首个可见内容起点。

- [x] **Step 1: 对齐首页和发现页三条杠菜单图标**

顶部容器 `paddingStart` 改为 0，菜单按钮改用 48dp 公共前导动作样式；左移后的 menu vector 在按钮 12dp drawable 起点处直接落笔，尾部 padding 不做无关调整。

- [x] **Step 2: 对齐首页推荐内容**

功能大图和各 section 标题引用 `@dimen/pm_page_content_start`；首页歌曲横向 RecyclerView 去掉会与 `item_song_list` 的 12dp 重复叠加的 start padding；首页歌单列表由 RecyclerView 持有 12dp 起点，行项目取消左侧 4dp 内缩并把原总宽度补到 end，保持卡片内容宽度不变。

- [x] **Step 3: 对齐我的页顶部菜单与列表行**

我的页菜单图形对齐 12dp；我的/歌单两个 RecyclerView 的实际首个封面或分组标题对齐 12dp。只调整 row 根层页面边距，保留封面与标题之间的 10dp、更多按钮和空状态内部 padding。

- [x] **Step 4: 资源处理检查**

Run: `cd pm; .\gradlew.bat :app:processDebugResources`

Expected: `BUILD SUCCESSFUL`。

### Task 3: 统一搜索、搜索结果与云盘页面

**Files:**
- Modify: `pm/app/src/main/res/layout/activity_search.xml`
- Modify: `pm/app/src/main/res/layout/activity_loved_songs_search.xml`
- Modify: `pm/app/src/main/res/layout/activity_favorite_playlists_search.xml`
- Modify: `pm/app/src/main/res/layout/item_search_playlist.xml`
- Modify: `pm/app/src/main/res/layout/fragment_home_playlist_square.xml`
- Modify: `pm/app/src/main/res/layout/fragment_cloud_music.xml`
- Modify: `pm/app/src/main/res/layout/activity_cloud_music_submission.xml`

**Interfaces:**
- Consumes: 页面边距 token。
- Produces: 搜索输入页、结果 tab、歌曲结果、歌单结果、云盘 Hero/功能卡/歌曲预览的可见内容起点均为 12dp。

- [x] **Step 1: 统一搜索头部和结果 tab**

搜索返回按钮改为 48dp 公共前导动作样式并移除父层额外 start inset；同步收紧搜索框前的小间距，保持搜索框原有 X 坐标。结果 tab 的 16dp 起点改为页面 token。

- [x] **Step 2: 消除搜索列表嵌套边距**

歌曲结果继续由 `item_song_list` 自身提供 12dp；歌单结果由列表容器或 `item_search_playlist` 中唯一一层提供 12dp，不保留 12dp + 12dp 的叠加。收藏歌曲、收藏歌单和云盘独立搜索页复用同一规则。

- [x] **Step 3: 对齐云盘主页和投稿页外层**

云盘 NestedScrollView 的页面 start 改为 token；Hero、功能卡和最近更新保持内部 10/12/16dp 组件间距不变。投稿页仅调整 toolbar/页面外层，不改居中插画内部尺寸。

- [x] **Step 4: XML 解析检查**

Run: `cd pm; .\gradlew.bat :app:processDebugResources`

Expected: `BUILD SUCCESSFUL`。

### Task 4: 统一歌单详情、歌单列表与所有分类

**Files:**
- Modify: `pm/app/src/main/res/layout/activity_playlist_detail.xml`
- Modify: `pm/app/src/main/res/layout/item_playlist_detail_header.xml`
- Modify: `pm/app/src/main/res/layout/playlist_detail_sticky_play_all.xml`
- Modify: `pm/app/src/main/res/layout/item_playlist_detail_list_status.xml`
- Modify: `pm/app/src/main/res/layout/activity_home_playlist_list.xml`
- Modify: `pm/app/src/main/res/layout/activity_home_playlist_explore.xml`
- Modify: `pm/app/src/main/res/layout/fragment_home_playlist_square.xml`
- Modify: `pm/app/src/main/res/layout/activity_favorite_playlists_search.xml`

**Interfaces:**
- Consumes: 页面边距 token。
- Produces: 歌单详情顶栏箭头、Hero 文案、按钮、吸顶播放栏、歌曲行、歌单卡片和分类内容共享 12dp 基线。

- [x] **Step 1: 对齐歌单详情返回箭头**

顶栏 start 归零，返回按钮改用 48dp 公共前导动作样式；校正后的箭头 vector 在按钮 12dp drawable 起点处直接落笔。搜索/分享/更多按钮顺序和右侧间距不变。

- [x] **Step 2: 对齐详情 Header 与吸顶栏**

标题、描述、双按钮容器、搜索条、52dp 吸顶播放栏的页面级 start 改为 `pm_page_content_start`。Hero 仍全宽，按钮内部 icon/text padding 不改。

- [x] **Step 3: 对齐歌曲行和歌单列表**

详情歌曲行继续由通用 `item_song_list` 提供 12dp；状态行与工具条不再使用 16dp。歌单列表 RecyclerView 和卡片 item 只保留一层 start 边距，最终封面为 12dp。

- [x] **Step 4: 对齐所有分类页**

分类页返回箭头使用公共前导动作样式，分类 ScrollView 的页面 start 使用 12dp；分类 chip 自身 8dp horizontal padding、10dp gap 属于内部布局，保持不变。

- [x] **Step 5: 资源处理检查**

Run: `cd pm; .\gradlew.bat :app:processDebugResources`

Expected: `BUILD SUCCESSFUL`。

### Task 5: 统一设置体系及其余普通页面外层

**Files:**
- Modify: `pm/app/src/main/res/layout/activity_settings.xml`
- Modify: `pm/app/src/main/res/layout/activity_sub_settings.xml`
- Modify: `pm/app/src/main/res/layout/activity_account_assist.xml`
- Modify: `pm/app/src/main/res/layout/activity_account_profile.xml`
- Modify: `pm/app/src/main/res/layout/activity_audio_effects.xml`
- Modify: `pm/app/src/main/res/layout/activity_audio_effect_preset_edit.xml`
- Modify: `pm/app/src/main/res/layout/activity_cache_management.xml`
- Modify: `pm/app/src/main/res/layout/activity_dev_debug.xml`
- Modify: `pm/app/src/main/res/layout/activity_fault_report.xml`
- Modify: `pm/app/src/main/res/layout/activity_feedback.xml`
- Modify: `pm/app/src/main/res/layout/activity_local_music.xml`
- Modify: `pm/app/src/main/res/layout/activity_local_music_scan.xml`
- Modify: `pm/app/src/main/res/layout/activity_login.xml`
- Modify: `pm/app/src/main/res/layout/activity_playlist_import.xml`
- Modify: `pm/app/src/main/res/layout/activity_share_detail.xml`
- Modify: `pm/app/src/main/res/layout/activity_wy_playlist_login.xml`
- Modify: `pm/app/src/main/res/layout/include_cache_category_card.xml`
- Modify: `pm/app/src/main/res/layout/include_data_management_card.xml`
- Modify: `pm/app/src/main/res/layout/include_playlist_import_kg_login.xml`
- Modify: `pm/app/src/main/res/layout/item_local_music_edit_row.xml`
- Modify: `pm/app/src/main/res/layout/item_local_music_scan_result.xml`
- Modify: `pm/app/src/main/res/layout/zxing_capture.xml`

**Interfaces:**
- Consumes: 页面边距 token。
- Produces: 主设置卡片、二级设置分组、账号/反馈/缓存/数据/本地音乐/导入/WebView 等普通页的外层视觉起点为 12dp。

- [x] **Step 1: 对齐主设置页与二级设置模板**

主设置卡片容器和二级设置 RecyclerView 使用 12dp；保留 section/row 内部文字、开关、摘要和 divider 的现有组件缩进，不把它们误改成页面边距。

- [x] **Step 2: 对齐 MaterialToolbar 返回箭头**

所有非播放页 MaterialToolbar 继续使用系统 48dp navigation button，并统一换用去除左透明画布的 `ic_back_24`；其 24dp drawable 区从按钮 x=12dp 开始，因此实际箭头笔画落在页面 12dp。页面标题和右侧 action 不做无关位移。

- [x] **Step 3: 对齐其余普通页的外层容器**

逐页处理账号资料/辅助、登录、反馈、故障上报、缓存管理、数据管理、本地音乐与编辑/扫描、歌单导入与第三方登录、分享详情、通用 WebView 等。只改最外层 page/card/list start；输入框内部 padding、图标到文字 margin、卡片内容 padding 和按钮 padding 保持原值。

- [x] **Step 4: 确认播放页未被修改**

Run: `git diff --name-only -- pm/app/src/main/res/layout/activity_player.xml pm/app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`

Expected: 无输出。

### Task 6: 文档同步与轻量验证

**Files:**
- Modify: `pm/AGENTS.md`
- Modify: `pm/components.md`
- Verify: all changed PM resource/Kotlin files

**Interfaces:**
- Produces: 后续页面可直接复用的页面边距规范。

- [x] **Step 1: 更新项目约束**

在 `pm/AGENTS.md` 记录：除播放界面外，普通页面可见内容默认以 `pm_page_content_start` 对齐；返回/菜单图形左缘同样落在该基线；嵌套列表不得重复叠加 start padding。

- [x] **Step 2: 检查剩余硬编码外层边距**

Run: `rg -n --glob '*.xml' 'paddingStart="(14|16|18|20|24|28|32)dp"|layout_marginStart="(14|16|18|20|24|28|32)dp"' pm/app/src/main/res/layout`

Expected: 剩余命中均能说明为组件内部间距、播放相关布局或刻意居中布局；目标页面外层不再出现多套基线。

- [x] **Step 3: 编译 Kotlin 与资源**

Run: `cd pm; .\gradlew.bat :app:compileDebugKotlin`

Expected: `BUILD SUCCESSFUL`。

- [x] **Step 4: 检查差异质量和工作区边界**

Run: `git diff --check`

Expected: 无空白错误；`git status --short` 只出现 `pm/` 和本计划文档的目标文件。

- [x] **Step 5: 人工核对验收点（不启动 App）**

静态核对：首页 menu、三张功能图、今日推荐标题、歌单封面、歌曲封面；搜索返回箭头、tab 与结果；我的菜单和列表；云盘 Hero；歌单详情返回箭头/Header/吸顶栏/歌曲；歌单列表与分类；设置主卡片和二级设置，均归一到 12dp。设备显示效果由用户后续测试。
