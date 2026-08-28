# Android 云盘音乐对接实施计划

> 状态：仅计划，尚未执行。  
> 执行边界：只改 `server/` 的公共契约补充和 `pm/` Android 客户端；不改 `yixi/`。  
> 验证边界：只做语法检查、Kotlin 编译和 Debug 打包，不安装、不启动，真机流程由用户验收。

## 目标

把 Android 首页 Header 的第二个 Tab 从“音乐”替换为“云盘”，接入 server 独立的 `cloud` 音源：支持漂亮、干净、符合现有 App 风格的统计卡片、搜索、每页 20 条滚动分页、歌曲常用操作、唯一“默认”音质、server 播放地址及歌词地址获取，并增加“我要投稿”占位 Activity。

## 用户可见结果

- 首页第二个 Tab 显示“云盘”，点击后不再进入原首页收藏列表；“我的收藏”原有独立入口保持不变。
- 页面从上到下依次为：云盘概览卡片、M3 搜索框、歌曲列表。
- 概览卡片展示“共享歌曲：n 首”“最近更新：yyyy-M-d”，右侧为带分享同款图标的蓝色圆角 M3“我要投稿”按钮。
- “我要投稿”进入独立 Activity；本期只展示精致占位状态，不实现上传和投稿表单。
- 空关键词展示全部可搜索曲目；输入关键词搜索歌名、歌手或专辑；固定每页 20 条并滚动加载。
- 云盘歌曲音源固定为 `cloud`，列表标记为青绿色方块 `C`；音质只有“默认”。
- `active` 歌曲可播放、下一首、下载、收藏、分享、查看详情、加入歌单；`disabled` 可搜索和查看，但不能获取播放地址，客户端同步禁用播放类操作并展示“已禁用”。

## 先决条件与关键决策

### 1. 复用现有 server 公共接口

当前接口继续保持：

- `GET /api/cloud-music/search?keyword&offset&limit`
- `GET /api/cloud-music/tracks/:uuid`
- `GET /api/cloud-music/tracks/:uuid/play-url`
- `GET /api/cloud-music/tracks/:uuid/lyrics-url`

搜索结果为 `{ source: "cloud", items, total, offset, limit }`；客户端显式传 `limit=20`。曲目 `playable=false` 时，不发起播放/下一首/下载；即使 UI 漏拦截，server 的播放接口仍以 403 兜底。

### 2. 公共 server 契约补充只执行一次

Android 和 PC 两份计划都依赖下面三项补充。先执行任意一份计划的人完成一次即可；执行另一份计划时只核对接口和文档，禁止重复实现或产生两套路径。

1. 新增 `GET /api/cloud-music/summary`：返回 `{ total: number, latestUpdatedAt: number | null }`，统计范围与公开搜索一致，即 `active + disabled`。不要通过“取第一页第一首”猜最近更新时间。
2. 新增稳定封面入口 `GET /api/cloud-music/tracks/:uuid/cover`：
   - 公开 DTO 的 `cover.url` 改为该稳定相对路径，不再下发会过期的七牛签名 URL。
   - 上传/内嵌封面由该入口 302 到即时生成的私有签名 URL；默认封面 302 到 `/static/cloud-music/default-cover.svg`。
   - 只允许 `active + disabled`，响应加 `Cache-Control: no-store`，避免客户端缓存已经过期的重定向地址。
   - 该图片入口加入现有强制明文路径配置，使 Coil 可以直接加载；签名、bucket 和对象 key 不进入 renderer/Android 持久化数据。
3. `lyrics-url` 成功结果增加 `format: "lrc" | "txt"`，保留原字段，作为向后兼容扩展。

涉及文件：

- `server/src/db/cloudMusicStore.ts`
- `server/src/services/cloudMusicService.ts`
- `server/src/routes/cloudMusic.ts`
- `server/src/index.ts`
- `server/apidoc/cloudMusic/getSummary.md`
- `server/apidoc/cloudMusic/getCover.md`
- `server/apidoc/cloudMusic/getLyricsUrl.md`
- `server/apidoc/index.md`

完成后只运行 `pnpm --dir server build` 和 `git diff --check`；这部分由两端计划共享，不重复提交。

### 3. 本期明确不接“一起听”和持久播放缓存

- 当前 Android、PC、server 的一起听歌曲来源联合类型没有 `cloud`。本期在云盘歌曲菜单中隐藏或禁用“一起听”，提示“云盘歌曲暂不支持一起听”；后续用单独跨三端任务扩展协议。
- 为保证后台把歌曲设为 `disabled` 后立即失去播放能力，首期云盘歌曲不进入 Android 在线播放持久缓存。每次播放、下一首和下载都先向 server 获取新 URL；不能用旧缓存绕过状态撤销。
- 播放地址、歌词签名地址永不写入收藏、歌单、分享记录或数据库；只在当前请求内使用。

## UI 设计规范

实现前再次对照 `pm/design-html/components.md`，优先复用已有 Material 组件、主题色、间距、圆角、列表行和加载状态。

### 页面布局

- 页面根布局沿用首页 Fragment 的安全区和底部迷你播放器避让方式，主体使用 `SwipeRefreshLayout + RecyclerView`，避免嵌套滚动冲突。
- 左右边距统一 `16dp`；卡片与搜索框间距 `12dp`；搜索框与列表间距 `8dp`。
- 概览卡片圆角 `18dp`，使用很浅的 primary/青绿色表面色和 1dp 柔和描边；不使用厚阴影、大面积渐变或高饱和背景。
- 卡片内主信息“共享歌曲”字号和字重高于“最近更新”；日期只显示到天，没有记录时显示“暂无更新”。
- “我要投稿”使用 `MaterialButton`：primary 蓝色实底、白字、`16dp` 圆角、最小高度 `40dp`、图标 `@drawable/ic_share_24`，图标与文字间距 `8dp`。
- 搜索使用 M3 `TextInputLayout + TextInputEditText`，占位“搜索云盘歌曲”，前置搜索图标，后置一键清除，单行输入。
- 列表行复用现有普通歌曲行的密度和信息层级：`40dp` 圆角封面、歌名、歌手/专辑、时长、更多菜单；不要设计成另一套“后台表格”风格。
- `C` 标签为 `16dp` 青绿色圆角方块，字母居中，浅色/深色主题均保证对比度。
- 初次加载使用与歌曲列表一致的骨架；加载下一页只在尾部显示小型进度；空结果和错误使用简洁插图/图标、短文案和重试按钮。

### 状态与可访问性

- `disabled` 行整体降低次要文字强调度，歌名仍可读；在来源标签旁显示“已禁用”。点击播放区域给出“该歌曲已禁用，暂时无法播放”。
- 所有图标按钮设置 `contentDescription`；触控热区不小于 `48dp`。
- 深色主题单独配置表面色和云盘标签色，不硬编码只适合浅色背景的颜色。
- 列表加载、空态和错误态互斥，避免骨架、旧列表与错误文案同时显示。

## 数据模型与接口契约

新增 `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicModels.kt`：

```kotlin
data class CloudMusicSummaryResponse(
    val success: Boolean,
    val code: Int,
    val msg: String,
    val data: CloudMusicSummaryData?,
)

data class CloudMusicSummaryData(
    val total: Int,
    val latestUpdatedAt: Long?,
)

data class CloudMusicSearchData(
    val source: String,
    val items: List<CloudMusicTrackDto>,
    val total: Int,
    val offset: Int,
    val limit: Int,
)

data class CloudMusicTrackDto(
    val uuid: String,
    val source: String,
    val title: String,
    val artist: String,
    val album: String?,
    val durationMs: Long?,
    val format: String,
    val playable: Boolean,
    val cover: CloudMusicCoverDto,
    val lyrics: CloudMusicLyricsDto?,
    val createdAt: Long,
    val updatedAt: Long,
)

data class CloudMusicResourceUrlData(
    val uuid: String,
    val source: String,
    val url: String,
    val expiresAt: Long,
    val format: String? = null,
)
```

公共响应继续沿用项目现有 `success/code/msg/data` 风格。若项目已有可复用的泛型响应模型，执行时改为复用，不再平行创造第二套响应壳。

## 实施任务

### Task 0：补齐共享 server 公共契约

**修改文件**

- `server/src/db/cloudMusicStore.ts`
- `server/src/services/cloudMusicService.ts`
- `server/src/routes/cloudMusic.ts`
- `server/src/index.ts`
- `server/apidoc/cloudMusic/getSummary.md`
- `server/apidoc/cloudMusic/getCover.md`
- `server/apidoc/cloudMusic/getLyricsUrl.md`
- `server/apidoc/index.md`

**步骤**

1. 在 store 增加公开汇总查询，一条 SQL 返回可搜索状态的 `COUNT(*)` 和 `MAX(updated_at)`。
2. service 统一校验公开状态、生成稳定封面路径、签发即时封面/歌词 URL。
3. route 增加 summary 和 cover；cover 只做参数校验、调用 service、设置响应头并 302，不把存储逻辑写进 route。
4. `lyrics-url` 返回资源格式；更新接口文档与索引。
5. 运行 `pnpm --dir server build`、`git diff --check`。

**提交建议**

`功能（server）：补齐网盘音乐公共展示契约`

### Task 1：增加 Android 云盘网络层和分页状态层

**新增文件**

- `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicModels.kt`
- `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicRepository.kt`
- `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/CloudMusicViewModel.kt`

**修改文件**

- `pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`
- `pm/app/src/main/java/cn/partialy/pm/di/NetworkModule.kt`

**步骤**

1. 在 `SystemApiService` 增加 summary、search、detail、play-url、lyrics-url 方法，全部走已有 system Retrofit、运行时服务发现、AES 和错误处理，不接 KG/WY/KW 网关。
2. Repository 负责响应码校验、DTO 转换、相对封面地址解析和歌词文本下载；Fragment 不直接访问 Retrofit。
3. 增加专用于已签发资源 URL 的干净 OkHttp client。它不添加 system AES 或音乐网关 header，只允许请求 server 返回的 HTTPS URL；执行时复用项目已有安全下载 client 优先，不重复造轮子。
4. `CloudMusicViewModel` 固定 `PAGE_SIZE = 20`，状态至少包含：
   - `keyword/items/total/latestUpdatedAt`
   - `nextOffset/hasMore`
   - `initialLoading/loadingMore/refreshing`
   - `error`
5. 搜索输入防抖 300ms；新关键词取消旧协程并递增请求序号，旧响应即使晚到也不能覆盖新结果。
6. 空关键词调用 search 但不传 keyword，展示全量；首屏和刷新从 offset 0 替换列表，下一页按 UUID 去重后追加。
7. 滚动到倒数第 5 行时加载下一页；同一时刻只允许一个 load-more 请求。

**完成标准**

- 快速连续输入不会闪回旧关键词结果。
- 首次失败可重试，加载下一页失败保留已有列表。
- 下拉刷新保留当前关键词，并同时刷新 summary 与第一页。

### Task 2：把 `cloud` 纳入 Android 歌曲模型和统一来源展示

**修改文件**

- `pm/app/src/main/java/cn/partialy/pm/model/SongInfo.kt`
- `pm/app/src/main/java/cn/partialy/pm/model/CanonicalMusicModels.kt`
- `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt`
- `pm/app/src/main/java/cn/partialy/pm/utils/SongCoverUrl.kt`
- `pm/app/src/main/res/values/strings.xml`
- `pm/app/src/main/res/values/colors.xml`
- `pm/app/src/main/res/values-night/colors.xml`

**步骤**

1. `SongType` 增加 `CLOUD`，canonical source 双向映射固定为小写 `cloud`。
2. 为 `SongInfo` 增加向后兼容字段 `playable: Boolean = true`，旧音源和本地歌曲不需要改调用方。
3. DTO 转换：`uuid -> id`、`title -> name`、`artist -> artist`、`durationMs / 1000 -> duration`、稳定 cover route -> `coverUrl`。
4. 来源标签绑定增加 `CLOUD -> C`；颜色使用语义资源，例如浅色 `#14B8A6`，深色前景可用 `#5EEAD4`，最终按当前主题对比度微调。
5. `SongCoverUrl` 对 cloud 不拼第三方裁剪参数；默认 SVG 不直接交给当前未配置 SVG 解码器的 Coil，`cover.source == default` 时使用本地 `R.drawable.ic_pm_icon`。
6. 检查收藏、歌单、分享序列化的来源解析，确保未知来源不会把 `cloud` 回退成 KG。

### Task 3：实现漂亮、干净的云盘主页并替换首页第二 Tab

**新增文件**

- `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/CloudMusicFragment.kt`
- `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/CloudMusicListAdapter.kt`
- `pm/app/src/main/res/layout/fragment_cloud_music.xml`
- `pm/app/src/main/res/layout/item_cloud_music_song.xml`
- `pm/app/src/main/res/drawable/bg_cloud_overview_card.xml`
- `pm/app/src/main/res/drawable/bg_source_tag_cloud.xml`

**修改文件**

- `pm/app/src/main/java/cn/partialy/pm/ui/home/HomeFragmentStateAdapter.kt`
- `pm/app/src/main/java/cn/partialy/pm/activity/MainActivity.kt`
- `pm/app/src/main/res/layout/activity_main.xml`
- `pm/app/src/main/res/values/strings.xml`

**步骤**

1. 将 `home_tab_favorite` 文案调整为“云盘”；布局 ID 可暂时保留，避免为了命名做大面积无价值改动。
2. `HomeFragmentStateAdapter` 的 position 1 改为 `CloudMusicFragment`。
3. 清理 `MainActivity` 对 position 1 的 `FavoriteSongsFragment` 强制刷新和因收藏数量变化而重建 pager 的逻辑，避免云盘翻页/搜索状态被收藏变化重置；保留“我的收藏”独立页面刷新。
4. Fragment 采用单 RecyclerView 多类型 Adapter：header item 包含概览卡和搜索框，song item 展示曲目，footer item 展示加载更多/到底。这样保证只有一套滚动容器。
5. Adapter 复用现有歌曲行的封面加载、时长格式、播放态高亮和更多菜单入口；只把 cloud 专属的 `C`、`playable` 状态作为薄适配层。
6. 搜索框文字变化只提交 ViewModel，不在 Fragment 手写请求；IME 搜索键立即提交当前关键词。
7. 对初次加载、刷新、加载更多、无数据、无搜索结果、网络错误分别渲染互斥状态。
8. 点击卡片“我要投稿”启动投稿占位 Activity；使用现有 Activity 转场。

### Task 4：接入播放、默认音质、歌词与下载

**修改文件**

- `pm/app/src/main/java/cn/partialy/pm/player/PlayUrlGetter.kt`
- `pm/app/src/main/java/cn/partialy/pm/player/MediaItemFactory.kt`
- `pm/app/src/main/java/cn/partialy/pm/model/DownloadQualityChoice.kt`
- `pm/app/src/main/java/cn/partialy/pm/model/MusicQualityAccessPolicy.kt`
- `pm/app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`
- `pm/app/src/main/java/cn/partialy/pm/activity/base/BaseDownloadActivity.kt`
- `pm/app/src/main/java/cn/partialy/pm/utils/DownloadManager.kt`
- `pm/app/src/main/java/cn/partialy/pm/lyric/LyricRepository.kt`
- `pm/app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt`
- Android 媒体缓存入口中负责 `SongType` 分流的现有文件

**步骤**

1. `CLOUD` 播放只调用 `/play-url`，质量 key 固定 `cloud:default`；不经过第三方网关、Cookie 或 VIP 权限策略。
2. 音质弹窗遇到 cloud 只显示一个可用项“默认”，不得显示 KG/WY/KW 档位。
3. `MusicQualityAccessPolicy` 对 cloud 默认音质始终允许；是否可播只看 `playable` 和 server 返回。
4. 歌词先调用 `/lyrics-url`，再用资源 client 拉取文本；`lrc` 走现有解析器，`txt` 按行构造成无时间轴歌词/纯文本展示。
5. 下载固定使用默认音质和 server 临时 URL；下载开始前重新取 URL，持久化记录只保存 cloud UUID 和 `cloud:default`。
6. 媒体缓存分流明确排除 `CLOUD`；不把临时 URL 写入 cache key、数据库或播放队列。
7. 现有 KG/WY/KW 播放地址故障上报不要把 cloud 错误伪装成第三方音源；若需要记录，只走通用网络错误或以后扩展 server 的 fault-report source 枚举。

### Task 5：复用普通歌曲操作并增加投稿占位页

**新增文件**

- `pm/app/src/main/java/cn/partialy/pm/activity/CloudMusicSubmissionActivity.kt`
- `pm/app/src/main/res/layout/activity_cloud_music_submission.xml`

**修改文件**

- `pm/app/src/main/AndroidManifest.xml`
- 现有歌曲更多菜单、分享详情和播放命令中按 `SongType` 分流的文件
- `pm/app/src/main/res/values/strings.xml`

**步骤**

1. cloud 复用收藏、分享、歌曲详情、加入歌单、下一首、下载等现有 service/manager；不要在 Fragment 复制业务逻辑。
2. 所有播放类命令在统一命令入口再次检查 `playable`，不能只靠按钮置灰。
3. disabled 隐藏或禁用“播放、下一首、下载”，保留“收藏、分享、详情、加入歌单”。
4. 分享和详情来源标记补 `C`，分享 payload 继续使用 `{ source: "cloud", id: uuid }`，封面只保存稳定 route。
5. 一起听入口对 cloud 禁用并说明暂不支持。
6. 投稿 Activity 注册 `exported=false`，使用项目主题、edge-to-edge 和返回导航；内容为居中的分享图标、标题“我要投稿”、说明“投稿功能正在准备中”，不放假输入框或不可用提交按钮。

### Task 6：同步项目说明并做轻量校验

**修改文件**

- `pm/AGENTS.md`
- `pm/design-html/components.md`
- 根目录 `AGENTS.md`

**步骤**

1. 记录首页第二 Tab 已改为云盘、cloud 来源、server 取链/歌词、单一默认音质、分页大小、禁用态和暂不支持一起听/持久缓存。
2. 在组件索引补充概览卡片、云盘来源标签和投稿占位页的复用说明。
3. 执行：

```powershell
git diff --check
.\pm\gradlew.bat -p pm :app:compileDebugKotlin
.\pm\gradlew.bat -p pm assembleDebug
git status --short
```

4. 不运行完整单元测试，不安装 APK，不启动模拟器。

**提交建议**

客户端改动单独提交：

`功能（pm）：接入云盘音乐浏览与播放`

## 手工验收清单

- 首页 Header 第二项准确显示“云盘”，收藏入口仍可从“我的”正常进入。
- 概览卡片在浅色/深色模式都简洁清楚；统计和最近更新与后台数据一致。
- 投稿按钮是 primary 蓝色 M3 圆角按钮，使用分享同款图标，进入独立占位 Activity。
- 无关键词每页 20 条；触底追加；刷新不重复；快速输入不出现旧结果覆盖。
- 歌曲行与普通歌曲视觉一致，来源显示青绿色 `C`，只有“默认”音质。
- active 曲目播放、歌词、下一首、下载、收藏、分享、详情、加入歌单正常。
- disabled 曲目仍能搜到，但所有播放类入口不可用；不能通过缓存或旧 URL 播放。
- 断网、空数据、搜索无结果、首屏失败、下一页失败都有明确且不杂乱的状态。
- 云盘播放/歌词请求命中外层 server，而不是 KG/WY/KW 网关。

## 不在本期范围

- 用户上传、投稿表单、上传进度和审核状态页。
- 云盘歌曲一起听协议。
- 云盘在线播放持久缓存。
- 管理后台 CRUD、审核和清理逻辑（已由 server 计划负责）。
