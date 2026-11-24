# PM 可复用 UI 位置索引

本文件用于记录 `pm/` Android 端已经存在的可复用 UI、布局样式和交互位置。新建页面、弹窗、表单、列表行、按钮、开关、卡片等 UI 前，先在这里查找是否已有同款或近似实现。

## 使用规则

- 先查本文件，再新建 UI。
- 如果已有同款或近似 UI，优先复用对应 layout、drawable、style、Kotlin 封装或交互模式。
- 如果现有 UI 只是视觉相似但业务不同，复用样式和结构，不要强行复用业务绑定逻辑。
- 如果确实没有合适参考，可以新建；新建后把可复用位置补回本文件。
- 地址优先写项目内相对路径；暂时找不到准确位置时写 `待补充`。

## 基础控件

- 轮廓 `TextInputLayout` 统一使用 `@dimen/pm_text_input_corner_radius`（12dp），通过 `Widget.Pm.TextInput.Outlined.Material3` / `.MaterialComponents` 保持原有组件风格与个性化颜色。

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 页面内容左基线 / 顶部前导按钮 | 普通页面外层内容、返回与菜单按钮 | `pm/app/src/main/res/values/dimens.xml`、`pm/app/src/main/res/values/styles.xml` | `pm_page_content_start`、`Widget.Pm.PageLeadingAction`、`ic_back_24.xml`、`ic_menu_24.xml` | 除播放主界面外，可见内容统一从 12dp 开始；返回箭头和三条杠使用 48dp 点击区，矢量已移除左透明画布，实际笔画左缘同样落在 12dp。嵌套列表不得把页面 padding 与 item padding 重复叠加。 |
| 滑动轨道 / 进度条 | 细轨道、小圆点滑块、百分比类调节 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `bg_lyric_settings_seekbar_progress.xml`、`bg_lyric_settings_seekbar_thumb.xml` | 歌词不透明度示例，主题色走 primary。 |
| 开关 Switch | 设置项开关、底部面板开关 | `pm/app/src/main/res/layout/item_settings_switch.xml`、`pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `cn.partialy.pm.ui.widget.PmSwitch`、`Widget.Pm.SettingsSwitch` | 新增原生开关优先用 `PmSwitch`；标准开关本体为 40dp × 24dp。 |
| 数字步进器 | 小范围数字加减，例如字号差值 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `bg_lyric_settings_stepper.xml` | 适合 2-8、12-30 这类小范围配置。 |
| M3 输入框 | 表单输入、房间名、邀请码、登录信息 | `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`、`pm/app/src/main/res/layout/include_playlist_import_kg_login.xml` | `TextInputLayout` / `TextInputEditText` | 表单不要直接裸写普通输入框，优先参考这些 M3 输入框。 |
| 主按钮 / 次按钮 | 提交、创建、加入、保存等动作 | `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`、`pm/app/src/main/res/layout/include_playlist_import_kg_login.xml` | Material Button、现有 drawable 背景 | 优先沿用已有圆角、填充、描边和禁用态做法。 |
| 图标按钮 | 播放页工具、加减、更多、关闭等图标操作 | `pm/app/src/main/res/layout/activity_player.xml`、`pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `ImageButton` + 项目 drawable 图标 | 工具类操作优先图标化，补充 contentDescription。 |
| 分段按钮 | 三选一/少量互斥选项 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `MaterialButtonToggleGroup`、`lyric_settings_segment_*` color selector | 对齐方式示例，选中态使用 primary，不走默认粉紫色。 |

## 弹窗与底部面板

- 通用阻塞加载层使用 `PmLoadingDialog.show(activity, message, timeoutMs)`，返回句柄调用 `dismiss()` 主动关闭，`isShowing` 查询显示状态；参数均可省略，默认文案“正在加载中...”、超时 15 秒（自定义必须大于 0）。全屏半透明黑色遮罩、居中深色卡片，上方 `ic_modal_loading_24` 白色旋转图标、下方提示文案；禁止遮罩和返回关闭。超时关闭后复用 `PmMessage.error` 提示“加载超时”；主动关闭、宿主销毁不报超时，退出前台暂停旋转，关闭时清理动画和计时器。组件只管理 UI，超时不代表业务任务已取消，调用方仍须处理任务取消与过期结果；暂未接入业务。位置：`ui/dialog/PmLoadingDialog.kt`、`res/layout/dialog_pm_loading.xml`、`res/drawable/bg_pm_loading_card.xml`。
- 启动流程使用的升级、网络异常等 `SplashActionBottomSheet` 必须禁止遮罩点击、返回及下滑关闭，通过面板按钮继续、重试或退出；启动错误和协议弹窗同样不可取消，生命周期仍可主动释放。

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 居中确认弹窗 | 简短确认、危险操作确认、提示、启动协议 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PmMinimalDialog.kt` | `pm/app/src/main/res/layout/dialog_pm_minimal.xml` | 普通确认类弹窗优先使用；支持按钮文字颜色、指定宽度和正文最大高度；启动协议使用红色“退出”和蓝色“同意”。背景浅色 `#FFFFFF`、深色 `#2A2D34`，深色边框与按钮分割线使用 `#3D424C`。 |
| 专属消息提示弹窗 | 启动、登录或注册后依次展示的后台专属消息 | `pm/app/src/main/java/cn/partialy/pm/directmessage/DirectMessageDialog.kt` | 复用 `dialog_pm_minimal.xml` 的居中视觉与窗口参数 | 标题固定“提示”，按钮固定“我知道了”；一个 App 进程只共享首次 3 秒倒计时，后续消息直接可点。 |
| 居中自定义内容弹窗 | 表单、列表、封面选择等 slot 内容 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PmSlotDialog.kt` | `pm/app/src/main/res/layout/dialog_pm_slot.xml` | 支持固定 `header slot`、可滚动 `content slot` 和底部按钮三段式；歌曲信息头部等固定内容放 header，中间选项或表单滚动，并复用 `PmMinimalDialog` 的日夜背景、文字和分割线颜色。 |
| 歌单链接导入弹窗 | 从侧栏粘贴分享文案并打开在线歌单 | `ui/dialog/PlaylistLinkImportDialog.kt`、`res/layout/dialog_playlist_link_import.xml` | `PmSlotDialog`、M3 `TextInputLayout` 自定义尾部图标、`ic_paste_24` | 默认不弹键盘、不读剪贴板；手动粘贴替换文本，查询期间显示加载并防重复操作，失败保留输入；支持酷狗 gcid 与网易公开歌单，按主链接识别分享副本并校验详情，成功打开对应平台既有详情页。 |
| 一起听二维码弹窗 | 展示房间二维码、房间号及复制操作 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ListenTogetherQrDialog.kt` | `dialog_listen_together_qr.xml`、`PmSlotDialog` | 二维码统一编码官网 `/scan` 加入链接。 |
| 现代底部弹窗 | 通用底部 Sheet、进度或旧场景 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ModernDialog.kt` | `pm/app/src/main/res/layout/layout_modern_bottom_sheet.xml` | 旧场景保留，新普通确认不要继续扩展它。 |
| 普通 BottomSheet 容器 | 统一圆角底部面板与入出场动画 | `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`、`pm/app/src/main/res/layout/layout_action_menu_bottom_sheet.xml` | `bg_bottom_sheet.xml`、`ThemeOverlay.Pm.BottomSheetDialog`、`PmBottomSheetAnimationStyle`、`pm_bottom_sheet_enter.xml` / `pm_bottom_sheet_exit.xml` | 新增底部面板统一使用 `ThemeOverlay.Pm.BottomSheetDialog`（已在 `Theme.Pm` 配置为默认 `bottomSheetDialogTheme`），入场从底部纯平移滑起（260ms 无回弹）、出场向底部纯平移收起（240ms 无透明度变化）。 |
| 通用操作菜单 | 顶部信息头、图标和文案操作行 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ActionMenuBottomSheet.kt` | `layout_action_menu_bottom_sheet.xml`、`item_action_menu_row.xml` | 动作在 Sheet 关闭后执行；支持普通色和危险色操作。 |
| 底部圆角选项选择器 | 设置、播放音质等单选列表 | `pm/app/src/main/res/layout/layout_bottom_radius_options_sheet.xml` | `SettingsOptionPickerBottomSheet.kt`、`QualityPickerBottomSheet.kt`、`item_settings_option_sheet_row.xml` | 顶部标题、无分割线选项、底部取消/确定按钮；点击选项只暂存，确定后才提交。弹层使用通用 `modal_surface_background`，取消按钮使用 `action_secondary_background` / `action_secondary_text`，确定按钮使用主题 `colorPrimary` / `action_primary_text`；浅色分别为 `#FFFFFF`、`#F5F5F5`、`#4A4A4A`、白字，深色分别为 `#2A2D34`、`#5A595B`、白字、白字。音质禁用项必须复用 `OptionPickerRows` 的 `enabled=false`：不可被选中，标题和选中图标变灰；`badge` 复用右侧主题蓝字、浅蓝圆角底的 `optionBadge`。音质行完整显示当前音源全部选项：游客受限项标“需登录”并通过回调关闭选择器、进入 PisaMusic 登录页，普通系统账号的高级受限项标“联系作者解锁”并通过回调进入已预选“账号相关”的意见反馈页；不要另建样式或把禁用项当作已选音质返回。 |
| 下载音质选择弹窗 | 下载歌曲前选择音质 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt` | `dialog_download_quality_picker.xml`、`include_song_info_header.xml`、`item_settings_option_sheet_row.xml` | 歌曲信息放在 `PmSlotDialog` header slot 固定显示，音质选项放 content slot 滚动，复用通用主题色选项行且无选项分割线；默认选中项不可用时复用首个可用项，确认不得返回禁用项。 |
| 下载配额不足弹窗 | 下载前配额校验不足提示 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SongDownloadQuotaDialog.kt` | `PmMinimalDialog` | 复用单按钮居中弹窗，按受限维度逐行展示日/周/月/总数剩余配额。 |
| 歌曲更多菜单 | 歌曲操作菜单 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SongMoreMenu.kt` | `ActionMenuBottomSheet` | 歌曲业务保留在该入口，外观和操作行复用通用操作菜单。 |
| 音乐分享 Sheet | 歌曲 / 歌单链接与二维码分享 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ShareBottomSheet.kt` | `bottom_sheet_share.xml`、`include_share_info_header.xml`、`ShareQrBitmapFactory` | 顶部封面信息、居中二维码、一起听同款蓝色 M3 链接输入框和复制图标；未登录不创建分享记录。 |
| 歌单操作菜单 | 歌单详情、分享、收藏、删除和在线转本地 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/PlaylistActionBottomSheet.kt` | `ActionMenuBottomSheet`、`ShareBottomSheet`、`ShareDetailActivity`、`PlaylistCoverRequestBinder` | 本地歌单详情右上角与“我的”页本地歌单列表的更多菜单复用同一 Sheet，支持详情/编辑/删除，不显示分享、收藏或转换；本地详情页顶部独立分享按钮也隐藏。KG/WY 仍可分享和转换，封面支持模板、本地文件和远程尺寸回退。 |
| 一起听成员管理菜单 | 房主转让、移出成员 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/ListenTogetherMemberActionMenu.kt` | `ActionMenuBottomSheet`、`PmMinimalDialog` | 仅房主点击其他成员时显示，危险操作使用红色并二次确认。 |
| 收藏歌单更多菜单 | “我的 → 歌单”中的 KG/WY 等非本地歌单 | `pm/app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsTabFragment.kt` | `PlaylistActionBottomSheet`、`PlaylistDeleteConfirmation` | 与歌单详情及本地歌单列表复用统一操作 Sheet；传入当前收藏和管理器，保留详情/分享/收藏状态/删除确认，取消独立 `MinePlaylistMoreBottomSheet` 与 `bottom_sheet_mine_playlist_more.xml`。 |
| 公告底部弹窗 | 首页结构化公告原生内容展示 | `pm/app/src/main/res/layout/layout_announcement_bottom_sheet.xml` | `MainActivity` 中公告弹窗逻辑、`AnnouncementContentRenderer`、`bg_bottom_radius_sheet.xml` | 复用选项 Sheet 的圆角背景和日夜弹层色，隐藏滚动条但保留滑动；正文由 `AnnouncementContentRenderer` 原生渲染（文本、高亮、URL/协议下划线、复制图标与 Coil 图片）；“我知道了”使用次级操作色，“前往”跟随 `colorPrimary`。 |
| 启动页多操作面板 | 启动断网重试、版本更新下载与跳转 | `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SplashActionBottomSheet.kt` | `layout_splash_action_bottom_sheet.xml`、`bg_splash_content_card.xml`、`bg_bottom_radius_sheet.xml` | 参考公告 Sheet 结构，包含主副标题、更新说明卡片及动态排布按钮。按钮数量为 2 时水平 1:1 排列，>=3 时垂直全宽排列；主按钮使用品牌主色并在下载时动态显示进度与防重禁用，次按钮使用中性灰色或弱化底色。 |
| 错误底部弹窗 | 错误详情展示 | `pm/app/src/main/res/layout/layout_error_bottom_sheet.xml` | `ModernDialog` / 相关错误展示逻辑 | 错误详情类底部展示参考。 |

## 设置与表单

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 设置普通行 | 设置页入口、右侧摘要、箭头 | `pm/app/src/main/res/layout/item_settings_row.xml` | `SettingsActivity` | 新增设置入口优先复用。 |
| 设置开关行 | 设置页开关项 | `pm/app/src/main/res/layout/item_settings_switch.xml` | `PmSwitch`、`Widget.Pm.SettingsSwitch` | 不要为设置开关另写一套样式。 |
| 无图标二级设置页 | 播放、下载、歌词、数据等分组设置页 | `pm/app/src/main/res/layout/activity_sub_settings.xml`、`item_sub_settings_*.xml` | `SubSettingsActivity`、`SubSettingsAdapter`、`SubSettingsItem`、`SongSourceTagBinder`、`PlaybackSettingsActivity`、`DownloadSettingsActivity`、`LyricSettingsActivity`、`DataSettingsActivity` | 子页只声明标题、分组和 Option / Navigation / Info / Switch；`Info` 是只读信息行，不显示箭头、不响应点击；`Option` 支持可选 `sourceTag` 在标题右侧复用 `SongSourceTagBinder` 展示 `K` / `Y` 标签；`summary` 可选，有说明时使用较小、较淡的第二行，无说明时保持原单行布局。 |
| 缓存分类卡片 | 设置/工具页统计卡片 | `pm/app/src/main/res/layout/include_cache_category_card.xml` | `CacheManagementActivity` | 有标题、说明、大小、操作按钮。 |
| 登录表单 | 账号/第三方导入登录表单 | `pm/app/src/main/res/layout/activity_login.xml`、`pm/app/src/main/res/layout/include_playlist_import_kg_login.xml` | `LoginActivity`、`WyPlaylistLoginActivity` | 输入框、验证码按钮、扫码占位可参考。 |
| 本地歌单创建表单 | 新建歌单，仅输入名称并与初始歌曲事务保存 | `pm/app/src/main/res/layout/dialog_create_local_playlist.xml` | `LocalPlaylistCreateDialog`、`PmSlotDialog`、`dialog_account_profile_edit_username.xml` | “我的”、单曲和批量添加共用，使用昵称弹窗同款 M3 单行输入；创建时不提供封面选择，支持失败重试与提交防重；封面编辑仍由 `PlaylistEditActivity` 承载。 |
| 账号资料 WebView 容器 | 资料页 WebView 承载 | `pm/app/src/main/res/layout/activity_account_profile.xml` | `AccountProfileActivity` | 全屏 WebView 容器和系统栏处理参考。 |
| 纯文本内容页 | 服务协议、隐私政策正文 | `pm/app/src/main/res/layout/activity_plain_text_content.xml` | `BaseSettingPlainTextActivity`、`SettingServiceAgreementActivity`、`SettingPrivacyPolicyActivity` | 使用原生 `NestedScrollView` + `TextView`，保留后端换行和标题，不解析 HTML。 |
| 故障上报能力卡片 | 本地故障统计和立即上报 | `pm/app/src/main/res/layout/activity_data_management.xml` | `DataManagementActivity`、`FaultReportRepository`、`PmMinimalDialog` | 与导入与导出页其他卡片统一使用圆角卡片、指标磁贴和 TonalButton；无待上报数据时禁用按钮，确认上传复用通用居中弹窗。 |

## 列表、卡片与行项目

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 通用歌曲列表行 | 搜索、歌单详情、收藏、本地/已下载、云盘、首页每日推荐 | `item_song_list.xml` | `SongListItemBinder`、`SongListPlaybackStateObserver`、`PlayingSpectrumView` | 按页面配置收藏/下载/更多按钮；当前歌曲歌名/歌手使用 primary，封面显示三线频谱，播放时跳动、暂停时静止。首页保留横向网格尺寸与骨架态，但内部仍复用本组件。 |
| 特殊歌曲列表行 | 播放器队列、扫描结果列表 | `item_playlist_song.xml`、`item_local_music_scan_result.xml` | 对应 Adapter | 播放器队列保留队列专用结构；扫描结果行使用左侧 `MaterialCheckBox`、中间歌曲信息、右侧“已存在”标记。 |
| 歌单列表行 | 我的歌单、选择歌单、搜索歌单 | `item_mine_playlist_row.xml`、`item_pick_local_playlist_row.xml`、`item_search_playlist.xml` | `MinePlaylistsAdapter`、`SearchPlaylistAdapter` | 封面、标题、副标题、更多按钮参考。 |
| 首页推荐歌单卡片 | 首页横向/网格歌单卡片 | `item_home_recommend_playlist.xml` | `HomeRecommendPlaylistAdapter`、`HomePlaylistGridAdapter` | 首页歌单卡片优先复用。 |
| 首页功能卡片 | 云盘、每日推荐、雷达歌单入口 | `item_home_feature_card.xml` | `HomeFeatureCardsAdapter` | 第一张固定进入云盘共享音乐空间，三张卡片使用无内嵌文字的简约底图并由布局统一叠字；卡片固定 `128dp × 170dp`，横向间距 `10dp`，约露出半张第三卡；外部阴影保持 `1dp`，底部使用 `80dp` 的透明到深色渐变羽化层承载标题/描述；“今日推荐”左上显示动态 `M-d 周X` 日期标签，不得恢复为静态日期。 |
| 首页每日歌曲卡片 | 每日歌曲横向六行网格 | `item_song_list.xml` | `HomeDailySongGridAdapter` | 复用通用歌曲行；Adapter 仅保留 90% 屏宽、72dp 外层高度与骨架动画。 |
| 云盘数据概览与功能专区 | 首页云盘 Hero 指标卡片、三入口卡片与最近更新预览 | `fragment_cloud_music.xml`、`bg_cloud_music_entry_card.xml`、`bg_cloud_music_summary.xml`、`bg_cloud_music_icon_history.xml` | `CloudMusicFragment` | 包含共享音乐空间 Hero 卡片（3指标：歌曲总数、我的贡献、最近更新）、功能专区（搜索云盘、我要投稿双列卡片 + 投稿记录全宽卡片）、最近更新预览（前 3 首）。 |
| 云盘独立搜索页 | 云盘全局检索与全量分页浏览 | `CloudMusicSearchActivity`、`activity_loved_songs_search.xml` | `CloudMusicSearchActivity`、`CloudMusicListAdapter` | 复用收藏搜索同款布局，默认展示全部云盘歌曲支持滑动分页加载，输入关键词实时防抖检索。 |
| 搜索建议 / 热搜项 | 搜索页建议和热搜 | `item_search_suggestion.xml`、`item_hot_search.xml`、`item_search_recommend.xml` | `SuggestionsAdapter`、`HotSearchAdapter`、`SearchViewModel.suggestionJob` | 提示词随输入立即请求，新输入必须取消旧 Retrofit 请求并清空旧提示；热搜继续复用现有列表项。 |
| 搜索音源选择器 | 搜索页当前音源与下拉选项 | `activity_search.xml`、`layout_search_source_dropdown.xml`、`item_search_source_option.xml` | `SearchActivity`、`SongSourceTagBinder` | 当前项和弹出选项只显示 K / Y / W 方块标签，当前弹出项右侧显示勾选；不展示“小蓝 / 小红 / 小黄”平台别名。 |
| 封面缩略图 | 封面选择、歌单封面列表 | `item_dialog_local_cover_thumb.xml` | `CreateLocalPlaylistCoverPickerAdapter` | 封面选择网格参考。 |
| 我的页面入口行 | 我的页收藏、本地、下载管理、设置和自建歌单入口 | `item_mine_favorites_row.xml`、`item_mine_local_music_row.xml`、`item_mine_cover_title_row.xml`、`item_mine_local_playlist_section_header.xml`、`item_mine_playlist_empty.xml` | `MineMyOverviewAdapter`、`MineMyTabFragment` | “下载管理”固定放在“我的音乐”下方、“设置”上方；固定入口和分组头由 Overview Adapter 承载；本地歌单分组头左侧为批量管理入口（`ic_list_check_24`，进入 `LocalPlaylistManagementActivity`），右侧保留新建入口；自建歌单行通过 ConcatAdapter 接在后面；页面级 RecyclerView 保持回收，Mine 根层固定 Header Overlay，AppBar 只负责头像折叠与 Tab 吸顶。 |
| 下载管理页 | 查看、搜索和批量删除下载任务 | `activity_download_management.xml`、`item_download_task.xml` | `DownloadManagementActivity`、`DownloadTaskAdapter` | 复用本地音乐的双文本 Tab 和本地歌单管理页的搜索/多选/底部操作栏；分为“下载中 / 已完成”，删除确认复用 `dialog_local_music_delete_confirm.xml`，可选择一并删除已记录的音频与歌词文件。 |
| 本地歌单批量管理页 | 搜索、选择及批量删除本地歌单 | `activity_local_playlist_management.xml`、`item_local_playlist_management.xml` | `LocalPlaylistManagementActivity`、`LocalPlaylistManagementAdapter` | 只读取 `CollectedPlaylistType.LOCAL`；筛选、全选和反选基于完整快照，界面先显示 40 条并在临近末尾追加，删除确认复用 `PlaylistDeleteConfirmation`，列表状态以 `playlistsFlow` 为权威。 |
| 本地歌单歌曲批量管理页 | 搜索、选择及批量删除指定歌单歌曲 | `activity_local_playlist_song_management.xml`、`item_local_playlist_song_management.xml` | `LocalPlaylistSongManagementActivity`、`LocalPlaylistSongManagementAdapter` | 对齐歌单批量管理视觉与交互；只读取目标本地歌单歌曲；支持防抖搜索、40 条窗口滑动分页、全选与反选；删除确认复用 `PmMinimalDialog` 危险色弹窗，删除后以 `playlistsFlow` 与数据库快照同步状态。 |
| 我的收藏歌曲批量管理页 | 搜索、选择及批量取消收藏歌曲 | `activity_local_playlist_song_management.xml`、`item_local_playlist_song_management.xml` | `LovedSongsManagementActivity`、`LocalPlaylistSongManagementAdapter` | 复用歌曲批量管理布局与 Adapter；只读取我的收藏歌曲；支持防抖搜索、40 条窗口滑动分页、全选与反选；操作按钮与弹窗为取消收藏，删除确认复用 `PmMinimalDialog`，状态通过 `LoveManager.loveListFlow` 同步。 |
| 主界面侧拉栏账号头与功能卡 | 系统账号、设置/扫码、三方账号管理、链接导入和定时关闭 | `main_drawer_content.xml` | `MainActivity`、`ThirdPartyAccountsRepository`、`SongSourceTagBinder` | 顶部系统账号保留；三方账号改为“导入歌单 + K/Y 标签 + >”单行入口，标签只有已校验有效时亮起，其余灰色；点击整行进入三方账号管理，导入按钮位于管理页底部。 |
| 定时关闭 Sheet | 四档快捷时长、自定义时长、完整歌曲开关、剩余时间、更新与取消 | `bottom_sheet_sleep_timer.xml`、`bg_bottom_radius_sheet.xml`、`bg_lyric_settings_stepper.xml` | `SleepTimerBottomSheet`、`SleepTimerManager`、`SleepTimerRules`、`MusicController.setSongEndedInterceptor` | 复用通用 Material BottomSheet、`PmSwitch` 和歌词设置步进器样式；快捷区不显示标题，四档使用等距 60dp 圆形双行按钮，上方为数字、下方为 `min`。未选中为透明背景、中性色圆边框和文本，选中为淡 primary 背景、primary 边框和文本。默认四档为 5/15/30/60 分钟，可在“播放设置 → 定时配置”修改；“自定义”范围 1～1439 分钟。完整歌曲开关只显示标题，倒计时结束转入等待态，并在自然播放完成时同步拦截自动续播后暂停。 |
| 定时快捷配置 Sheet | 修改定时关闭的四个快捷档位 | `bottom_sheet_sleep_timer_presets.xml` | `SleepTimerPresetSettingsBottomSheet`、`PlaybackSettingsActivity`、`SleepTimerManager.presets` | 位于“设置 → 播放设置 → 定时配置”，四个 Material 数字输入分别对应 Sheet 的四个圆形按钮，范围均为 1～1439 分钟，保存后播放设置摘要立即刷新。 |
| 我的页 VIP 到期标签 | 有效系统 VIP 的到期时间 | `fragment_mine.xml`、`bg_mine_vip_expiry_tag.xml` | `MineFragment.applyMineProfileTexts`、`AccountSessionStore` | 位于邮箱下方，复用音源标签的细边框、浅底、同色字视觉但使用金色；仅有效 VIP 显示，画面只显示本地时区 `yyyy-M-d HH:mm:ss` 时间。 |

## 播放相关

- 歌单与收藏独立搜索页的 52dp 播放栏使用不透明矩形 `bg_playlist_search_play_all.xml`，无分割线，0 首不播放；详情页原有折叠工具条不变。
- 定时关闭自定义时间使用一起听同款双卡片和圆形加减按钮，小时/分钟可编辑，1～1439 分钟归一化；底部按钮上方显示预计停播时间。

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 播放队列 BottomSheet | 当前播放列表、清空、队列空状态 | `pm/app/src/main/res/layout/bottom_sheet_playlist.xml` | `PlayerActivity`、`PlaylistAdapter` | 播放队列面板参考。 |
| 歌单详情推拉门折叠工具条 / 搜索栏 | 四类歌单共用大封面 Header、双按钮、顶栏三动作及 52dp 折叠工具条 | `pm/app/src/main/res/layout/activity_playlist_detail.xml`、`item_playlist_detail_header.xml`、`playlist_detail_sticky_play_all.xml` | `ui/playlistdetail/PlaylistDetailHeaderController`、`PlaylistDetailContentAdapter`、`PlaylistDetailInteractionController`、`ui/collapsing/CollapsingHeaderPolicy`、`bg_playlist_detail_hero_top_scrim.xml`、`bg_playlist_detail_hero_bottom_fade.xml` | 与“我的”页同构：全宽封面信息区位于 `CollapsingToolbarLayout` 的 parallax 层，顶部 Header 按相同 200dp进度渐显，唯一 52dp 圆角工具条作为 AppBar 固定子项随内容上移，两者最终在封面前闭合；顶栏固定搜索/分享/更多（标题最多 1 行尾部省略），工具条左侧为播放图标 + 13sp 曲目数，右侧排序按钮打开默认/歌名 A-Z/歌手 A-Z 选项 Sheet。不得加入 RecyclerView Header、Anchor 手动位移或双工具条切换。 |
| 歌单列表底部状态 / 增量加载指示器 | 歌单详情流式拉取剩余歌曲底部加载指示器与到底提示 | `pm/app/src/main/res/layout/item_playlist_detail_status.xml` | `PlaylistDetailContentAdapter.StatusViewHolder`、`CircularProgressIndicator` | 包含 18dp 旋转 `CircularProgressIndicator` 与 14sp 次级文字；流式加载中显示指示器与“正在加载剩余歌曲…”，全部完成或无更多时隐藏指示器并显示“已经到底了~”，初始与空搜状态自适应居中。 |
| 收藏独立搜索页 | 从“我的收藏”右上角进入，实时过滤收藏歌曲 | `pm/app/src/main/res/layout/activity_loved_songs_search.xml` | `LovedSongsSearchActivity`、`PlaylistDetailContentAdapter`、`HomeMiniPlayerBinder` | 查询为空时保留搜索栏与迷你播放器；按歌名/歌手过滤展示，播放仍使用完整收藏列表并按 `type + id` 定位。 |
| 歌单收藏独立搜索页 | 从“歌单收藏”右上角三点菜单的“搜索”进入，实时过滤收藏歌单 | `pm/app/src/main/res/layout/activity_favorite_playlists_search.xml` | `FavoritePlaylistsSearchActivity`、`HomePlaylistGridAdapter`、`HomeMiniPlayerBinder` | 无播放全部工具条；按歌单名称过滤展示 3 列卡片网格，点击跳转对应平台歌单详情。 |
| 歌词设置面板 | 四分区设置、固定预览、滑轨、分段按钮、长按步进器 | `pm/app/src/main/res/layout/bottom_sheet_lyric_settings.xml` | `LyricSettingsSheet`、`LyricSettingsStepper`、`LyricSettingsSheetWindow` | 与一起听 Sheet 一致：左右/顶部 16dp、标题高 40dp、首内容/分区间距 12dp、底部 16dp、卡片左右内边距 12dp、步进按钮 30dp；复用原背景/卡片，固定头部与预览，下方独立滚动，最大约 80% 可用窗口，IME 或小窗口不足时收起并暂停预览；预览测量按最新 16dp 外边距计算。 |
| 迷你播放器 | 底部迷你播放器 | `pm/app/src/main/res/layout/home_mini_player.xml` | `HomeMiniPlayerBinder` | 首页/主界面底部播放入口参考。 |
| 播放按钮缓冲态 | 主播放按钮和迷你播放器缓冲反馈 | `pm/app/src/main/res/drawable/ic_loading_loop_24.xml` | `PlaybackButtonStateRenderer` | VectorDrawable 只承载图形；Media3 `STATE_BUFFERING` 时由 ObjectAnimator 以 1.5 秒周期持续旋转，销毁时必须释放。 |
| 动态歌词背景 | 单 Canvas 封面色板光场与静态模糊回退 | `ui/player/background/FlowingCoverBackgroundView.kt`、`PlayerBackgroundController.kt` | `PlayerFlowBackgroundConfig`、`SettingsPrefs` | 动态完全隐藏模糊纹理；1250ms 色板插值保留运动相位，30/15fps 与系统禁动画/生命周期降级。 |
| 动态背景设置 Sheet | 歌词样式同款细滑轨、三段色彩模式、独立预览与草稿保存 | `bottom_sheet_dynamic_background_settings.xml` | `DynamicBackgroundSettingsSheet`、同一背景 Controller | 默认/自定义摘要；标题右侧 refresh 图标仅重置草稿；复用歌词不透明度 SeekBar drawable 和三段选择颜色，16dp 外边距、12dp 分组卡片内边距、圆角预览；固定取消/保存区，`DynamicBackgroundSettingsWindow` 根据安全窗口分配列表高度，小窗口先隐藏预览；取消丢弃、保存原子写入、关闭释放 15fps 预览，无曲使用默认色板。 |
| 双页播放器 | 中央封面/歌词横向切页与顶部分页指示器 | `player_page_cover.xml`、`player_page_lyrics.xml` | `PlayerPagesController`、`PlayerPagesAdapter`、`PlayerPageIndicatorView` | 固定两页与单一状态来源，现有控制栏不参与切页；两页歌名/歌手紧接 headerBar，均在一起听时隐藏并保留标题槽；胶囊坐标不变。 |
| 深浅色通用兜底封面 | 歌曲/歌单缺图、初始占位与加载失败 | `drawable-nodpi/default_music_cover.webp`、`drawable-night-nodpi/default_music_cover.webp` | `SongListItemBinder`、`PlaylistCoverRequestBinder`、`MinePlaylistCoverResolver` | 同一个资源 ID 按 App 深浅色显示草地白天/窗台黑夜披萨；仅展示兜底，不写入元数据，不替换已选模板、收藏特色图或品牌头像。 |
| 封面 CD 与紧凑歌词 | 左侧半圆缺口封面、右侧半露 CD、三句单行歌词 | `PlayerCoverStageLayout`、`PlayerCoverNotchEdge`、`CompactDiscView`、`CompactDiscRenderer`、`CompactLyricsView` | `SongCoverRequestBinder`、`CoverFlowPaletteExtractor`、`SongCoverUrl`、`SongSourceTagBinder`、`CompactLyricRules` | 加载新图期间保留旧封面/CD，候选全部失败才用主题兜底；CD 共用背景原始主色采样，外圈淡亮色、约 20 道较宽同心纹，整盘旋转。缺口为黑点 1.125 倍；切歌 1 秒合拢、1 秒停留、1 秒展开，连续切歌合并；隐藏/离开取消复位，遵循系统禁动画。 |
| 完整歌词渐隐与方向仲裁 | 普通/逐字歌词透明边缘与纵向浏览 | `LyricsFadeLayout`、`PlayerLyricsRecyclerView`、`KaraokeLyricsView` | `PlayerSwipeDirectionPolicy` | 中央横向交给 Pager，纵向保留浏览/中线 Seek/三秒恢复；多指重置本次方向，系统边缘返回优先。 |
| 歌词行 | 普通歌词 RecyclerView 行 | `pm/app/src/main/res/layout/item_lyric_line.xml` | `LyricsAdapter` | 非卡拉 OK View 的普通歌词行。 |
| 卡拉 OK 歌词 View | 逐字歌词渲染 | `pm/app/src/main/java/cn/partialy/pm/ui/player/KaraokeLyricsView.kt` | `LyricDisplayStyle` | 自绘歌词，不要用普通 TextView 代替。 |
| 歌源标签 | KG/WY/KW/CLOUD/LOCAL 标签 | `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt` | `song_tag_*` 颜色资源 | 歌源标识统一从这里绑定；KG/WY/KW/CLOUD 必须分别显示同规格的 16dp 圆角描边方块 `K` / `Y` / `W` / `C`（无额外 padding、居中），KW 使用橙色，Cloud 使用青绿色。LOCAL 保留自适应矩形，禁止调用方单独设置来源文案、背景或 padding。 |

## 状态、错误与 WebView

- `PmMessageHost` 胶囊中心位于窗口安全区域顶部起 33%，单曲下载与新建歌单分别显示业务成功消息；新建本地歌单成功提示必须在弹窗关闭后发出，且不重复通用计数提示。

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| 列表空状态 | 播放队列、详情页、列表无数据 | `bottom_sheet_playlist.xml`、`item_playlist_detail_status.xml`、`item_playlist_detail_list_status.xml` | 对应 Activity / Adapter | 空状态文案和可见性处理参考。 |
| 列表加载 / 错误状态 | 歌单详情、列表加载失败 | `item_playlist_detail_status.xml`、`item_playlist_detail_list_status.xml` | `PlaylistDetailActivity` 等 | 加载、重试、错误展示参考。 |
| 通用 WebView 页面 | 联系我们、配置 HTML 内容等仍需网页承载的页面 | `pm/app/src/main/res/layout/activity_web_content.xml` | `activity/web` 相关页面 | 服务协议和隐私政策不再使用此容器。 |
| 云盘投稿中心 | 云盘投稿、投稿记录与重新提审统一页面 | `activity_cloud_music_submission.xml`、`include_cloud_music_submission_editor.xml`、`item_cloud_music_submission_history.xml`、`dialog_image_preview.xml` | `CloudMusicSubmissionActivity`、`CloudMusicSubmissionViewModel`、`CloudMusicSubmissionHistoryAdapter` | 使用 edge-to-edge 与顶部 HeaderBar 标签切换“我要投稿 / 投稿记录”；采用反馈同款虚线上传框、选中即时图片/卡片预览展示、全屏大图预览与一键清除，支持系统文件选择、URI 流式直传、元数据编辑确认、审核进度历史列表与驳回/待审状态下的重新提审。 |
| 分享详情页 | App 内打开音乐分享链接或本地查看详情 | `pm/app/src/main/java/cn/partialy/pm/activity/ShareDetailActivity.kt` | `activity_share_detail.xml`、`bg_share_detail_*`、`SongSourceTagBinder`、`ShareBottomSheet` | 歌单来源使用歌曲列表同款 K / Y 标签；本地详情右侧复用分享 Sheet，外链通过 `pisamusic://scan?type=music-share` 唤醒时右侧收藏 KG/WY 歌单。 |
| WebView 本地错误页 | WebView 加载失败兜底 | `pm/app/src/main/java/cn/partialy/pm/ui/web/LocalGenericErrorWebViewController.kt` | `assets/` 内本地错误页面 | WebView 错误兜底优先用这个控制器。 |
| 安全区 / 系统栏适配 | edge-to-edge padding | `pm/app/src/main/java/cn/partialy/pm/ui/insets/SystemBarsExt.kt` | `applySystemBarsInsets` 等扩展 | 新全屏页面先参考。 |
| 扫码页工具层 | 扫码返回、手电筒、相册识别 | `pm/app/src/main/res/layout/zxing_capture.xml` | `PortraitCaptureActivity`、`QrImageDecoder`、`ic_back_24.xml`、`ic_lighting_24.xml`、`ic_image_24.xml` | 保留 `@id/zxing_barcode_scanner` 以兼容 JourneyApps；顶部操作区避让状态栏/刘海，返回按钮与提示文案同一行；底部 25% 居中手电筒、右下角相册按钮使用 AppCompat 矢量图标。 |

## 待补充

| UI 类型 | 用途 | 优先参考位置 | 相关封装 / 样式 | 备注 |
| --- | --- | --- | --- | --- |
| PmMessage / 全局消息 | 原生四态轻提示、操作结果 | `ui/message/PmMessage.kt`、`PmMessageFlow.kt` | `bg_capsule_message.xml`、`ic_msg_{info,success,warning,error}_24.xml` | Activity/Fragment 入口；Dialog show 后 register；居中、三行、点击透传、优先级与 800ms 去重；成功关闭/导航使用 Flow 等待 800ms。 |
| 骨架屏 / 占位加载 | 列表加载占位 | 待补充 | `bg_skeleton_rounded.xml` | 需要确认真实使用位置。 |
| 顶部标题栏 / 返回栏 | 原生页面顶部导航 | `activity_search.xml`、`activity_playlist_detail.xml`、`activity_settings.xml` | `Widget.Pm.PageLeadingAction`、`ic_back_24.xml`、`pm_page_content_start` | 自定义顶栏使用 48dp 公共前导按钮；MaterialToolbar 使用同一无左透明画布返回矢量，实际箭头笔画对齐 12dp。 |
| 图片裁剪 / 头像选择 | 图片选择、头像裁剪 | 待补充 | 待补充 | 需要确认当前推荐实现。 |
## 最近补充

- 本地歌单编辑页：`activity_playlist_edit.xml`、`PlaylistEditActivity`、`ui/playlistedit/`；复用详情渐变背景及进入动画、一起听 Outlined 输入框颜色、`CreateLocalPlaylistCoverPickerAdapter` 与 `PmMinimalDialog`。首行封面在左，自适应宽“更换封面”药丸按钮在右上方，下方依次为两行名称、三行描述与全宽保存按钮；输入框统一 12dp 圆角，字数统计使用主题淡色。保存中旋转图标加文案，禁用操作，返回提示放弃草稿。`styles_playlist_edit.xml` 提供 M3 输入框与封面圆角。

- App 分享 Sheet：`ui/dialog/AppShareBottomSheet.kt`、`res/layout/bottom_sheet_app_share.xml`，从设置“关于”下方进入；复用 `include_share_info_header.xml`、`ShareQrBitmapFactory`、Material3 BottomSheet、Coil 与 PmMessage。图标/名称/版本、带白边黑白二维码、描述与“复制链接 / 更多”双圆形操作；`bg_app_share_action.xml` 使用主题蓝图标和亮暗自适应灰底，远程图失败回退 `ic_pm_icon`。独立 AppShareRepository 提供按设备/账号隔离的专属缓存与刷新，不复用音乐分享 Sheet；二维码区复用 Material CircularProgressIndicator，首次加载禁用复制/更多，失败显示重试按钮，只有网络不可达才保留同身份离线码。

- 本地歌曲扫描页：`pm/app/src/main/res/layout/activity_local_music_scan.xml`，用于扫描歌曲初始页、扫描中、结果列表和底部导入栏；`LocalMusicScanActivity` 复用 edge-to-edge、安全区、Material 主按钮、`PmSwitch` 过滤设置和歌曲结果行。
- 导入与导出页面：`pm/app/src/main/res/layout/activity_data_management.xml`，保留本地数据指标磁贴；歌单与收藏、播放日志采用图标加标题左侧、操作按钮右侧的左右布局，歌单与收藏的“导入 / 导出”按钮保持同款；页面不展示额外说明文案，仍保留播放日志档位选择及清空确认；故障上报以同款卡片承载统计指标、上报按钮和必要时间信息；四张卡片使用统一的圆角、描边和内边距，前三张标题左侧使用 `data_icon_local.webp`、`data_icon_playlist.webp`、`data_icon_diagnostics.webp` 渐变图标；`DataManagementActivity` 复用 edge-to-edge、安全区、`showSettingsOptionPicker` 及 `PmMinimalDialog` 统一确认弹窗。
- 收藏与同步页面：`pm/app/src/main/res/layout/activity_favorites_sync_settings.xml`，采用账号卡片（圆形头像、昵称、VIP标识、未登录引导）、4 栏同步数据概览磁贴与同步状态控制卡片；`FavoritesSyncSettingsActivity` 复用 edge-to-edge、安全区及 Material 3 圆角卡片规范。
- 信息操作头部：`pm/app/src/main/res/layout/include_song_info_header.xml` 用于左侧图片、右侧标题/副标题；`SongInfoHeaderBinder` 绑定歌曲，通用操作菜单也可绑定圆形成员头像和在线状态。

## 在线歌单批量操作

| UI 类型 | 用途 | 参考位置 | 规则 |
| --- | --- | --- | --- |
| 在线歌单多选页 | KG/WY 歌曲搜索、多选、下载、收藏与添加到 | `activity/OnlinePlaylistBatchActivity.kt`、`res/layout/activity_online_playlist_batch.xml` | 复用 `LocalPlaylistSongManagementAdapter`；底部全选、反选、操作三项；操作菜单复用 `ActionMenuBottomSheet`；未完整加载时禁用全量全选，缺页显示重试；搜索外勾选保留。 |
| 三方歌单可选导入页 | KG/WY 候选歌单缓存、筛选、多选与增量导入 | `activity/ThirdPartyPlaylistImportActivity.kt`、`ui/mine/ThirdPartyPlaylistImportAdapter.kt`、`ui/mine/ThirdPartyPlaylistImportRules.kt`、`res/layout/activity_third_party_playlist_import.xml`、`res/layout/item_third_party_playlist_import.xml`、`res/layout/item_third_party_source_option.xml` | 顶栏展示返回、`已选择 n/x 个` 与刷新按钮；搜索与药丸来源筛选（全部/KG/WY，复用 `layout_search_source_dropdown.xml`）同行排列；底部固定全选、反选、导入三项；已导入项置标禁用且禁止重复勾选。 |
| 添加到目标选择器 | 单曲或批量添加到队列、已有或新建自建歌单 | `ui/dialog/AddToPlaylistBottomSheet.kt`、`res/layout/item_pick_local_playlist_row.xml` | 共用目标行、封面与队列计数；超过 100 首确认；返回实际新增、已存在与失败结果。 |
| 在线转本地确认与进度 | 完整抓取 KG/WY 歌单并事务创建本地副本 | `ui/playlistdetail/OnlinePlaylistToLocalCoordinator.kt`、`OnlinePlaylistToLocalViewModel.kt` | 复用 `PmMinimalDialog` 与 Material 加载指示器；加载可取消、保存不可取消；ViewModel 保留旋转会话，成功只跳转一次。 |
| 高清 Hero 封面 | 在线歌单详情大封面 | `ui/playlistdetail/PlaylistHeroCoverUrl.kt`、`PlaylistDetailHeaderController.kt` | 歌曲更多/分享详情与歌单详情统一优先 1024，失败按 720/480/240/原 URL 降级，再用既有占位；KG 解析模板及已知固定尺寸目录，WY 解析真实 query 尺寸并保留编码参数/fragment；列表缩略图独立取用。 |

- 歌词样式实时预览：`include_lyric_settings_preview.xml`、`bg_lyric_settings_preview.xml`、`ui/player/LyricPreviewController.kt` 与 `LyricPreviewSamples.kt`；8 秒原创三行无声样本，复用普通/逐字渲染器，透明覆盖阻断歌词触摸，样式变化保留时间轴；隐藏暂停、关闭释放、系统禁动画静态展示。预览基准 96dp、圆角 12dp，大字号按换行高度扩展。

## 下载管理双页（2026-11-07）

- `DownloadManagementActivity` + `DownloadTaskPageFragment` + `DownloadManagementViewModel`：下载中/已完成两个 ViewPager2 页面；已完成独立搜索，过滤外选择保留，长按进入编辑并选中，编辑锁页，返回优先退出编辑。
- `DownloadTaskAdapter`、`item_download_task.xml`、`DownloadProgressBackgroundDrawable`：40dp封面紧凑双行、标准音源/音质与单一优先级状态标签、局部进度更新、LOCAL当前歌曲频谱；进度高光仅页面可见且附着/传输中运行，遵循系统禁动画。
- `DownloadTaskRecyclerView` 只在列表内仲裁横纵方向，边缘触摸不交给Pager；更多菜单复用原紧凑菜单布局，无对象操作禁用。

- 下载终态动作统一使用 `DownloadTaskActionMenu`，详情使用 `DownloadTaskDetailDialog` 的 PmSlot 固定歌曲头与可滚动字段，歌名/歌手/专辑/路径整行复制；Android13+采用系统剪贴板反馈。`DownloadTaskFileReader` 在 IO 与共同文件锁内读取单文件标签/封面/时长，仅生成LOCAL快照，不导入本地库。已完成可读音频调用 MusicController.play 保留原队列；一起听时拒绝本地播放。
- `DeleteDownloadTasksUseCase` 统一单条/多选/全终态清除的去重大小预览与结果汇总；确认瞬间抓取ID，默认仅删记录，unfinished任务等待停止并同步清专属临时文件。文件删除在仓库canonical路径锁内按实体分组，保护当前LOCAL（含暂停）和未选共享引用，校验sidecar边界，失败保留记录。PROCESSING删除先等待完成及metadata回调，避免跳过后状态失真。


## 下载管理双页 UI 增量索引（2026-11-07）

| 组件 | 场景 | Kotlin 入口 | 布局 / 资源 | 使用约束 |
| --- | --- | --- | --- | --- |
| 下载管理双页 | 下载中/已完成横滑、Tab、搜索、长按多选 | `activity/DownloadManagementActivity.kt`、`ui/download/DownloadTaskPageFragment.kt`、`DownloadManagementViewModel.kt` | `activity_download_management.xml`、`fragment_download_task_page.xml` | 下载中不展示搜索；编辑锁定 ViewPager2；已完成搜索与滚动状态独立保持。 |
| 下载任务紧凑歌曲行 | 下载中进度、已完成状态与操作 | `ui/download/DownloadTaskAdapter.kt`、`DownloadProgressBackgroundDrawable.kt`、`DownloadStatusTagBinder.kt`、`DownloadQualityLabelFormatter.kt` | `item_download_task.xml` | 复用 `SongSourceTagBinder`；原始音质 key 禁止展示；行中暂停/恢复、尾部 X 取消确认、终态尾部更多，动画离屏/暂停停帧。 |
| 下载任务操作与详情 | 播放、修复信息、详情、重新下载、删除 | `ui/download/DownloadTaskActionMenu.kt`、`DownloadTaskDetailDialog.kt`、`DownloadTaskFileReader.kt` | `ActionMenuBottomSheet`、`PmSlotDialog` | 详情歌名、歌手、专辑、路径整行可点击复制；实际音频信息优先异步读取；本地播放插入当前队列，不整体替换。 |
| 下载任务批量删除 | 选择全部、反选、清除全部与删除磁盘文件 | `download/task/DeleteDownloadTasksUseCase.kt`、`DownloadTaskRepository.kt` | `dialog_local_music_delete_confirm.xml`、`PmSlotDialog` | 默认只删除记录；物理文件删除须检查占用、共享引用、路径与文件删除错误；清除全部不受搜索限制。 |

- LOCAL绝对文件的单曲异步准备使用 `DownloadFileLocks.reserveForPlayback` / `DownloadPlaybackReservations.Handle`：创建MediaItem前在共同canonical锁内验证文件并持有预留，直到currentSong发布或失败/取消finally释放；删除在同锁内同时检查短期预留与currentSong，content://导入路径维持原流程。预留句柄跨挂起但不跨挂起持有监视器。仅清记录也清理FAILED/CANCELLED遗留专属part/stage（共享/非法路径保留，失败保留记录），不触碰正式音频/歌词索引。

## 歌单批量操作统一与长按预选（2026-11-10）

| 组件/能力 | 职责 | 主要位置 | 复用约束 |
|---|---|---|---|
| 歌单歌曲行长按 | 四种歌单详情长按进入批量页并选中 | `ui/widget/SongListItemBinder.kt`、`ui/playlistdetail/PlaylistDetailContentAdapter.kt`、`BatchLongPressGuard.kt` | 回调可选；只作用于歌曲行主体， RecyclerView 复用时重设监听 |
| 统一批量操作菜单 | 收藏/本地删除、下载、添加到；在线下载、收藏、添加到 | `ui/mine/PlaylistBatchActionCoordinator.kt`、`ui/dialog/ActionMenuBottomSheet.kt` | 操作 Sheet 关闭后执行，危险操作单独确认；按实际结果解除勾选 |
| 混合音源批量下载 | LOCAL/不可播放过滤、分源选音质、汇总入队结果 | `ui/mine/PlaylistBatchDownloadPlanner.kt`、`activity/base/BaseDownloadActivity.kt` | 按源匹配音质；整体超过 100 首有效项先确认；退出取消后续弹窗，不取消已入队任务 |
| 添加到目标选择 | 当前队列、已有歌单、新建歌单，排除当前本地歌单 | `ui/dialog/AddToPlaylistBottomSheet.kt` | `excludeLocalPlaylistId` 可选且默认不排除；必须保留其他入口 |

## 本地歌曲编辑与长按（2026-11-12）

| 组件/能力 | 主要位置 | 使用约束 |
|---|---|---|
| 本地歌曲长按编辑 | `LocalMusicFragment`、`LocalMusicAdapter`、`LocalMusicActivity` | 复用 `SongListItemBinder.onLongClick` 和 `BatchLongPressGuard`，只在本地歌曲 Tab 开启；进入现有编辑页并选中、定位该歌曲，不触发播放。已下载 Tab 的更多菜单转到下载管理。 |
| 本地歌曲多选 | `LocalMusicEditActivity`、`LocalMusicEditAdapter`、`activity_local_music_edit.xml` | 底栏为全选/反选/删除；选择使用索引 `recordId`，长按播放 ID 在权威列表加载后映射。全选/反选作用于完整搜索结果，保留筛选外选择；搜索、选择、滚动位置支持重建恢复；删除确认默认仅移除索引。 |


## 账号未关联数据导入（2026-11-14）

- `ui/dialog/UnassociatedLibraryImportPrompt` 复用 `PmMinimalDialog`，登录/注册完成与 `FavoritesSyncSettingsActivity` 的“导入本机未关联数据”共用确认；明确说明新建账号歌单副本、保留本机原件，取消不合并。确认受账号与 generation 守卫，页面销毁关闭等待，不使用通用加载框。LOCAL 异机占位复用 `SongListItemBinder` 灰态与“当前设备无文件”，更多/移除入口仍可用。

## 主歌词特效与参数设置（2026-11-19）

- 歌词特效专属参数 Sheet：`ui/player/lyricstyle/LyricStyleParamsBottomSheet.kt`、`res/layout/bottom_sheet_lyric_style_params.xml`；复用 `bg_lyric_settings_sheet`、顶部 `include_lyric_settings_preview` 实时预览、右上 `ic_refresh_24` 恢复当前样式默认按钮、`bg_listen_together_create_card` 分组卡片、`PmSwitch`、`bg_lyric_settings_seekbar_*` 细滑轨及圆形预设色板行；由 `LyricSettingsSheet` 显示设置区「样式参数」入口弹出（默认样式隐藏），「歌词样式」与「渲染帧率」复用 `showSettingsOptionPicker`（音质同款 Sheet）。
- 主歌词特效引擎：`ui/player/lyricstyle/` 下的 `KaraokeLyricLayoutEngine`、`KaraokeBrowseController`、`LyricFrameRateLimiter` 与 7 款独立 `LyricEffectRenderer`，由 `KaraokeLyricsView` 组合驱动；配置通过 `utils/localdata/AppConfigStore` 写入 SQLite `app_config` 表。
- 原生歌词颜色管理与通用取色器：`activity/LyricColorPresetsActivity.kt`（`activity_lyric_color_presets.xml`、`item_lyric_color_group.xml`、`item_lyric_color_pill.xml`、`bg_lyric_color_pill.xml`），全屏 Edge-to-Edge 复用 `@drawable/bg_account_login_gradient`，按分组展示 3 列圆角胶囊色板（左圆形色块、中间 Hex 文本、编辑态显示右侧删除按钮；默认隐藏删除图标，支持右上角三点菜单选择「编辑 / 重置」或长按任意色板进入编辑态），分组右侧「+ 添加」；颜色编辑/新增统一弹出通用原生 `ui/dialog/ColorPickerBottomSheet.kt`（`bottom_sheet_color_picker.xml` + `ui/widget/colorpicker/SatValPaletteView.kt` + `CheckerboardDrawable.kt`，色块下方居中展示 `RGBA(r, g, b, a)`）。

## 收藏歌单批量管理（2026-11-24）

- `PlaylistManagementActivity` / `PlaylistManagementViewModel`：歌单 Tab 顶部固定搜索行的管理入口及长按初选定位；新布局 `activity_playlist_management.xml` 参考导入页但无刷新，行复用 `item_third_party_playlist_import.xml`。
- `PlaylistSourceFilterPopup`：三方导入和收藏管理共用来源弹层（全部/KG/WY 与数量）；管理底栏为全选、反选、红色图标及文字删除，确认复用 `PlaylistDeleteConfirmation.showBatch`。
- 本地歌单管理原有删除图标和文字已使用 `pm_dialog_danger`，新管理页沿用同款。

## 固定底部操作栏的键盘安全区（2026-11-24）

- `SystemBarsExt.applySystemBarsInsets(protectIme = true)` 与 Manifest 的 `adjustResize` 配套；根容器保存初始 padding 并补足 IME / 导航栏差额，底栏保持原尺寸和导航栏 padding。覆盖歌单管理、三方导入、本地歌单及歌曲管理、收藏管理、在线歌单歌曲批量、本地音乐编辑、下载管理和酷狗登录导入。
- 搜索时键盘上方保持全选、反选、删除/导入操作可见；重复分发 Insets 或下载编辑态切换不得累加底部空白。

## 我的歌单固定工具行（2026-11-24）

- `fragment_mine_playlists_tab.xml` 在列表外提供固定工具行：复用 `bg_search_field` 搜索框、`ic_list_check_24` 批量管理、`ic_add_24` 导入；`MinePlaylistsTabFragment` 防抖筛选名称/简介、区分空列表与无结果，恢复搜索并按 View 生命周期取消旧查询。
- `fragment_mine.xml` 的 Tab 行恢复为居中双文字，不再承载管理/导入图标；列表内容与空态约束在工具行下方。

## 歌单收藏三点菜单（2026-11-24）

- `FavoritePlaylistsActivity` 只在本页将共享顶栏搜索按钮替换成 `ic_more_vert_24`（48dp 热区、12dp 内边距）；`FavoritePlaylistMenu` 复用下载管理的 `layout_search_source_dropdown` 与 `item_compact_action_menu_row`。
- 依次为搜索（搜索图标）、多选（列表勾选图标）、导入（加号）；分别打开原搜索页、歌单管理页、三方导入页。先关闭菜单再跳转，销毁页面时释放菜单。

## 三方账号管理（2026-11-24）

- `ThirdPartyAccountsActivity`、`ui/thirdparty/`：单区域两条账号行、品牌/圆形头像、昵称尾随音源标签、有效/过期状态、单账号 Sheet 与顶部批量菜单；刷新暂未开放，清除复用危险色二次确认，底部固定药丸进入三方歌单导入。
- `ThirdPartyAccountsRepository` 共享校验状态；失败保留原状态并经 `PmMessage.error` 提示固定文案。`MusicCookieManager` 的快照守卫保护校验、清除与候选缓存，结果按会话指纹持久化至 `AppConfigStore`。

## 侧栏常用入口（2026-11-24）

- `DrawerQuickActions` / `item_drawer_quick_action.xml`：在同一功能卡中依次提供主题外观、意见反馈、系统公告和检查更新，复用提供的侧栏图标、主题选项 Sheet、既有页面；右侧显示模式图标或当前版本，再显示设置页同款箭头。
- 功能卡可垂直滚动，账号头固定；链接导入与定时关闭也保留同款箭头。MainActivity 创建/刷新/销毁快捷入口控制器，控制器等待侧栏关闭后执行操作。

## 反馈记录列表与详情 Sheet（2026-11-24）

- `FeedbackHistoryActivity` / `FeedbackHistoryAdapter`（`activity_feedback_history.xml`、`item_feedback_history.xml`）：入口位于 `FeedbackActivity` 顶栏右上角；复用类歌曲列表排布与 `item_playlist_detail_status.xml` 分页底栏，左图/反馈类型图标圆角底占位（`bg_feedback_history_placeholder`）、中上类型下描述、右上时间下线条药丸状态（`bg_feedback_status_pill_pending` / `bg_feedback_status_pill_processed`）。
- `FeedbackDetailBottomSheet`（`bottom_sheet_feedback_detail.xml`）：复用 `ThemeOverlay_Pm_BottomSheetDialog` 与 `bg_bottom_radius_sheet` 展示类型、状态、反馈时间、处理时间、联系方式、描述与附件缩略图，点击附件复用 `dialog_image_preview.xml` 全屏预览。
