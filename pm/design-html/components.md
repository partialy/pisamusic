# PM 可复用 UI 位置索引

本文件用于记录 `pm/` Android 端已经存在的可复用 UI、布局样式和交互位置。新建页面、弹窗、表单、列表行、按钮、开关、卡片等 UI 前，先在这里查找是否已有同款或近似实现。

## 使用规则

- 先查本文件，再新建 UI。
- 如果已有同款或近似 UI，优先复用对应 layout、drawable、style、Kotlin 封装或交互模式。
- 如果现有 UI 只是视觉相似但业务不同，复用样式和结构，不要强行复用业务绑定逻辑。
- 如果确实没有合适参考，可以新建；新建后把可复用位置补回本文件。
- 地址优先写项目内相对路径；暂时找不到准确位置时写 `待补充`。

## 基础控件

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 滑动轨道 / 进度条 | 细轨道、小圆点滑块、百分比类调节 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `bg_lyric_settings_seekbar_progress.xml`、`bg_lyric_settings_seekbar_thumb.xml` | 歌词不透明度示例，主题色走 primary。 |
| 开关 Switch | 设置项开关、底部面板开关 | `pm/app/src/main/res/layout/item_settings_switch.xml`、`pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `cn.partialy.pm.ui.widget.PmSwitch`、`Widget.Pm.SettingsSwitch` | 新增原生开关优先用 `PmSwitch`；标准开关本体为 40dp × 24dp。 |
| 数字步进器 | 小范围数字加减，例如字号差值 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `bg_lyric_settings_stepper.xml` | 适合 2-8、12-30 这类小范围配置。 |
| M3 输入框 | 表单输入、房间名、邀请码、登录信息 | `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`、`pm/app/src/main/res/layout/include_playlist_import_kg_login.xml` | `TextInputLayout` / `TextInputEditText` | 表单不要直接裸写普通输入框，优先参考这些 M3 输入框。 |
| 主按钮 / 次按钮 | 提交、创建、加入、保存等动作 | `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`、`pm/app/src/main/res/layout/include_playlist_import_kg_login.xml` | Material Button、现有 drawable 背景 | 优先沿用已有圆角、填充、描边和禁用态做法。 |
| 图标按钮 | 播放页工具、加减、更多、关闭等图标操作 | `pm/app/src/main/res/layout/activity_player.xml`、`pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `ImageButton` + 项目 drawable 图标 | 工具类操作优先图标化，补充 contentDescription。 |
| 分段按钮 | 三选一/少量互斥选项 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `MaterialButtonToggleGroup`、`lyric_settings_segment_*` color selector | 对齐方式示例，选中态使用 primary，不走默认粉紫色。 |

## 弹窗与底部面板

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 居中确认弹窗 | 简短确认、危险操作确认、提示 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PmMinimalDialog.kt` | `pm/app/src/main/res/layout/dialog_pm_minimal.xml` | 普通确认类弹窗优先使用；背景浅色 `#FFFFFF`、深色 `#2A2D34`，深色边框与按钮分割线使用 `#3D424C`。 |
| 居中自定义内容弹窗 | 表单、列表、封面选择等 slot 内容 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PmSlotDialog.kt` | `pm/app/src/main/res/layout/dialog_pm_slot.xml` | 中间内容由调用方布局负责，并复用 `PmMinimalDialog` 的日夜背景、文字和分割线颜色。 |
| 一起听二维码弹窗 | 展示房间二维码、房间号及复制操作 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ListenTogetherQrDialog.kt` | `dialog_listen_together_qr.xml`、`PmSlotDialog` | 二维码统一编码官网 `/scan` 加入链接。 |
| 现代底部弹窗 | 通用底部 Sheet、进度或旧场景 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ModernDialog.kt` | `pm/app/src/main/res/layout/layout_modern_bottom_sheet.xml` | 旧场景保留，新普通确认不要继续扩展它。 |
| 普通 BottomSheet 容器 | 统一圆角底部面板 | `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`、`pm/app/src/main/res/layout/layout_action_menu_bottom_sheet.xml` | `bg_bottom_sheet.xml` | 新增底部面板先参考现有圆角和最大高度处理。 |
| 通用操作菜单 | 顶部信息头、图标和文案操作行 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ActionMenuBottomSheet.kt` | `layout_action_menu_bottom_sheet.xml`、`item_action_menu_row.xml` | 动作在 Sheet 关闭后执行；支持普通色和危险色操作。 |
| 底部圆角选项选择器 | 设置、播放音质等单选列表 | `pm/app/src/main/res/layout/layout_bottom_radius_options_sheet.xml` | `SettingsOptionPickerBottomSheet.kt`、`QualityPickerBottomSheet.kt`、`item_settings_option_sheet_row.xml` | 顶部标题、无分割线选项、底部取消/确定按钮；点击选项只暂存，确定后才提交。弹层使用通用 `modal_surface_background`，取消按钮使用 `action_secondary_background` / `action_secondary_text`，确定按钮使用主题 `colorPrimary` / `action_primary_text`；浅色分别为 `#FFFFFF`、`#F5F5F5`、`#4A4A4A`、白字，深色分别为 `#2A2D34`、`#5A595B`、白字、白字。 |
| 下载音质选择弹窗 | 下载歌曲前选择音质 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt` | `dialog_download_quality_picker.xml`、`item_settings_option_sheet_row.xml` | 保留歌曲信息和居中弹窗容器，复用通用主题色选项行且无选项分割线。 |
| 歌曲更多菜单 | 歌曲操作菜单 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SongMoreMenu.kt` | `ActionMenuBottomSheet` | 歌曲业务保留在该入口，外观和操作行复用通用操作菜单。 |
| 音乐分享 Sheet | 歌曲 / 歌单链接与二维码分享 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ShareBottomSheet.kt` | `bottom_sheet_share.xml`、`include_share_info_header.xml`、`ShareQrBitmapFactory` | 顶部封面信息、居中二维码、M3 链接输入框和复制图标；未登录不创建分享记录。 |
| 歌单操作菜单 | 歌单分享、收藏歌单删除 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PlaylistActionBottomSheet.kt` | `ActionMenuBottomSheet`、`ShareBottomSheet` | 在线歌单未收藏时也允许分享；删除动作仅在传入本地收藏记录时显示。 |
| 一起听成员管理菜单 | 房主转让、移出成员 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ListenTogetherMemberActionMenu.kt` | `ActionMenuBottomSheet`、`PmMinimalDialog` | 仅房主点击其他成员时显示，危险操作使用红色并二次确认。 |
| 歌单更多菜单 | 我的歌单操作菜单 | `pm/app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistMoreBottomSheet.kt` | `bottom_sheet_mine_playlist_more.xml` | 歌单重命名、删除等菜单参考。 |
| 公告底部弹窗 | 公告内容展示 | `pm/app/src/main/res/layout/layout_announcement_bottom_sheet.xml` | `MainActivity` 中公告弹窗逻辑、`bg_bottom_radius_sheet.xml` | 复用选项 Sheet 的圆角背景、日夜弹层色和胶囊按钮；“我知道了”使用次级操作色，“前往查看”及 WebView 强调色跟随 `colorPrimary`。 |
| 错误底部弹窗 | 错误详情展示 | `pm/app/src/main/res/layout/layout_error_bottom_sheet.xml` | `ModernDialog` / 相关错误展示逻辑 | 错误详情类底部展示参考。 |

## 设置与表单

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 设置普通行 | 设置页入口、右侧摘要、箭头 | `pm/app/src/main/res/layout/item_settings_row.xml` | `SettingsActivity` | 新增设置入口优先复用。 |
| 设置开关行 | 设置页开关项 | `pm/app/src/main/res/layout/item_settings_switch.xml` | `PmSwitch`、`Widget.Pm.SettingsSwitch` | 不要为设置开关另写一套样式。 |
| 缓存分类卡片 | 设置/工具页统计卡片 | `pm/app/src/main/res/layout/include_cache_category_card.xml` | `CacheManagementActivity` | 有标题、说明、大小、操作按钮。 |
| 登录表单 | 账号/第三方导入登录表单 | `pm/app/src/main/res/layout/activity_login.xml`、`pm/app/src/main/res/layout/include_playlist_import_kg_login.xml` | `LoginActivity`、`WyPlaylistLoginActivity` | 输入框、验证码按钮、扫码占位可参考。 |
| 本地歌单创建表单 | 新建歌单、封面选择表单 | `pm/app/src/main/res/layout/dialog_create_local_playlist.xml` | `PmSlotDialog` 调用场景 | 居中表单优先参考。 |
| 账号资料 WebView 容器 | 资料页 WebView 承载 | `pm/app/src/main/res/layout/activity_account_profile.xml` | `AccountProfileActivity` | 全屏 WebView 容器和系统栏处理参考。 |

## 列表、卡片与行项目

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 歌曲列表行 | 搜索、歌单、收藏、本地歌曲列表 | `item_playlist_song.xml`、`item_search_result.xml`、`item_favorite_song.xml`、`item_local_music.xml` | 对应 Adapter | 新增歌曲行先找最接近业务的现有行。 |
| 歌单列表行 | 我的歌单、选择歌单、搜索歌单 | `item_mine_playlist_row.xml`、`item_pick_local_playlist_row.xml`、`item_search_playlist.xml` | `MinePlaylistsAdapter`、`SearchPlaylistAdapter` | 封面、标题、副标题、更多按钮参考。 |
| 首页推荐歌单卡片 | 首页横向/网格歌单卡片 | `item_home_recommend_playlist.xml` | `HomeRecommendPlaylistAdapter`、`HomePlaylistGridAdapter` | 首页歌单卡片优先复用。 |
| 首页功能卡片 | 每日推荐、雷达、猜你喜欢等入口 | `item_home_feature_card.xml` | `HomeFeatureCardsAdapter` | 首页功能入口卡片参考。 |
| 首页每日歌曲卡片 | 每日歌曲小卡 | `item_home_daily_song.xml` | `HomeDailySongGridAdapter` | 小型歌曲卡片参考。 |
| 搜索建议 / 热搜项 | 搜索页建议和热搜 | `item_search_suggestion.xml`、`item_hot_search.xml`、`item_search_recommend.xml` | `SuggestionsAdapter`、`HotSearchAdapter` | 搜索页列表项参考。 |
| 封面缩略图 | 封面选择、歌单封面列表 | `item_dialog_local_cover_thumb.xml` | `CreateLocalPlaylistCoverPickerAdapter` | 封面选择网格参考。 |
| 我的页面入口行 | 我的页收藏、本地、歌单入口 | `item_mine_favorites_row.xml`、`item_mine_local_music_row.xml`、`item_mine_new_local_playlist_row.xml` | `MineMyTabFragment` | 我的页入口行参考。 |

## 播放相关

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 播放队列 BottomSheet | 当前播放列表、清空、队列空状态 | `pm/app/src/main/res/layout/bottom_sheet_playlist.xml` | `PlayerActivity`、`PlaylistAdapter` | 播放队列面板参考。 |
| 歌词设置面板 | 歌词样式设置、滑轨、分段按钮、步进器 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `LyricSettingsSheet` | 歌词相关设置优先参考。 |
| 迷你播放器 | 底部迷你播放器 | `pm/app/src/main/res/layout/home_mini_player.xml` | `HomeMiniPlayerBinder` | 首页/主界面底部播放入口参考。 |
| 歌词行 | 普通歌词 RecyclerView 行 | `pm/app/src/main/res/layout/item_lyric_line.xml` | `LyricsAdapter` | 非卡拉 OK View 的普通歌词行。 |
| 卡拉 OK 歌词 View | 逐字歌词渲染 | `pm/app/src/main/java/cn/partialy/pm/ui/player/KaraokeLyricsView.kt` | `LyricDisplayStyle` | 自绘歌词，不要用普通 TextView 代替。 |
| 歌源标签 | KG/WY/KW/LOCAL 标签 | `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt` | `song_tag_*` 颜色资源 | 歌源标识统一从这里绑定。 |

## 状态、错误与 WebView

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 列表空状态 | 播放队列、详情页、列表无数据 | `bottom_sheet_playlist.xml`、`item_playlist_detail_status.xml`、`item_playlist_detail_list_status.xml` | 对应 Activity / Adapter | 空状态文案和可见性处理参考。 |
| 列表加载 / 错误状态 | 歌单详情、列表加载失败 | `item_playlist_detail_status.xml`、`item_playlist_detail_list_status.xml` | `PlaylistDetailActivity` 等 | 加载、重试、错误展示参考。 |
| 通用 WebView 页面 | 协议、隐私、配置 HTML 内容 | `pm/app/src/main/res/layout/activity_web_content.xml` | `activity/web` 相关页面 | WebView 内容承载参考。 |
| 分享详情页 | App 内打开音乐分享链接 | `pm/app/src/main/java/cn/partialy/pm/activity/ShareDetailActivity.kt` | `activity_share_detail.xml`、`bg_share_detail_*` | 原生页面展示歌曲 / 歌单分享详情；通过 `pisamusic://scan?type=music-share` 分发进入。 |
| WebView 本地错误页 | WebView 加载失败兜底 | `pm/app/src/main/java/cn/partialy/pm/ui/web/LocalGenericErrorWebViewController.kt` | `assets/` 内本地错误页面 | WebView 错误兜底优先用这个控制器。 |
| 安全区 / 系统栏适配 | edge-to-edge padding | `pm/app/src/main/java/cn/partialy/pm/ui/insets/SystemBarsExt.kt` | `applySystemBarsInsets` 等扩展 | 新全屏页面先参考。 |

## 待补充

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| Toast / 全局消息 | 轻提示、操作结果提示 | 待补充 | 待补充 | 如果已有统一封装，请补充位置。 |
| 骨架屏 / 占位加载 | 列表加载占位 | 待补充 | `bg_skeleton_rounded.xml` | 需要确认真实使用位置。 |
| 顶部标题栏 / 返回栏 | 原生页面顶部导航 | 待补充 | 待补充 | 需要补充最推荐的页面参考。 |
| 图片裁剪 / 头像选择 | 图片选择、头像裁剪 | 待补充 | 待补充 | 需要确认当前推荐实现。 |
## 最近补充

- 数据管理卡片：`pm/app/src/main/res/layout/include_data_management_card.xml`，用于数据概览、导出、导入这类带图标、说明、操作按钮和状态提示的设置卡片；`DataManagementActivity` 复用该布局并使用 `PmMinimalDialog` 统一确认弹窗。
- 信息操作头部：`pm/app/src/main/res/layout/include_song_info_header.xml` 用于左侧图片、右侧标题/副标题；`SongInfoHeaderBinder` 绑定歌曲，通用操作菜单也可绑定圆形成员头像和在线状态。
