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
| 居中自定义内容弹窗 | 表单、列表、封面选择等 slot 内容 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PmSlotDialog.kt` | `pm/app/src/main/res/layout/dialog_pm_slot.xml` | 支持固定 `header slot`、可滚动 `content slot` 和底部按钮三段式；歌曲信息头部等固定内容放 header，中间选项或表单滚动，并复用 `PmMinimalDialog` 的日夜背景、文字和分割线颜色。 |
| 一起听二维码弹窗 | 展示房间二维码、房间号及复制操作 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ListenTogetherQrDialog.kt` | `dialog_listen_together_qr.xml`、`PmSlotDialog` | 二维码统一编码官网 `/scan` 加入链接。 |
| 现代底部弹窗 | 通用底部 Sheet、进度或旧场景 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ModernDialog.kt` | `pm/app/src/main/res/layout/layout_modern_bottom_sheet.xml` | 旧场景保留，新普通确认不要继续扩展它。 |
| 普通 BottomSheet 容器 | 统一圆角底部面板 | `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`、`pm/app/src/main/res/layout/layout_action_menu_bottom_sheet.xml` | `bg_bottom_sheet.xml` | 新增底部面板先参考现有圆角和最大高度处理。 |
| 通用操作菜单 | 顶部信息头、图标和文案操作行 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ActionMenuBottomSheet.kt` | `layout_action_menu_bottom_sheet.xml`、`item_action_menu_row.xml` | 动作在 Sheet 关闭后执行；支持普通色和危险色操作。 |
| 底部圆角选项选择器 | 设置、播放音质等单选列表 | `pm/app/src/main/res/layout/layout_bottom_radius_options_sheet.xml` | `SettingsOptionPickerBottomSheet.kt`、`QualityPickerBottomSheet.kt`、`item_settings_option_sheet_row.xml` | 顶部标题、无分割线选项、底部取消/确定按钮；点击选项只暂存，确定后才提交。弹层使用通用 `modal_surface_background`，取消按钮使用 `action_secondary_background` / `action_secondary_text`，确定按钮使用主题 `colorPrimary` / `action_primary_text`；浅色分别为 `#FFFFFF`、`#F5F5F5`、`#4A4A4A`、白字，深色分别为 `#2A2D34`、`#5A595B`、白字、白字。音质禁用项必须复用 `OptionPickerRows` 的 `enabled=false`：不可被选中，标题和选中图标变灰；`badge` 复用右侧主题蓝字、浅蓝圆角底的 `optionBadge`。音质行完整显示当前音源全部选项：游客受限项标“需登录”并通过回调关闭选择器、进入 PisaMusic 登录页，普通系统账号的高级受限项标“联系作者解锁”并通过回调进入已预选“账号相关”的意见反馈页；不要另建样式或把禁用项当作已选音质返回。 |
| 下载音质选择弹窗 | 下载歌曲前选择音质 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt` | `dialog_download_quality_picker.xml`、`include_song_info_header.xml`、`item_settings_option_sheet_row.xml` | 歌曲信息放在 `PmSlotDialog` header slot 固定显示，音质选项放 content slot 滚动，复用通用主题色选项行且无选项分割线；默认选中项不可用时复用首个可用项，确认不得返回禁用项。 |
| 歌曲更多菜单 | 歌曲操作菜单 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SongMoreMenu.kt` | `ActionMenuBottomSheet` | 歌曲业务保留在该入口，外观和操作行复用通用操作菜单。 |
| 音乐分享 Sheet | 歌曲 / 歌单链接与二维码分享 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ShareBottomSheet.kt` | `bottom_sheet_share.xml`、`include_share_info_header.xml`、`ShareQrBitmapFactory` | 顶部封面信息、居中二维码、一起听同款蓝色 M3 链接输入框和复制图标；未登录不创建分享记录。 |
| 歌单操作菜单 | 歌单详情、分享、收藏、删除 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PlaylistActionBottomSheet.kt` | `ActionMenuBottomSheet`、`ShareBottomSheet`、`ShareDetailActivity` | 网络歌单支持收藏 / 取消收藏、详情和分享；本地歌单不显示收藏，删除动作仅在传入本地收藏记录时显示。 |
| 一起听成员管理菜单 | 房主转让、移出成员 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ListenTogetherMemberActionMenu.kt` | `ActionMenuBottomSheet`、`PmMinimalDialog` | 仅房主点击其他成员时显示，危险操作使用红色并二次确认。 |
| 歌单更多菜单 | 我的歌单操作菜单 | `pm/app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistMoreBottomSheet.kt` | `bottom_sheet_mine_playlist_more.xml` | 歌单重命名、删除等菜单参考。 |
| 公告底部弹窗 | 公告内容展示 | `pm/app/src/main/res/layout/layout_announcement_bottom_sheet.xml` | `MainActivity` 中公告弹窗逻辑、`bg_bottom_radius_sheet.xml` | 复用选项 Sheet 的圆角背景、日夜弹层色和胶囊按钮；“我知道了”使用次级操作色，“前往查看”及 WebView 强调色跟随 `colorPrimary`。 |
| 错误底部弹窗 | 错误详情展示 | `pm/app/src/main/res/layout/layout_error_bottom_sheet.xml` | `ModernDialog` / 相关错误展示逻辑 | 错误详情类底部展示参考。 |

## 设置与表单

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 设置普通行 | 设置页入口、右侧摘要、箭头 | `pm/app/src/main/res/layout/item_settings_row.xml` | `SettingsActivity` | 新增设置入口优先复用。 |
| 设置开关行 | 设置页开关项 | `pm/app/src/main/res/layout/item_settings_switch.xml` | `PmSwitch`、`Widget.Pm.SettingsSwitch` | 不要为设置开关另写一套样式。 |
| 无图标二级设置页 | 播放、下载、歌词、数据、同步等分组设置页 | `pm/app/src/main/res/layout/activity_sub_settings.xml`、`item_sub_settings_*.xml` | `SubSettingsActivity`、`SubSettingsAdapter`、`SubSettingsItem`、`DownloadSettingsActivity`、`LyricSettingsActivity`、`DataSettingsActivity`、`FavoritesSyncSettingsActivity` | 子页只声明标题、分组和 Option / Navigation / Info / Switch；`Info` 是只读信息行，不显示箭头、不响应点击；`summary` 可选，有说明时使用较小、较淡的第二行，无说明时保持原单行布局。 |
| 缓存分类卡片 | 设置/工具页统计卡片 | `pm/app/src/main/res/layout/include_cache_category_card.xml` | `CacheManagementActivity` | 有标题、说明、大小、操作按钮。 |
| 登录表单 | 账号/第三方导入登录表单 | `pm/app/src/main/res/layout/activity_login.xml`、`pm/app/src/main/res/layout/include_playlist_import_kg_login.xml` | `LoginActivity`、`WyPlaylistLoginActivity` | 输入框、验证码按钮、扫码占位可参考。 |
| 本地歌单创建表单 | 新建歌单、封面选择表单 | `pm/app/src/main/res/layout/dialog_create_local_playlist.xml` | `PmSlotDialog` 调用场景 | 居中表单优先参考。 |
| 账号资料 WebView 容器 | 资料页 WebView 承载 | `pm/app/src/main/res/layout/activity_account_profile.xml` | `AccountProfileActivity` | 全屏 WebView 容器和系统栏处理参考。 |
| 故障数据概览页 | 本地故障统计、隐私说明和立即上报 | `pm/app/src/main/res/layout/activity_fault_report.xml` | `FaultReportActivity`、`PmMinimalDialog` | 使用单张圆角统计卡展示总数、最近 7 天、待上报和时间信息；无待上报数据时禁用主按钮，确认上传复用通用居中弹窗。 |

## 列表、卡片与行项目

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 通用歌曲列表行 | 搜索、歌单详情、收藏、本地/已下载、云盘、首页每日推荐 | `item_song_list.xml` | `SongListItemBinder`、`SongListPlaybackStateObserver`、`PlayingSpectrumView` | 按页面配置收藏/下载/更多按钮；当前歌曲歌名/歌手使用 primary，封面显示三线频谱，播放时跳动、暂停时静止。首页保留横向网格尺寸与骨架态，但内部仍复用本组件。 |
| 特殊歌曲列表行 | 播放器队列、扫描结果列表 | `item_playlist_song.xml`、`item_local_music_scan_result.xml` | 对应 Adapter | 播放器队列保留队列专用结构；扫描结果行使用左侧 `MaterialCheckBox`、中间歌曲信息、右侧“已存在”标记。 |
| 歌单列表行 | 我的歌单、选择歌单、搜索歌单 | `item_mine_playlist_row.xml`、`item_pick_local_playlist_row.xml`、`item_search_playlist.xml` | `MinePlaylistsAdapter`、`SearchPlaylistAdapter` | 封面、标题、副标题、更多按钮参考。 |
| 首页推荐歌单卡片 | 首页横向/网格歌单卡片 | `item_home_recommend_playlist.xml` | `HomeRecommendPlaylistAdapter`、`HomePlaylistGridAdapter` | 首页歌单卡片优先复用。 |
| 首页功能卡片 | 云盘、每日推荐、雷达歌单入口 | `item_home_feature_card.xml` | `HomeFeatureCardsAdapter` | 第一张固定进入云盘共享音乐空间，三张卡片统一使用无中文的简约功能图。 |
| 首页每日歌曲卡片 | 每日歌曲横向六行网格 | `item_song_list.xml` | `HomeDailySongGridAdapter` | 复用通用歌曲行；Adapter 仅保留 90% 屏宽、72dp 外层高度与骨架动画。 |
| 云盘数据概览与功能专区 | 首页云盘 Hero 指标卡片、双入口卡片与最近更新预览 | `fragment_cloud_music.xml`、`bg_cloud_music_entry_card.xml`、`bg_cloud_music_summary.xml` | `CloudMusicFragment` | 包含共享音乐空间 Hero 卡片（3指标：歌曲总数、我的贡献、最近更新）、功能专区（搜索云盘、我要投稿双卡片）、最近更新预览（前 3 首）。 |
| 云盘独立搜索页 | 云盘全局检索与全量分页浏览 | `CloudMusicSearchActivity`、`activity_loved_songs_search.xml` | `CloudMusicSearchActivity`、`CloudMusicListAdapter` | 复用收藏搜索同款布局，默认展示全部云盘歌曲支持滑动分页加载，输入关键词实时防抖检索。 |
| 搜索建议 / 热搜项 | 搜索页建议和热搜 | `item_search_suggestion.xml`、`item_hot_search.xml`、`item_search_recommend.xml` | `SuggestionsAdapter`、`HotSearchAdapter`、`SearchViewModel.suggestionJob` | 提示词随输入立即请求，新输入必须取消旧 Retrofit 请求并清空旧提示；热搜继续复用现有列表项。 |
| 搜索音源选择器 | 搜索页当前音源与下拉选项 | `activity_search.xml`、`layout_search_source_dropdown.xml`、`item_search_source_option.xml` | `SearchActivity`、`SongSourceTagBinder` | 当前项和弹出选项只显示 K / Y / W 方块标签，当前弹出项右侧显示勾选；不展示“小蓝 / 小红 / 小黄”平台别名。 |
| 封面缩略图 | 封面选择、歌单封面列表 | `item_dialog_local_cover_thumb.xml` | `CreateLocalPlaylistCoverPickerAdapter` | 封面选择网格参考。 |
| 我的页面入口行 | 我的页收藏、本地、设置和自建歌单入口 | `item_mine_favorites_row.xml`、`item_mine_local_music_row.xml`、`item_mine_cover_title_row.xml`、`item_mine_local_playlist_section_header.xml`、`item_mine_playlist_empty.xml` | `MineMyOverviewAdapter`、`MineMyTabFragment` | 固定入口和分组头由 Overview Adapter 承载，自建歌单行通过 ConcatAdapter 接在后面；页面级 RecyclerView 保持回收，Mine 根层固定 Header Overlay，AppBar 只负责头像折叠与 Tab 吸顶。 |
| 我的页 VIP 到期标签 | 有效系统 VIP 的到期时间 | `fragment_mine.xml`、`bg_mine_vip_expiry_tag.xml` | `MineFragment.applyMineProfileTexts`、`AccountSessionStore` | 位于邮箱下方，复用音源标签的细边框、浅底、同色字视觉但使用金色；仅有效 VIP 显示，画面只显示本地时区 `yyyy-M-d HH:mm:ss` 时间。 |

## 播放相关

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 播放队列 BottomSheet | 当前播放列表、清空、队列空状态 | `pm/app/src/main/res/layout/bottom_sheet_playlist.xml` | `PlayerActivity`、`PlaylistAdapter` | 播放队列面板参考。 |
| 歌单详情吸顶工具条 / 搜索栏 | 歌单大封面 Header、双按钮、顶栏三动作及 52dp 工具条吸顶 | `pm/app/src/main/res/layout/activity_playlist_detail.xml`、`item_playlist_detail_header.xml`、`playlist_detail_sticky_play_all.xml` | `ui/playlistdetail/PlaylistDetailHeaderAdapter`、`PlaylistDetailContentAdapter`、`PlaylistDetailInteractionController`、`bg_playlist_detail_hero_top_scrim.xml`、`bg_playlist_detail_hero_bottom_fade.xml` | 全宽大封面 + 底部羽化渐变；Header 包含标题、描述、16dp 圆角蓝底“播放全部”与灰底“收藏/已收藏”双按钮，以及 52dp `playAllAnchor` 等高占位；顶栏固定搜索/分享/更多（标题最多 1 行尾部省略）；外层唯一 52dp 工具条（左侧 primary 播放图标 + 13sp 次要色曲目数，右侧排序按钮点击弹出设置同款选项 Sheet 进行默认/歌名 A-Z/歌手 A-Z 排序）随 Anchor 连续上移并固定到顶栏下方（单 View 真吸顶）。 |
| 收藏独立搜索页 | 从“我的收藏”右上角进入，实时过滤收藏歌曲 | `pm/app/src/main/res/layout/activity_loved_songs_search.xml` | `LovedSongsSearchActivity`、`PlaylistDetailContentAdapter`、`HomeMiniPlayerBinder` | 查询为空时保留搜索栏与迷你播放器；按歌名/歌手过滤展示，播放仍使用完整收藏列表并按 `type + id` 定位。 |
| 歌单收藏独立搜索页 | 从“歌单收藏”右上角进入，实时过滤收藏歌单 | `pm/app/src/main/res/layout/activity_favorite_playlists_search.xml` | `FavoritePlaylistsSearchActivity`、`HomePlaylistGridAdapter`、`HomeMiniPlayerBinder` | 无播放全部工具条；按歌单名称过滤展示 3 列卡片网格，点击跳转对应平台歌单详情。 |
| 歌词设置面板 | 歌词样式设置、滑轨、分段按钮、步进器 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `LyricSettingsSheet` | 歌词相关设置优先参考。 |
| 迷你播放器 | 底部迷你播放器 | `pm/app/src/main/res/layout/home_mini_player.xml` | `HomeMiniPlayerBinder` | 首页/主界面底部播放入口参考。 |
| 播放按钮缓冲态 | 主播放按钮和迷你播放器缓冲反馈 | `pm/app/src/main/res/drawable/ic_loading_loop_24.xml` | `PlaybackButtonStateRenderer` | VectorDrawable 只承载图形；Media3 `STATE_BUFFERING` 时由 ObjectAnimator 以 1.5 秒周期持续旋转，销毁时必须释放。 |
| 歌词行 | 普通歌词 RecyclerView 行 | `pm/app/src/main/res/layout/item_lyric_line.xml` | `LyricsAdapter` | 非卡拉 OK View 的普通歌词行。 |
| 卡拉 OK 歌词 View | 逐字歌词渲染 | `pm/app/src/main/java/cn/partialy/pm/ui/player/KaraokeLyricsView.kt` | `LyricDisplayStyle` | 自绘歌词，不要用普通 TextView 代替。 |
| 歌源标签 | KG/WY/KW/CLOUD/LOCAL 标签 | `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt` | `song_tag_*` 颜色资源 | 歌源标识统一从这里绑定；KG/WY/KW/CLOUD 必须分别显示同规格的 16dp 圆角描边方块 `K` / `Y` / `W` / `C`（无额外 padding、居中），KW 使用橙色，Cloud 使用青绿色。LOCAL 保留自适应矩形，禁止调用方单独设置来源文案、背景或 padding。 |

## 状态、错误与 WebView

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 列表空状态 | 播放队列、详情页、列表无数据 | `bottom_sheet_playlist.xml`、`item_playlist_detail_status.xml`、`item_playlist_detail_list_status.xml` | 对应 Activity / Adapter | 空状态文案和可见性处理参考。 |
| 列表加载 / 错误状态 | 歌单详情、列表加载失败 | `item_playlist_detail_status.xml`、`item_playlist_detail_list_status.xml` | `PlaylistDetailActivity` 等 | 加载、重试、错误展示参考。 |
| 通用 WebView 页面 | 协议、隐私、配置 HTML 内容 | `pm/app/src/main/res/layout/activity_web_content.xml` | `activity/web` 相关页面 | WebView 内容承载参考。 |
| 投稿占位页 | 云盘投稿功能未开放时的独立页面 | `activity_cloud_music_submission.xml` | `CloudMusicSubmissionActivity` | 使用 edge-to-edge、返回导航和居中分享图标；只展示标题与准备中说明，不放假表单或禁用提交按钮。 |
| 分享详情页 | App 内打开音乐分享链接或本地查看详情 | `pm/app/src/main/java/cn/partialy/pm/activity/ShareDetailActivity.kt` | `activity_share_detail.xml`、`bg_share_detail_*`、`SongSourceTagBinder`、`ShareBottomSheet` | 歌单来源使用歌曲列表同款 K / Y 标签；本地详情右侧复用分享 Sheet，外链通过 `pisamusic://scan?type=music-share` 唤醒时右侧收藏 KG/WY 歌单。 |
| WebView 本地错误页 | WebView 加载失败兜底 | `pm/app/src/main/java/cn/partialy/pm/ui/web/LocalGenericErrorWebViewController.kt` | `assets/` 内本地错误页面 | WebView 错误兜底优先用这个控制器。 |
| 安全区 / 系统栏适配 | edge-to-edge padding | `pm/app/src/main/java/cn/partialy/pm/ui/insets/SystemBarsExt.kt` | `applySystemBarsInsets` 等扩展 | 新全屏页面先参考。 |
| 扫码页工具层 | 扫码返回、手电筒、相册识别 | `pm/app/src/main/res/layout/zxing_capture.xml` | `PortraitCaptureActivity`、`QrImageDecoder`、`ic_back_24.xml`、`ic_lighting_24.xml`、`ic_image_24.xml` | 保留 `@id/zxing_barcode_scanner` 以兼容 JourneyApps；顶部操作区避让状态栏/刘海，返回按钮与提示文案同一行；底部 25% 居中手电筒、右下角相册按钮使用 AppCompat 矢量图标。 |

## 待补充

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| Toast / 全局消息 | 轻提示、操作结果提示 | 待补充 | 待补充 | 如果已有统一封装，请补充位置。 |
| 骨架屏 / 占位加载 | 列表加载占位 | 待补充 | `bg_skeleton_rounded.xml` | 需要确认真实使用位置。 |
| 顶部标题栏 / 返回栏 | 原生页面顶部导航 | 待补充 | 待补充 | 需要补充最推荐的页面参考。 |
| 图片裁剪 / 头像选择 | 图片选择、头像裁剪 | 待补充 | 待补充 | 需要确认当前推荐实现。 |
## 最近补充

- 本地歌曲扫描页：`pm/app/src/main/res/layout/activity_local_music_scan.xml`，用于扫描歌曲初始页、扫描中、结果列表和底部导入栏；`LocalMusicScanActivity` 复用 edge-to-edge、安全区、Material 主按钮、`PmSwitch` 过滤设置和歌曲结果行。
- 导入与导出卡片：`pm/app/src/main/res/layout/include_data_management_card.xml`，用于数据概览、导出、导入这类带图标、说明、操作按钮和状态提示的设置卡片；`DataManagementActivity` 复用该布局并使用 `PmMinimalDialog` 统一确认弹窗。
- 信息操作头部：`pm/app/src/main/res/layout/include_song_info_header.xml` 用于左侧图片、右侧标题/副标题；`SongInfoHeaderBinder` 绑定歌曲，通用操作菜单也可绑定圆形成员头像和在线状态。
