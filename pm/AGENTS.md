# AGENTS.md

本文件用于指导 Codex / Claude Code 在 `pm/` 手机端 App 项目内协作。外层总规则见 `../AGENTS.md`。

## App 介绍

`pm` 是 PisaMusic 的手机端 Android App，采用单模块 `:app`。项目以 Kotlin 为主，少量 Java，使用 MVVM、Hilt、ViewBinding、Media3 / ExoPlayer 构建音乐播放、搜索、下载、本地音乐、扫码入口、配置拉取、反馈、公告、更新检测等能力。

服务端已经迁移到外层 `../server/`。本项目内不再维护 `server/` 后端代码；凡是涉及系统配置、公告、更新、反馈、设备上报、管理后台、官网或服务端加密逻辑的改动，都应到 `../server/` 中处理，并同步检查 Android 端数据模型和接口调用。

## 项目规则

- 遵守外层 `../AGENTS.md` 的工作区规则，尤其是禁止未经批准批量删除工作区外文件。
- `pm/` 不再是独立 Git 仓库，版本管理统一使用外层根目录 monorepo。修改前在根目录或本目录查看 `git status --short`，不要回退用户已有的无关改动。
- 如果 App 新增功能、调整模块边界、改变构建方式、改变后端契约或迁移关键实现，需要同步更新本文件。
- 不要主动去 `../example/` 搜索参考代码。只有用户明确指定某个模块要参考 `example` 时，才允许读取对应内容。
- Android 端与服务端接口字段保持同步；涉及配置、更新、公告、反馈、设备上报、加密白名单时，同时检查 `../server/`。

## 构建与运行

- Debug 构建：`.\gradlew.bat assembleDebug`
- Release 构建：`.\gradlew.bat assembleRelease`
- 安装 Debug：`.\gradlew.bat installDebug`
- 单元测试：`.\gradlew.bat testDebugUnitTest`
- 清理：`.\gradlew.bat clean`
- macOS / Linux 可使用 `./gradlew ...`

后端环境：

- 外层服务端目录：`../server/`
- 本地服务端默认端口：`53380`
- Android Debug 后端：`http://192.168.9.100:53380/`（Debug 模式跳过远程服务发现，直接使用 `SYSTEM_SERVICE_BASE_URL`）
- Android Release 后端：`https://pm.hs.partialy.cn/`（Release 模式通过远程服务发现文档与缓存解析服务端 origin）
- `SYSTEM_SERVICE_BASE_URL` 由 `app/build.gradle.kts` 按 build type 注入。

## Android 架构

- 单模块：`:app`
- 主要语言：Kotlin，保留少量 Java
- UI：Activity / Fragment + ViewBinding
- 依赖注入：Hilt
- 播放：Media3 / ExoPlayer / MediaSession
- 状态：优先使用 `StateFlow` / `MutableStateFlow`
- 网络：Retrofit + OkHttp，系统服务端和第三方音乐源客户端分开维护
- 扫码：侧拉抽屉扫码入口使用 JourneyApps ZXing `ScanContract` 拉起自定义 `PortraitCaptureActivity` 扫码界面，结果先回传到 `MainActivity` 处理；播放器一起听扫码入口复用同一 Activity。扫码页保留 JourneyApps `DecoratedBarcodeView` / `CaptureManager` 内核，使用 `Theme.Pm.Scanner` 进入 edge-to-edge 并按真实状态栏/刘海高度下移顶部操作区；返回按钮与提示文案同一行，手电筒和相册按钮统一通过 AppCompat 加载 `ic_lighting_24` / `ic_image_24`。相册识别结果必须按 `SCAN_RESULT` 返回给 `ScanContract`，不要绕过现有业务分发。

重要目录：

- `activity/`：启动页、搜索、播放器、设置、本地音乐、歌单导入、WebView 等 Activity。
- `ui/`：Fragment、Adapter、BottomSheet、Dialog、Binder、ViewModel 等 UI 层代码。
- `network/`：Retrofit API、Repository、Cookie 登录、加密、网关签名、运行时配置、第三方音乐源。
- `player/`：播放器门面、播放列表、ExoPlayer / MediaSession 包装、播放状态持久化。
- `utils/` 和 `util/`：下载、本地音乐、设置、设备信息、歌词、封面、异常处理等工具。
- `model/`：歌曲、搜索行、系统 API 数据、设备上报、下载音质等模型。
- `service/`：`MusicService` 前台 `MediaSessionService`。
- `assets/`：内置网页资源，例如发现页、本地设置、反馈、歌词颜色等页面。

## 播放器规则

- `MusicController` 是 UI 和 Service 使用的统一播放器门面，也是 App 级播放单例；`MusicService` 只负责前台通知、MediaSessionService 承载和状态栏歌词，不在 `onDestroy()` 中释放播放器。只有明确的应用级退出 / 进程级清理流程才调用 `MusicController.release()`。
- `PlaylistManager` 管理播放列表、当前下标、下一首队列和 `StateFlow`；主列表与“下一首播放”队列都按 `SongType + songId` 识别歌曲，同一音源同一歌曲不得重复入队，已有占位歌曲执行插播时应移动到目标位置而不是复制。
- `PlayerEngine` 管理 ExoPlayer、MediaSession、播放事件、进度、播放模式和状态持久化。
- `SongType.CLOUD` 使用稳定的 `source + uuid` 进入普通歌曲队列和播放状态；队列及持久化只保存稳定歌曲信息，实际播放、自动/手动切歌和恢复当前歌曲前由 `PlayerEngine` 重新请求临时播放地址并原子替换对应 MediaItem。Cloud 播放地址不得提前为整批队列签发，也不得写入收藏、歌单、分享或播放状态。
- 主播放页和通用迷你播放器的播放按钮统一由 `PlaybackButtonStateRenderer` 根据 `playbackState + isPlaying` 渲染；Media3 处于 `STATE_BUFFERING` 时显示 `ic_loading_loop_24` 并由代码做 1.5 秒无限旋转，离开缓冲态或页面销毁时必须取消动画并恢复播放/暂停图标。
- `PlayerEngine` 默认使用 Media3 原生音频渲染器；只有宽声场处理确实启用时才接入 `AudioEffectsRenderersFactory`，音频渲染异常时应回退到原生渲染器并对当前歌曲重试一次。
- `MediaItemFactory` 创建延迟解析的 `MediaItem`。
- `PlayUrlGetter` 负责 KG / WY / KW / LOCAL 播放地址解析和音质降级。
- PisaMusic 系统账号 VIP 仅由外层 `server` 的公开 `vip` / `vipExpiresAt` 下发并由 `AccountSessionStore` 内部保存；它与 `MusicCookieManager` 管理的 KG / WY 第三方账号及其 VIP 完全分离。除“我的”页可在邮箱下为有效 VIP 显示金色纯到期时间标签外，Android 其他页面、侧拉栏、弹窗均不得展示系统 VIP 文案或标识。
- KG / WY 的下载、手动切换播放音质及已保存播放音质必须统一经 `MusicQualityAccessPolicy`：音质选择器始终展示当前音源的完整原始档位；游客仅可使用原有普通档位，其余禁用并标记“需登录”，点击后关闭选择器并进入 PisaMusic `LoginActivity`；普通系统账号仍仅可使用 WY 四档与 KG 三档，其余高级音质禁用并标记“联系作者解锁”，点击后关闭选择器并进入已预选“账号相关”的 `FeedbackActivity`，提示用户填写需求并提交审核；有效系统 VIP 可使用完整原始档位，KW / LOCAL 维持原行为。退出登录、后台关闭或到期时，`MediaItemFactory` 必须将越权已保存音质回退到 KG 128、WY standard 或 KW 原默认；不得绕过策略直接取链。
- `PlayerStateStore` 使用 SharedPreferences + kotlinx.serialization 持久化跨会话播放状态。
- Mini 播放器封面必须通过 `SongCoverUrl.getSongCoverData(...)` 加载，确保本地歌曲优先显示 `embeddedCoverArt`，不要只走远程封面 URL。
- 搜索、收藏、本地/已下载、歌单详情、云盘和首页每日推荐的普通歌曲行统一使用 `item_song_list.xml`、`SongListItemBinder` 与 `SongListPlaybackStateObserver`；页面仅通过参数控制收藏/下载/更多按钮。当前歌曲按 `SongType + id` 识别，歌名和歌手使用 primary，封面显示三线频谱，播放时跳动、暂停时静止；按钮颜色不跟随当前态变化。本地/已下载行及其更多菜单均不展示下载、分享。
- 除主播放界面外，普通页面的可见内容统一以 `@dimen/pm_page_content_start`（12dp）作为页面左基线；返回箭头与三条杠菜单使用 `Widget.Pm.PageLeadingAction` 和已移除左透明画布的 vector，使实际笔画左缘同样落在 12dp。嵌套 RecyclerView 必须按最终可见内容计算，不得把父容器 start padding 与歌曲/歌单 item 的 start padding 重复叠加。
- 酷狗、网易、自建歌单和“我的收藏”详情统一复用 `ui/playlistdetail/` 的 Header、歌曲内容、搜索和顶栏交互模块；搜索只过滤当前显示，播放仍按完整歌单以及 `type + id` 定位。Header 使用全宽大封面、顶部 scrim、底部羽化渐变、两行以内标题与描述，以及“播放全部 / 收藏”双按钮。禁止加入分享人、VIP、热播等非产品字段。
- 顶栏动作顺序固定为搜索、分享、更多；分享复用 `ShareBottomSheet`，更多复用 `PlaylistActionBottomSheet`。顶栏和播放横幅的空白区域必须消费点击，只有显式“播放全部”与播放图标可以开始播放。
- 歌单详情只保留 `activity_playlist_detail.xml` 中一份 52dp 紧凑工具条，并与“我的”页共用 `CoordinatorLayout + AppBarLayout + CollapsingToolbarLayout` 推拉门结构：封面、标题、描述和双按钮位于 `parallax` 折叠层，工具条作为无 `scrollFlags` 的 AppBar 直接子项向上推进并固定在 Header 下方，顶部 Header 按同一 200dp 折叠进度向下渐显，最终在封面前闭合。四类详情页统一使用静态 `PlaylistDetailHeaderController`、`PlaylistDetailContentAdapter` 和 `PlaylistDetailInteractionController`；不得恢复 RecyclerView Header、`playAllAnchor` 手动位移或 Header/外层两套工具条显隐切换。排序与批量操作图标当前仅展示禁用态。
- 本地歌单和“我的收藏”不可重复收藏，Header 显示禁用的“已收藏”。“我的收藏”右上角搜索入口进入 `LovedSongsSearchActivity` 独立页面；独立搜索页按歌名或歌手实时过滤展示，但单击结果与“播放全部”都必须使用按添加时间排序的完整收藏列表作为播放队列。
- 播放页 3D 音效入口进入 `AudioEffectsActivity`；音效配置集中在 `audioeffect/` 模块，本地通过 SharedPreferences + kotlinx.serialization 保存，不同步到服务端。`AudioEffectsManager` 绑定 ExoPlayer `audioSessionId` 后使用系统 `DynamicsProcessing` / `Equalizer`、`BassBoost` 生效；宽声场由 Media3 `StereoWidenerAudioProcessor` 在 `DefaultAudioSink` 前做双声道 PCM Mid/Side 处理，处理器旁路时不能直接把同一个 `ByteBuffer` 作为源和目标复制。新增音效能力优先扩展该模块，不要把 AudioEffect 生命周期放进 Activity。
- 在线歌曲播放失败不再自动跳到当前队列下一曲；失败后按设置里的“自动切换列表”处理，关闭时暂停并提示，开启时切换到本地 / 已缓存 / 已下载歌曲列表。
- 在线播放缓存只通过 `player/cache/PlaybackMediaCache` 门面访问：队列项先在 IO 登记 descriptor / catalog，再一次性交付 `pmcache://media/<cacheKey>` 逻辑 URI；Main 不得按歌曲写物理缓存目录或 prepare 占位 URI。缓存身份固定为规范化 `source + songId + qualityKey`，每个在线 `MediaItem` 绑定构造时冻结的实际音质，目录同步从当前 player item 校验，不得用之后变化的全局音质偏好推断。
- Cloud 音质固定为唯一的“默认”档（`cloud:default`），不参与 KG / WY / KW VIP 音质策略；是否可播放只看歌曲 `playable` 与 server 实时响应。Cloud 必须旁路 `PlaybackMediaCache`，每次播放、切歌和下载临近使用时重新取 URL，避免持久缓存或旧签名绕过后台禁用状态。
- 真实播放 URL 只存在进程内 TTL 注册表，不写入目录或持久化；LOCAL 的 `content://` / file URI 必须旁路播放缓存。仅已知总长、从字节 0 开始连续完整覆盖的 `READY` 项可进入已缓存回退，未知总长、缺口或部分字节一律排除。
- `Media3CacheStore` 独占 `SimpleCache`，由 Media3 管理 Range、Span 和物理 LRU；统计和清理均通过 facade，清理仅移除资源且不得释放活跃 cache。目录索引继续写入 `pm_local_music.db` 的 `cached_playback_records`，兼容列 `play_url` 不得恢复运行时读写。
- `PlaybackMediaCache.release()` 只用于 renderer / ExoPlayer 内部重建时释放可重开的缓存实例；播放器最终退出必须调用不可逆 `shutdown()`。所有 descriptor、catalog、cache store 和媒体项操作都受同一终止门禁保护，终止会等待在途操作，之后禁止迟到任务重新登记或惰性重开缓存。
- “设置 - 播放设置 - 与其他应用同时播放”由 `AudioCoexistenceController` 管理：关闭时沿用 Media3 音频焦点，所有场景和部分场景不主动申请焦点；部分场景仅在匿名播放用途、活动录音配置或系统音频模式表明正在录音/音视频通话时暂停，并且只能恢复由该策略暂停的播放。系统或厂商仍可能在通话期间强制静音，不要把该限制描述为 App 可完全绕过。
- 通用二级设置页继承 `SubSettingsActivity`，使用 `SubSettingsSection` / `SubSettingsItem` 声明无图标的 Option、Navigation、Info 和 Switch 列表；下载、歌词、同步等新二级设置优先复用该模板，不要复制 Activity 外壳和列表绑定逻辑。
- “设置 - 下载设置”由 `DownloadSettingsActivity` 聚合下载位置、文件名命名规则、写入封面、写入标签和写入歌词；主设置页只保留一个“下载设置”入口。二级设置项的 `summary` 可选，不传时保持单行居中，传入时标题在上、较小且较淡的说明在下。
- “设置 - 歌词设置”由 `LyricSettingsActivity` 聚合状态栏歌词和歌词颜色预设；主设置页只保留无图标二级页入口，二级页继续导航到各自现有功能页面。
- “设置 - 数据管理”由 `DataSettingsActivity` 聚合“导入与导出”、收藏与同步、缓存管理；“收藏与同步”进入 `FavoritesSyncSettingsActivity`，展示登录状态、最近同步、错误状态并提供“立即同步 / 去登录”入口；原 `DataManagementActivity` 的页面标题改为“导入与导出”，继续负责本地收藏和歌单的备份、恢复及清除。主设置页入口顺序为播放设置、歌词设置、下载设置、外观主题、数据管理、更多设置；Debug 构建中的开发者调试位于故障上报之前。

## 本地数据

- 自建本地歌单及其歌曲关系以 `pm_local_music.db` SQLite 数据库为主存储，由 `LocalPlaylistDbStore` 管理。
- 收藏歌曲以 `pm_local_music.db` 的 `favorite_songs` 表为主存储，由 `LoveManager` 管理；旧版 `loveList.json` 仅用于迁移、导入导出兼容和备份镜像。
- `PlaylistCollectionManager` 仍是收藏/自建歌单的统一入口；网络歌单收藏写入 `favorite_playlists`，自建歌单写入本地歌单表。旧版 `collected_playlists.json` 与 `songs_<playlistId>.json` 会在加载时迁移到 SQLite。
- 本地歌单与收藏 JSON 文件仅用于导入导出兼容和备份镜像，不要再作为新的运行时主存储。
- 酷狗 / 网易第三方登录态统一由 `MusicCookieManager` 管理，存储在 `pm_local_music.db` 的 `third_party_login_sessions` 表；Cookie 与第三方用户摘要（昵称、用户名、第三方 VIP、头像、背景图等）都从该入口读取，不要恢复 `kugou_cookie_user.json`、`wy_cookie_user.json` 或侧栏 profile JSON 缓存作为运行时来源。不得用该存储推断或展示 PisaMusic 系统账号 VIP。
- 主界面侧拉栏不恢复旧的 KG / WY 纵向独立大卡、独立退出按钮或更多登录菜单；功能卡首行固定为 KG / WY 左右双列小入口，中间使用竖向分隔线，双列账号行使用 8dp 外层水平内边距，使左侧 K 标签与下方 16dp 功能图标左缘对齐。来源标签统一复用 `SongSourceTagBinder`：未登录时不显示头像，只显示 K/Y、“未登录”和紧随文本的右箭头，点击分别进入 KG / WY 登录；已登录时隐藏箭头，显示 24dp 圆形头像和单行昵称。两个来源均未登录时导入行显示“登录后可导入歌单”且不显示清理按钮；任一来源登录时显示“导入歌单”和右侧红色“清除登录”，清理只允许调用 `MusicCookieManager.clearAll()` 清除第三方会话，不得影响 PisaMusic 系统账号。“导入歌单”本身仍为无点击业务的占位入口。“定时关闭”由 `SleepTimerManager` 保存目标时间并在进程内倒计时，入口仅在启用或等待本曲结束时显示状态，点击通过 `SleepTimerBottomSheet` 设置、更新或取消。默认四个快捷档位为 5/15/30/60 分钟，必须保持四槽存储并允许在“设置 → 播放设置 → 定时配置”分别改为 1～1439 分钟；Sheet 不显示“快捷时间”标题，快捷项固定为等距 60dp 圆形双行按钮，上方为数字、下方为 `min`，未选中使用透明背景与中性色圆边框/文字，选中使用淡 primary 背景与 primary 边框/文字；“自定义时间”标题固定简化为“自定义”；“播完整首歌再停止”开关不得显示额外说明文案。开关开启后，倒计时结束时若仍在播放则进入等待态，`PlayerEngine` 只在自然自动切歌、单曲循环完成或列表末尾结束时通过 `MusicController.setSongEndedInterceptor` 同步阻止后续自动续播，再由定时管理器暂停并清理状态；手动切歌不得触发。
- 酷狗手机验证码 / 扫码登录成功后，以登录响应里的 `token`、`userid` 作为主凭据调用 `/login/token` 补齐 `vip_type`、`vip_token`；`vip_token` 允许为空，最终合成 `KUGOU_API_PLATFORM=undefined; token=...; userid=...; vip_type=...; vip_token=...` 后仍统一写入 `MusicCookieManager`。
- 歌词与封面映射以 `pm_media_index.db` SQLite 数据库建索引，由 `LocalMediaIndexDbStore` 管理；歌词文本可入库，保存当前音源可用的最优原文歌词（KG 优先 KRC，WY 优先 YRC，失败再 LRC），封面大图/内嵌图仍保留在文件或音频标签中，数据库只记录来源和引用。
- 歌词解析统一走 `cn.partialy.pm.lyric.LyricParser`，输出 `LyricContent` / `LyricLine` / `LyricWord`。播放页 RecyclerView 使用 `lineText` 保持单行展示，卡拉 OK View 和状态栏歌词在“使用逐字歌词”开关开启且存在逐字时间时使用 `words` 做精准颜色过渡。
- 播放页切换到任意非空歌曲后先显示“正在加载歌词...”，歌词请求采用最新歌曲优先并用 `songIdentityKey(type + id)` 拒绝旧请求迟到结果；无歌词或加载失败继续落到“暂无歌词”。
- 播放页卡拉 OK View 支持用户上下滑动浏览歌词，浏览时中线行可点击跳转播放；用户无操作 3 秒后恢复自动滚动。歌词样式设置中包含“播放时候逐字放大”开关，默认关闭，仅影响卡拉 OK View 当前逐字渲染效果。
- 状态栏歌词由 `MusicService` 驱动，设置页使用 WebView 加载 `assets/status_bar_lyric/`，悬浮歌词本体使用原生 `WindowManager` + 自绘 View；设置页可临时显示真实悬浮窗预览，调整宽度时悬浮窗会短暂显示容器背景作为宽度提示；不要把常驻悬浮窗实现绑定到播放器 Activity 生命周期。
- “我的”页使用 `CoordinatorLayout + AppBarLayout + 全高 ViewPager2`：`CollapsingToolbarLayout` 只负责头像背景折叠，Tab 作为无 `scrollFlags` 的 AppBar 直接子项吸顶，固定 Header 必须是 Coordinator 顶层 Overlay 并在根布局显式 `requestApplyInsets()` 后处理状态栏安全区。两个 Tab 各自使用页面级 RecyclerView 表达不同内容长度和独立滚动位置；ViewPager 视口保持等高，不得恢复 `wrap_content`、`UNSPECIFIED` 全量测量、外层 `NestedScrollView` 或按 Adapter 项目数动态修改页面高度。MainActivity 保存的当前顶层目的地是首页、发现页和我的页容器可见性及系统栏样式归属的唯一依据，隐藏 Fragment 不得写窗口级系统栏状态。

## 网络与服务端契约

- KG：`KgApiService`、`KgUrlProxyApiService`、`KgRepository`、`DfidInterceptor`
- WY：`WyApiService`、`WyUrlProxyApiService`、`WyRepository`
- KW：`KwSearchApiService`、`KwUrlProxyApiService`、`KwRepository`
- Cloud：`SystemApiService` + `network/cloudmusic/CloudMusicRepository` / `CloudMusicSubmissionRepository`，只访问外层 server 的 `/api/cloud-music/*`。首页第二个 Tab 为“云盘”，空关键词展示全部可搜索曲目，搜索和滚动分页固定 `limit=20`；`active` 可播放，`disabled` 可搜索但不可取播放地址。封面使用稳定 `/tracks/:uuid/cover`，歌词先获取临时 URL 再由仅允许 HTTPS 的资源 client 拉取。云盘投稿已复用 server `/api/cloud-music/submit/*` 接口，支持 URI 流式上传、投稿历史和 `rejected/pending_review` 重新提审；临时上传凭证与签名 URL 仅在内存中使用，不落库。
- `ConfigManager` 从外层系统服务端获取启动配置，并动态提供 KG / WY / KW / proxy 端点、歌曲 URL 端点和网关签名配置。
- App 启动访问系统服务前先由 `network/discovery/ServiceDiscoveryManager` 读取远程发现文档、缓存或 BuildConfig embedded origin；生产 discovery fetch/health 必须使用 OkHttp `enqueue` 接入协程取消并在取消时 `Call.cancel()`，不得恢复阻塞 `execute()`。`SystemApiService` 与一起听明文配置 Retrofit 固定使用 `system.runtime.invalid` 占位地址，并由 `SystemServiceEndpointInterceptor` 在请求发出前改写为当前 discovery API origin。bootstrap 必须使用发现快照中的相对 `bootstrapPath`，只有快照仍为 current 且响应有效时才发布音乐端点和网关签名；下发前音乐端点保持 `music-runtime.invalid` 不可路由。
- Splash 是启动 bootstrap 的唯一入口，`MainActivity` 不得重复刷新。进入在线启动前调用 `ConfigManager.beginOnlineStartup()`；任何自动降级或用户主动进入本地模式的路径必须调用 `ConfigManager.enterLocalMode()`，立即把音乐端点重置为 `music-runtime.invalid` 并通过 generation 拒绝晚到的旧 bootstrap 响应。
- KG / WY / KW / proxy 的 Retrofit 使用不可路由占位地址，`RuntimeEndpointInterceptor` 在每次请求发送前按 `ConfigManager` 当前配置重写真实地址，并将当次 bootstrap state 通过 request tag 传给 `GatewaySignInterceptor`，保证同一请求的 endpoint 与签名来自同一快照；该拦截器必须位于签名、故障追踪和日志拦截器之前。动态绝对 `@Url` 必须由 `ConfigManager` 的 `RuntimeUrlTarget` 同时取得 URL 和 state，并通过 Retrofit `@Tag` 传入；KG/WY Cookie 请求同样传递同一 target，不得先取 URL 再由 CookieRequest 读取新 state。bootstrap 成功前音乐端点统一保持 `https://music-runtime.invalid/`，不得回退到系统服务地址、`127.0.0.1` 或在 Retrofit 创建时快照运行时端点。
- discovery 缓存只保存发现文档原文与版本，不缓存 bootstrap 音源配置；远程文档版本低于当前快照时不得覆盖或降级。一起听 Socket 每次连接读取当前 realtime origin，反馈地址和账号相对头像统一按当前 API origin 解析；绝对头像仅接受合法 HTTPS URL。
- 首页推荐页由 `RecommendedSongsViewModel` 聚合 KG 每日推荐 / 推荐歌单与 WY `/personalized` 推荐歌单、`/personalized/newsong` 推荐新歌；新增首页推荐来源时需要补齐模型、Repository 映射、`SongType`/`CollectedPlaylistType` UI 分流和播放 URL 解析。
- 首页推荐顶部三张功能卡固定为云盘共享音乐空间、每日推荐、雷达歌单；第一张点击后切换到首页第二个“云盘”Tab，三张卡片使用无内嵌文字的简约底图并由布局统一叠字。卡片固定为 `128dp × 170dp`，横向间距 `10dp`，横向列表约露出半张第三卡；卡片 elevation 固定 `1dp`，底部使用 `80dp`、顶部全透明的渐变羽化层承载标题/描述，避免恢复为大面积硬黑遮罩；“今日推荐”左上使用动态 `M-d 周X` 日期标签，不得恢复为纯图片或静态日期。云盘 Hero 副标题统一为“宝藏歌曲&珍藏歌曲共享”。
- 云盘歌曲当前不扩展一起听协议；相关菜单隐藏或提示“云盘歌曲暂不支持一起听”，收到 Cloud 歌曲也必须在一起听入口拒绝，后续需要同时扩展 Android、PC 与 server 协议后才能开放。
- KG / WY 已登录且本地存在对应 Cookie 时，非播放 URL 的数据接口（搜索、推荐、歌单、歌词等）必须优先走 `KugouCookieRepository` / `WyCookieRepository` 的 Cookie 请求，失败后回退匿名 Retrofit；唯一例外是 KG `search/suggest` 搜索提示词，为保证输入变化时能取消底层 OkHttp Call，固定使用匿名 Retrofit `suspend` 接口。播放和下载 URL 仍只走现有 `KgUrlProxyApiService` / `WyUrlProxyApiService` 代理链路，不带 Cookie。
- 修改 endpoint 字段时，检查 Android `SystemData.kt` / `ConfigManager.kt`，以及 `../server/` 中的配置存储、类型和管理后台表单。
- 修改发现页字段时，检查 Android `DiscoverInfo` / `DiscoverFragment`，以及 `../server/` 的 discover 配置和管理后台系统页。

安全与加密：

- `SystemEncryptionInterceptor` 只用于 App 自有 `SystemApiService` 链路。
- 系统服务端请求会写入 `x-pm-random` / `x-pm-enc-ver`，把 JSON body 加密为 `{isEnc, encData}`，并解密加密响应。
- 服务端 AES-GCM、明文路径、时间戳校验和 nonce 防重放逻辑位于 `../server/src/middleware/encryption.ts`。
- `GatewaySignInterceptor` 只签名匹配 `GatewaySignRuntime` 的第三方网关请求。
- KG / WY / KW 第三方源 API 不使用系统 AES-GCM 客户端，但可能使用网关签名。

## 开发规范

- 优先组件化、模块化，避免把业务堆进 Activity / Fragment。
- ViewModel 负责 UI 状态和调度，Repository 负责数据来源，播放器逻辑放在 `player/`。
- 提取重复逻辑，一个方法只做一件事。
- 中文注释保持可读性，避免无意义注释。
- 单文件尽量不超过 1000 行；大型 Activity、Fragment、Adapter、工具类要拆分。
- 新增音乐源时，需要同时包含模型、API、Repository、搜索映射、播放地址解析和 UI 来源标识。
- `SearchViewModel` 的 KG 搜索提示词必须保持即时请求：每次输入先取消旧 `suggestionJob`，空输入或切换音源同时取消并清空提示；`KgRepository.getLinkKeyword` 必须传播 `CancellationException`，不得恢复吞掉取消或阻塞式 Cookie 请求。搜索页音源当前项和下拉选项统一复用 `SongSourceTagBinder` 的 K / Y / W 方块标签，不展示“小蓝 / 小红 / 小黄”。
- 保持系统后端 Retrofit client 与第三方音乐源 client 分离，不要把系统 AES-GCM 拦截器混入 KG / WY / KW。

## 验证要求

- Android 构建：`.\gradlew.bat assembleDebug`
- Android 单元测试：`.\gradlew.bat testDebugUnitTest`
- 涉及 Release 配置或签名时再运行 `.\gradlew.bat assembleRelease`
- 涉及后端契约时，配合 `../server/` 验证 `/api/health`、`/api/config/check-update`、`/api/config/discover` 和加密配置接口。
- UI 密集流程仍需要真机或模拟器手动测试，例如播放、搜索、下载、发现页、反馈、更新弹窗。

## 同步字段模型补充

- 收藏歌曲、收藏歌单和自建歌单持久化需要同时写入与桌面端一致的 canonical 字段：歌曲使用 `id/source/urlParam/name/singer/album/cover/coverSize/duration/size/vip`，歌单使用 `id/source/name/desc/cover/coverSize/tags/song_count/play_count/collect_count`。
- `SongInfo`、`CollectedPlaylist` 可以作为 Android 播放和旧 UI 的兼容模型，但新增收藏、歌单和同步相关逻辑必须优先通过 `CanonicalSong` / `CanonicalPlaylist` 或对应转换方法处理，避免继续扩散 `artist`、`coverUrl`、`intro` 等旧字段名。
- `pm_local_music.db` 的收藏与自建歌单表已补齐 canonical 列和 `payload_json`；新增迁移时必须保持旧字段可读，确保历史数据升级后仍能显示和播放。

## 收藏与歌单同步

- 账号接口通过 `ConfigManager` / `SystemApiService` 访问外层服务端 `/api/auth/*`，继续走系统服务端 AES-GCM 加密链路；登录 token 由 `AccountSessionStore` 持久化并同步到 `TokenManager`。`LoginActivity` 支持用户名/邮箱/手机号密码登录及邮箱/手机号验证码登录；注册账号、找回密码由 `AccountAssistActivity` 的原生页面承载，支持邮箱/手机号切换并调用对应验证码、注册和 `reset_password` 接口。
- 同步接口通过外层服务端 `/api/sync/*` 拉取/推送增量，使用账号 `Authorization: Bearer <userToken>` 鉴权；旧同步码创建、加入、重置和解绑设备流程已移除。
- `SyncManager` 是手机端账号同步编排入口，负责登录后 seed 本地 outbox、拉取/推送增量和应用远端 tombstone；未登录时只记录本地 outbox，不主动推送；同步游标按账号隔离，账号切换时必须重置游标并重新 seed 本地 outbox。
- `sync_outbox` 表保存本地待推送 op，收藏歌曲、收藏歌单、自建歌单和自建歌单曲目变更必须写入 outbox；已登录账号时由 `SyncWorkRunner` 触发后台增量同步。
- `sync_outbox` 按账号 `account_id` 隔离读取和推送；账号切换、退出登录或 refresh 失效时必须清理旧账号/未归属 outbox，避免把上一账号待同步操作推给新账号。
- 同步 payload 只允许使用 `CanonicalSong` / `CanonicalPlaylist` 字段；不要同步 `source=local` 歌曲，不要同步播放 URL、filePath、歌词正文、内嵌封面。本地文件封面在自建歌单同步时置空，另一端应显示默认封面。

## 同步设置页补充

- 同步设置入口位于 `DataSettingsActivity` 的“收藏与同步”，只展示账号同步摘要并进入 `FavoritesSyncSettingsActivity`；独立同步页展示登录状态、最近同步时间和错误状态，未登录时跳转 `LoginActivity`，已登录时执行 `SyncManager.syncNow()` 立即同步，不再提供同步码输入、同步码复制、同步码生成或解绑设备入口。
- `AuthInterceptor` 必须保留请求上已有的 `Authorization` 头，避免覆盖同步或其他显式鉴权请求。
- 听歌时长由 `listening/ListeningManager` 统一观察 Media3 播放快照，片段先写入 `pm_local_music.db` 的 `listening_active_checkpoint` / `listening_pending_fragments`，按 15 分钟批次经 `/api/listening/fragments/batch` 上报，并在 `MainActivity` 启动及账号登录成功后各尝试补传一次。V1 请求固定 `schemaVersion=1`、`platform=android`、必填 `x-pm-device-id`；只上报 `source + songId` 及歌曲标题/歌手/专辑等非路径元数据，不能上传本地文件路径或播放 URL。我的页面在 VIP 到期标签下显示服务端动态推导的 `Lv N  累计听歌 X 分钟/小时`，1000 分钟起按小时显示。
- 自有账号入口同时位于“我的”页头像区域和主界面侧拉栏账号头；两处都只读取 `AccountSessionStore`，未登录进入 `LoginActivity`，已登录进入 `AccountProfileActivity`。侧拉栏未登录标题固定为“立即登录”并保留右箭头，不展示邮箱或 VIP 信息。
- “我的”页头像、昵称和邮箱优先读取 `AccountSessionStore` 中服务端账号字段；账号头像使用服务端 `avatarKey/avatarUrl`，相对路径按 `SYSTEM_SERVICE_BASE_URL` 拼接，自定义头像的 `avatarUrl` 为七牛公开图片空间直链。仅 `session.vipActive=true` 且存在未来 `vipExpiresAt` 时，在邮箱下显示金色标签，画面只渲染设备本地时区的 `yyyy-M-d HH:mm:ss` 到期时间，不添加 VIP、等级或到期前缀。
- `LoginActivity` 与 `AccountAssistActivity` 使用原生 XML + ViewBinding 的 edge-to-edge 界面；账号登录、注册、找回密码输入框统一使用 Material `TextInputLayout` 浮动标签样式。`AccountProfileActivity` 继续使用 edge-to-edge 全屏 WebView 容器；Native 统一注入 `--native-status-bar-height` 与 `--native-navigation-bar-height` CSS 变量，WebView 本身不要再额外设置系统栏 padding。个人资料页顶部 headerbar 由 `assets/account-profile/` 内的网页实现；资料修改走 `/api/auth/profile/email-code` 与 `PATCH /api/auth/profile`，头像上传先走 `/api/auth/avatar/upload-token` 获取七牛 token 后由 Native 直传公开图片空间，再把返回 key 写入资料，成功后必须覆盖本地账号 session。旧的多张内置头像自选功能已废弃，不要恢复。

## 启动本地模式补充

- `SplashActivity` 启动检查遇到没网、服务不可用或服务端 `appAvailable=false` 时进入本地模式，由 `MainActivity` 以非阻塞提示告知用户；设备封禁仍必须阻止进入。
- 已接受协议的 Splash 启动 server bootstrap 总等待预算为 10 秒；页面停留超过 3 秒时显示原生“本地模式进入”按钮，点击后立即以本地模式进入，并继续保留冷启动扫码链接传递。
- 设置-关于中的“联系我们”通过 `/api/config/get?id=pm-contact-us` 获取 HTML 片段并用 WebView 渲染；服务协议和隐私政策页面只显示内容，不显示接口返回的 `title` 字段。

## 播放故障上报

- `fault/` 模块负责播放取链诊断、敏感字段脱敏、SQLite 持久化和故障批次上报；`playback_fault_logs` 位于 `pm_local_music.db`，只记录 KG / WY / KW 取链失败、空/非法 URL 和在线歌曲 ExoPlayer 播放失败，最多保留 300 条。
- 播放请求通过 `PlaybackTraceInterceptor` 在 Gateway 签名后采集真实请求地址、参数、`n` nonce 和限长响应；内部追踪头发出请求前必须移除。下载请求不启用追踪，成功取链的追踪信息随 URL 缓存以关联后续播放器错误。
- 设置页“播放设置”进入 `PlaybackSettingsActivity`，其中“播放切换”继续沿用原自动切换列表行为；“更多设置”当前只提示暂未开放；Debug 构建中的“开发者调试”位于“故障上报”之前，“故障上报”进入 `FaultReportActivity`，展示当前总数、最近 7 天、待上报数、最近错误和上次上报时间。
- 故障上传走 `SystemApiService` 的 AES-GCM `POST /api/fault-reports`。未登录可匿名上报，登录时只携带 Bearer token 供服务端绑定用户 ID；成功后只能按本次提交的日志 UUID 更新 `is_upload=1`，不能全表无条件更新。

## 一起听补充

- Android 端一起听代码集中在 `listen/` 模块，包含 HTTP 仓库、Socket.IO 客户端、状态管理和服务端字段模型；播放器页只负责展示入口、房间面板和播放控制意图转发。
- 一起听二维码与扫码链接统一由 `ListenTogetherScanLink` 生成和解析：分享链接使用 `https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=<房间号>`，外部唤起使用 `pisamusic://scan`。侧栏扫码、播放器扫码和 Scheme 冷启动最终都交给 `PlayerActivity` 的同一加入流程；跨房间必须先确认、验证目标房间并等待旧房间离开 ACK。
- 播放器页一起听底部面板里的房间名、房间号、邀请码输入框使用 Material `TextInputLayout` 浮动标签样式；房间名默认值通过 `TextInputLayout.placeholderText` 承载，创建时空输入回退该占位值。
- 一起听 HTTP 接口沿用外层服务端地址；`GET /api/listen-together/config` 是明文接口，使用独立明文 Retrofit client；`POST /api/listen-together/rooms` 和 `GET /api/listen-together/rooms/:roomId` 继续走 `SystemApiService` 的 AES-GCM 加密链路。创建房间遇到 `USER_ALREADY_HAS_ROOM` 时先由播放器弹确认框，用户确认后才带 `replaceExisting=true` 重新创建。
- 一起听实时连接使用 `io.socket:socket.io-client`，连接时通过 Socket.IO `auth.token` 传 `Bearer <userToken>`；账号切换、退出房间、被踢出或房间销毁时必须断开 socket 并清空本地一起听状态。
- 一起听只支持在线歌曲，不支持 `SongType.LOCAL`；创建房间默认 `memberOperation=false`，房主可在房间面板切换“成员可操作”。成员未获授权时必须提示无权限并向服务端同步房间状态，不要本地抢控制权。
- 房主点击房间面板内其他成员的胶囊时，通过通用操作菜单执行“转让房主”或“移出成员”；自己的胶囊和普通成员看到的胶囊不可操作。两个动作必须二次确认，不做本地乐观更新，成员列表和房主身份继续以 Socket ACK 及 `MEMBER_KICKED` / `HOST_TRANSFERRED` 广播为准。
- 一起听开启后播放器队列面板展示房间专属队列，不能再使用本地 `MusicController.playList` 作为上一首、下一首、点歌或删除依据。房间队列不落服务端，由房主设备维护权威队列；服务端 `listen:queue` / `QUEUE_EVENT` 只负责校验成员并转发快照、增量和成员命令。
- 新成员加入时由房主通过 `QUEUE_EVENT` 分片发送队列快照，单片默认 200 首；常规队列变更由房主广播 `QUEUE_DELTA`，自然播放结束只允许房主决定下一首并发送 `listen:change_song`。
- 一起听切歌采用 latest-wins：`MusicController.playLatest` 是可等待、可取消的同步播放入口，旧 URL 解析结果不得覆盖后发歌曲。歌曲与队列指针只跟随 `CHANGE_SONG`，切歌链路使用 `transitionId`，队列指针优先使用 `queueItemId`；只有 ID 匹配的 `CHANGE_SONG` 广播或 ACK 可以提前解除切歌锁，心跳及其他进度事件不能解除。
- 新版 Android 对 `PLAY`、`PAUSE`、`SEEK`、`ENDED` 始终发送 `songRef { source, id }`；房主本地切歌尚未完成时暂停 6 秒心跳，待目标歌曲确认并发出 `CHANGE_SONG` 后再恢复，避免旧歌曲心跳污染新歌曲进度。

## 分享补充

- Android 音乐分享代码集中在 `share/` 模块：`ShareLink` 解析 / 生成 `https://pisamusic.partialy.cn/scan?type=music-share&uuid=<uuid>` 与 `pisamusic://scan?type=music-share&uuid=<uuid>`，`ShareRepository` 通过 `SystemApiService` 访问 `/api/shares`，`ShareQrBitmapFactory` 统一生成二维码并被一起听二维码复用。
- 歌曲和歌单分享入口复用 `SongMoreMenu`、`PlaylistActionBottomSheet` 与 `ShareBottomSheet`。创建分享必须读取 `AccountSessionStore`，未登录时只提示“请先登录后再分享”，不得创建分享记录；同一账号重复分享同一 `source:id` 时由服务端复用既有 uuid。
- 分享 Sheet 使用 `bottom_sheet_share.xml` 与 `include_share_info_header.xml`：顶部封面 + 标题 / 描述，二维码居中，链接区域使用一起听同款蓝色描边 Material `TextInputLayout` 的“链接分享”标签和右侧复制图标。
- 分享详情页为 `ShareDetailActivity`，使用原生 XML + ViewBinding，不使用 WebView。外部链接继续由 `SplashActivity` / `MainActivity` 的 `pisamusic://scan` 分发处理：先尝试一起听，再尝试 `ShareLink`，命中分享后进入 `ShareDetailActivity`；歌曲 / 歌单更多菜单里的“详情”使用本地 canonical 快照启动同一个 Activity，不调用分享接口、不生成 uuid。
- 分享详情的歌单来源必须复用 `SongSourceTagBinder`，显示与歌曲歌手尾部一致的 K / Y / W / LOCAL 标签，不单独展示平台名称。点击本地“详情”进入时歌单右侧动作复用 `ShareBottomSheet` 分享；UUID 分享唤醒进入时右侧动作收藏或取消收藏 KG/WY 歌单，不再提供复制 ID 按钮。
- `PlaylistActionBottomSheet` 是歌单更多菜单入口，网络歌单显示“收藏 / 取消收藏”、详情和分享，本地歌单不显示收藏动作；收藏状态和写入必须走 `PlaylistCollectionManager`，不要另建收藏存储。
- 分享 rawJson 只能使用 `CanonicalSong` / `CanonicalPlaylist` 快照，不要上传播放 URL、filePath、歌词正文、内嵌封面二进制；本地封面无法跨设备访问时应清空或显示默认封面。

## 通用 UI 组件补充

- 居中确认类弹窗优先使用 `cn.partialy.pm.ui.dialog.PmMinimalDialog`；它是 280dp 简约卡片样式，支持单/双按钮、隐藏标题、确认按钮文字颜色和深浅色资源自动适配。
- 需要居中承载自定义表单、列表、封面选择等内容时，使用 `cn.partialy.pm.ui.dialog.PmSlotDialog`；它复用 `PmMinimalDialog` 的 280dp 卡片、深浅色资源、入退场动画和底部 T 形按钮区。默认 `content slot` 可滚动；需要固定歌曲信息、封面头部等场景时使用 `header slot + content slot + 底部按钮` 三段式，只让中间选项或表单内容滚动。
- 一起听房间二维码使用 `ListenTogetherQrDialog`，内容承载在 `PmSlotDialog` 中，二维码编码官网加入链接并提供房间号复制。
- 带头像/封面信息头部、左侧图标和右侧文案的操作菜单使用 `cn.partialy.pm.ui.dialog.ActionMenuBottomSheet`；菜单动作在 Sheet 关闭后执行，歌曲更多菜单和一起听成员管理菜单复用该容器。
- 旧 `ModernDialog` 仍保留给下载进度、底部弹窗和单选弹窗等既有场景；不要为了普通确认弹窗继续扩展它。
- 业务消息或自定义通知优先调用 `BaseActivity.showMessage(content, durationMs)`；它用于区别于系统默认 `Toast` 的业务提示，展示为屏幕高度 25% 处的半透明黑色胶囊轻通知，并返回可立即淡出关闭的函数。

## 全局异常处理补充

- Android 全局未捕获异常统一由 `cn.partialy.pm.utils.GlobalExceptionHandler` 处理，并在 `App.onCreate()` 中通过 `GlobalExceptionHandler.init(this, BuildConfig.DEBUG)` 初始化；不要在 `App` 或 Activity 中再次调用 `Thread.setDefaultUncaughtExceptionHandler` 覆盖它。
- Debug 模式下主线程异常使用 SafeLooper 风格保护并通过 `PmMinimalDialog` 展示可滚动、可选择、可复制的堆栈；后台线程异常也会记录日志并弹出同样的堆栈提示。Release 模式下主线程致命异常仍交给系统默认处理，避免强行继续运行导致黑屏或卡死。
- `PmMinimalDialog` 的长文本、可选择文本和按钮点击后不关闭能力用于异常弹窗等特殊场景；普通确认弹窗继续保持默认居中短文案和点击按钮关闭的行为。
## 本地歌曲索引补充

## 账号手机号与操作加载态补充

- 账号认证同时支持邮箱和 11 位大陆手机号：`/api/auth/email-code` 与 `/api/auth/phone-code` 分别发送验证码，`/api/auth/login/code`、`/api/auth/register`、`/api/auth/password/reset` 的邮箱/手机号字段二选一；验证码登录对未注册联系人执行自动注册。
- 注册、找回密码页面使用底部邮箱/手机号切换；登录页面保留密码、邮箱验证码、手机号验证码三种模式。发送验证码和提交操作在网络等待期间必须显示并旋转现有 `ic_loading_loop_24`，结束后恢复按钮文本/倒计时。
- 本地账号 session 保存 `phone`；个人资料页邮箱和手机号均按前三位 + 六个星号 + 后两位展示，点击对应行进入换绑流程，手机号通过 `/api/auth/profile/phone-code` 与 `PATCH /api/auth/profile` 完成。

- 本地歌曲列表不再直接把 MediaStore 查询结果作为运行时唯一来源；`pm_local_music.db` 的 `local_songs` 表是本地歌曲索引，`origin=media_store` 表示系统媒体库扫描项，`origin=imported_uri` 表示用户通过文件选择器导入的外部文档引用。
- 进入本地歌曲页或编辑页时只读取 `local_songs` 中未删除的已导入记录，不再自动同步 MediaStore 入库；系统媒体库歌曲必须通过“扫描歌曲”页预览、勾选并点击“导入”后才写入。
- “扫描歌曲”页支持全盘 MediaStore 扫描和自定义文件夹扫描，默认过滤 60s 以下歌曲；扫描结果先展示为可取消勾选的候选列表，已存在歌曲标记为“已存在”且不重复导入。系统库中已消失的 `media_store` 记录如需清理时标记 `is_deleted=1`，不要物理删除历史记录。
- “导入歌曲”只记录 `content://` 引用和元信息，并申请持久读取权限，不复制音频文件；重复过滤优先按 `content_uri`，其次按 `media_store_id`，再按 `display_name + size + duration` 兜底。
- 编辑列表删除默认只移除 SQLite 引用；用户勾选“一并删除本地文件”时再尝试删除原始文件。删除授权失败时仍保留列表移除结果，并提示原文件可能未删除。

## 公告模块规范

- 公告数据模型使用结构化 `AnnouncementContent`（`schemaVersion=1`，含 `Text`、`Image`、`Highlight` 区块），全面替代旧 HTML 字符串拼接；图片由 Coil 异步加载。
- 高亮动作（`AnnouncementAction`）支持复制（`copy`）、链接（`url`，https 校验，支持系统浏览器/应用内打开）与内置协议（`protocol`，pisamusic 协议校验）；高亮文本仅 `url` 和 `protocol` 显示下划线，`copy` 动作复用现有 `ic_copy_24` 图标无下划线。
- App 启动与首页公告展示保留底部弹窗（`BottomSheetDialog` + `layout_announcement_bottom_sheet.xml`），由 `AnnouncementContentRenderer` 进行原生富文本渲染，隐藏滚动条但保留滚动。
- 启动时仅弹出最新一条未读公告，若公告属于每次弹出类型（`showEveryTime=true`）也同样弹出；确认或前往后写入已读（`!showEveryTime`），不再连续弹出多条。
- 首页顶部不显示额外公告卡片列表；设置页保持原有原生列表单页结构。
