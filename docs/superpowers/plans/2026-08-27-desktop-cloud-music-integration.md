# PC 云盘音乐对接实施计划

> 状态：仅计划，尚未执行。  
> 执行边界：只改 `server/` 的公共契约补充和 `yixi/` Electron 客户端；不改 `pm/`。  
> 验证边界：只做 diff、类型检查和受影响的聚焦测试，不打包、不启动 Electron，界面和播放流程由用户验收。

## 目标

在 PC 左侧导航增加“云盘”，实现一个漂亮、干净、符合 PisaMusic 桌面端现有风格的“共享云盘”页面：复用收藏页和统一 SongList 的视觉与交互，展示概览数据、工具条、搜索、每页 20 条滚动分页和投稿入口；将 server 的独立 `cloud` 音源完整接入歌曲模型、播放、歌词、默认音质、下载、收藏、分享、详情和歌单操作。

## 用户可见结果

- 左侧导航在“收藏”和“我的”之间增加“云盘”，图标使用 Lucide 云朵/云音乐语义图标。
- 云盘主路由为 `/cloud`，页面标题“共享云盘”。
- 顶部是轻量概览卡片，展示“共享歌曲 n 首”和“最近更新 yyyy-M-d”；下方工具条包含“播放全部”、搜索框、“我要投稿”。
- “我要投稿”按钮使用 primary 蓝色、圆角、分享图标，进入 `/cloud/submit`；本期只做视觉完整的占位页面。
- 空关键词展示全部可搜索歌曲；输入后搜索 server；每页 20 条，滚动到底继续加载。
- 歌曲仍使用现有 SongList/CommonSongItem/ContextMenu，不设计第二套歌曲列表；来源显示青绿色方块 `C`，音质只有“默认”。
- `disabled` 歌曲可被搜索、收藏、分享、查看详情和加入歌单，但不能播放、下一首、加入播放队列或下载。

## 先决条件与关键决策

### 1. 复用现有 server 公共接口

继续使用：

- `GET /api/cloud-music/search?keyword&offset&limit`
- `GET /api/cloud-music/tracks/:uuid`
- `GET /api/cloud-music/tracks/:uuid/play-url`
- `GET /api/cloud-music/tracks/:uuid/lyrics-url`

搜索数据为 `{ source: "cloud", items, total, offset, limit }`，PC 显式传 `limit=20`。所有调用由 Electron main 侧完成；renderer 不读取 service origin、不持有 AES 细节、不直接请求系统接口。

### 2. 公共 server 契约补充只执行一次

本计划与 Android 计划共享以下先决任务。若 Android 计划已经实现并提交，只验证接口与文档后跳过，不复制 service 或 route。

1. 新增 `GET /api/cloud-music/summary`，返回 `{ total, latestUpdatedAt }`，统计 `active + disabled`。
2. 新增 `GET /api/cloud-music/tracks/:uuid/cover` 稳定封面入口：公开 DTO 只保存该相对路径，入口按请求即时 302 到七牛签名 URL；默认封面跳到静态 SVG；只允许公开状态并加 `Cache-Control: no-store`。
3. `lyrics-url` 增加 `format: "lrc" | "txt"`，不删除既有字段。
4. cover 路径加入 server 现有强制明文配置，保证 Electron 图片加载器能直接访问。

共享修改文件：

- `server/src/db/cloudMusicStore.ts`
- `server/src/services/cloudMusicService.ts`
- `server/src/routes/cloudMusic.ts`
- `server/src/index.ts`
- `server/apidoc/cloudMusic/getSummary.md`
- `server/apidoc/cloudMusic/getCover.md`
- `server/apidoc/cloudMusic/getLyricsUrl.md`
- `server/apidoc/index.md`

共享验证：`pnpm --dir server build`、`git diff --check`。

### 3. 首期不支持一起听和持久播放缓存

- 现有 Android、PC、server 一起听协议均没有 `cloud` source。本期在统一命令层明确拒绝 cloud 一起听，并提示“云盘歌曲暂不支持一起听”；后续另做三端协议升级。
- 首期将 cloud 排除在 PC 在线媒体持久缓存之外。原因是 `disabled` 必须立即不能播放；如果已完整缓存仍可直接播放，会绕过 server 的 403 撤权。
- 播放和下载每次向 server 重新签发 URL；临时 play/lyrics URL 不进入 Song、收藏、歌单、分享、队列、SQLite 或 cache key。

## UI 设计规范

### 视觉方向

- 参考 `yixi/src/views/favorite.vue` 的标题收起、工具条、搜索框和 SongList 布局，但不是机械复制：云盘增加一张轻量统计卡片，整体仍属于同一产品。
- 页面背景、文字、描边、hover、阴影全部使用现有 CSS 变量和 Naive UI theme token；不要硬编码只适合浅色模式的大片白色。
- 视觉关键词：留白充足、层级克制、边框轻、动效短、按钮明确。避免厚重拟物阴影、复杂渐变、彩色信息堆叠和后台管理表格感。
- 页面左右内容边距与收藏页一致；标题、概览卡、工具条、列表纵向间距形成稳定的 8/12/16/24px 节奏。

### 概览卡片与工具条

- 概览卡片使用约 `18px` 圆角、柔和 primary/teal surface、1px 半透明边框和非常轻的阴影。
- 左侧标题“共享云盘”，统计区域以两个紧凑信息块展示总数和最近更新；数字/日期为主，说明文字为次。
- 工具条提供：
  - “播放全部”：primary，跳过 disabled，若有跳过项用一次 message 提示数量。
  - 搜索：`n-input` round + clearable + Search 前缀，默认宽度适中，聚焦可平滑展开，placeholder 为“搜索云盘歌曲”。
  - “我要投稿”：primary 蓝色圆角按钮，图标 `Share2`，视觉权重不压过“播放全部”。
- 窄窗口允许工具条换行，但搜索框不能被压到不可用；列表仍占满剩余高度。

### 列表和状态

- 复用 `SongList.vue`、`CommonSongItem.vue` 和 `ContextMenu.vue`，保留虚拟列表、封面、歌名歌手、收藏、专辑、时长和操作列。
- cloud 来源标签显示青绿色方块 `C`，使用全局 `--color-source-cloud`；浅色和深色主题分别保证文字可读。
- disabled 行保持可读但降低强调，附“已禁用”；双击、播放图标、下一首、下载均不能触发。
- 初次加载使用现有列表骨架；加载更多只显示尾部细进度；空云盘、搜索无结果、网络错误分别使用短文案和重试动作，不出现多个叠加状态。
- 投稿占位页复用全局 Header 返回行为，主体居中显示分享图标、标题“我要投稿”、说明“投稿功能正在准备中”；不出现假表单。

## 类型与 IPC 契约

新增 `yixi/src/types/cloudMusic.ts`，主进程可以复用或在 `electron/cloudMusic` 下定义对等 transport 类型：

```ts
export interface CloudMusicSummary {
  total: number;
  latestUpdatedAt: number | null;
}

export interface CloudMusicTrackDto {
  uuid: string;
  source: "cloud";
  title: string;
  artist: string;
  album: string | null;
  durationMs: number | null;
  format: string;
  playable: boolean;
  cover: { source: "uploaded" | "embedded" | "default"; url: string };
  lyrics: { format: "lrc" | "txt"; fileName: string } | null;
  createdAt: number;
  updatedAt: number;
}

export interface CloudMusicSearchResult {
  source: "cloud";
  items: CloudMusicTrackDto[];
  total: number;
  offset: number;
  limit: number;
}

export interface CloudMusicResourceUrl {
  uuid: string;
  source: "cloud";
  url: string;
  expiresAt: number;
  format?: "lrc" | "txt";
}
```

Renderer 只暴露以下 preload API，不暴露任意 URL 请求能力：

```ts
cloudMusic: {
  getSummary(): Promise<CloudMusicSummary>;
  search(input: { keyword?: string; offset: number; limit: 20 }): Promise<CloudMusicSearchResult>;
  getTrack(uuid: string): Promise<CloudMusicTrackDto>;
}
```

播放、歌词和下载继续经过现有 `music:*` / `download:*` IPC，在 main 的 source 分流里调用 cloud client；不额外把签名 URL 回传给页面业务层。

DTO 转统一 Song：

```ts
function toCloudSong(track: CloudMusicTrackDto): Song {
  return {
    id: track.uuid,
    urlParam: track.uuid,
    source: "cloud",
    name: track.title,
    singer: track.artist,
    album: track.album ?? "",
    duration: track.durationMs ?? 0,
    cover: track.cover.url,
    playable: track.playable,
  };
}
```

`cover.url` 在 main 侧通过现有 system origin 解析为稳定绝对 URL后再传 renderer；不能使用第三方网关 base URL。

## 实施任务

### Task 0：补齐共享 server 公共展示契约

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

1. store 一次查询 `active + disabled` 的总数和最大更新时间。
2. service 统一构造 stable cover route，并保留对象 key 只在服务端内部。
3. route 新增 summary/cover，cover 即时签发并 302；route 不直接查库。
4. lyrics-url 增加格式字段，更新接口文档和总索引。
5. 运行 `pnpm --dir server build`、`git diff --check`。

**提交建议**

`功能（server）：补齐网盘音乐公共展示契约`

### Task 1：建立 main 侧 cloud client、IPC 和 preload 边界

**新增文件**

- `yixi/electron/cloudMusic/cloudMusicClient.ts`
- `yixi/electron/ipc/cloudMusicIpc.ts`
- `yixi/src/types/cloudMusic.ts`
- `yixi/src/utils/api/cloudMusicAPI.ts`

**修改文件**

- `yixi/electron/system/systemClient.ts`
- `yixi/electron/main.ts`
- `yixi/electron/preload.ts`
- `yixi/src/types/electron.d.ts`

**步骤**

1. `cloudMusicClient` 复用 `requestSystem<T>()` 和 service discovery，封装 summary/search/detail/play-url/lyrics-url；统一在 main 校验 envelope 并转换相对封面 URL。
2. 若 `absoluteSystemUrl` 仍为私有函数，改为最小导出或提供语义更清晰的 `resolveSystemAssetUrl()`；不要在 cloud client 再复制 base URL 逻辑。
3. IPC 只注册固定 channel：`cloud-music:summary/search/detail`，对 keyword 做 trim，对 offset/limit 做整数和范围校验，limit 强制为 20。
4. preload 暴露最小 typed API；renderer API wrapper 只负责调用和错误转换。
5. play-url 和 lyrics-url 不进入 preload cloud API，继续隐藏在 main 的播放器/歌词/下载 service 内。

**完成标准**

- renderer 代码中没有 server origin、AES header 或七牛签名生成逻辑。
- IPC 不接受任意 path/url，不能退化成通用代理。

### Task 2：将 `cloud` 加入统一 Song、持久化和来源标签

**修改文件**

- `yixi/src/types/song.d.ts`
- `yixi/src/utils/song.ts`
- Electron SQLite 歌曲类型与 normalize 函数所在文件
- `yixi/src/types/electron.d.ts`
- `yixi/src/components/search/CommonSongItem.vue`
- `yixi/src/components/common/ContextMenu.vue`
- `yixi/src/views/media/MediaDetailView.vue`
- `yixi/src/components/media/MediaDetailDialog.vue`
- `yixi/src/share/shareModels.ts`
- `yixi/src/assets/css/base.css`

**步骤**

1. 所有受控 source 联合类型增加 `"cloud"`；CommonPlaylist source 是否需要 cloud 取决于现有语义，本期只让歌曲/收藏项支持 cloud，不虚构云盘歌单。
2. `Song` 增加 `playable?: boolean`，默认 `undefined` 视为可播，以保持旧数据兼容。
3. 数据库读写、收藏、队列、分享、详情 normalize 必须保留 `source="cloud"` 和 `playable`，不能把未知 source 回退为 KG。
4. 播放中、高亮和去重统一使用 `source + id`，修正仍只比较裸 `id` 的云盘相关路径，避免不同来源相同 UUID/id 串台。
5. 通用来源标签增加 `cloud -> C`；CSS 定义 `--color-source-cloud`，青绿色与现有 K/W 等方块保持同尺寸、圆角和字重。
6. cloud 详情打开时调用 detail 获取最新 `playable` 和稳定封面，持久化旧记录只作为基本信息 fallback。

### Task 3：增加左侧“云盘”导航、主页面和投稿占位路由

**新增文件**

- `yixi/src/views/cloud/CloudMusicView.vue`
- `yixi/src/views/cloud/CloudSubmitPlaceholderView.vue`
- `yixi/src/components/cloud/CloudOverviewCard.vue`
- `yixi/src/cloud/useCloudMusicList.ts`

**修改文件**

- `yixi/src/router/index.ts`
- `yixi/src/layout/MainLayout.vue`

**步骤**

1. 添加 `/cloud` 和 `/cloud/submit` 两个懒加载子路由；二者的侧栏 active key 都映射为 `cloud`。
2. 左侧菜单在“收藏”和“我的”之间加入“云盘”，使用 Lucide 图标并接入 `handleChangeMenu`。
3. `CloudOverviewCard` 只负责展示 summary 和触发投稿事件；不直接请求 API。
4. `CloudMusicView` 负责页面组合：标题/概览卡、工具条、SongList、状态区；数据请求和分页状态放入 `useCloudMusicList`。
5. 复用 `useCollapsiblePageHeader`，滚动时标题收起方式与收藏页一致；概览卡可随 header 收起，工具条保留清晰操作位置。
6. 投稿路由只呈现完整空态并支持返回；不创建临时上传 API 或失效表单。

### Task 4：实现 20 条分页、可取消搜索和列表复用

**修改文件**

- `yixi/src/cloud/useCloudMusicList.ts`
- `yixi/src/views/cloud/CloudMusicView.vue`
- `yixi/src/components/list/SongList.vue`

**步骤**

1. composable 状态包含 `keyword/items/total/latestUpdatedAt/hasMore/initialLoading/loadingMore/error`，固定 `PAGE_SIZE=20`。
2. 输入防抖 300ms；renderer IPC 无法直接中止 main fetch 时，使用递增 request id 实现 latest-wins，旧请求完成后丢弃结果。若 IPC 已支持 AbortSignal，再额外中止请求，但不能只依赖取消成功。
3. 新关键词从 offset 0 替换；空关键词不传 keyword；下一页 offset 使用当前有效 items 数量，UUID 去重追加。
4. 监听 `SongList` 现有 `scrollToBottom` 加载下一页，同一时刻只允许一个请求；无更多时不再请求。
5. `SongList` 如需扩展，增加通用的 `disabled`/footer slot 或回调能力，默认值保持旧页面行为，不在 SongList 写 cloud 专属 API。
6. “播放全部”过滤 `playable === false`，把其余歌曲交给现有 `playbackCommands.playAll()`；若跳过禁用项，使用一次统一 message 提示。

### Task 5：接入 cloud 播放、歌词、默认音质和下载

**修改文件**

- `yixi/electron/music/types.ts`
- `yixi/electron/music/musicService.ts`
- `yixi/electron/ipc/musicIpc.ts`
- `yixi/src/utils/api/musicAPI.ts`
- `yixi/src/musicQuality/musicQualityPolicy.ts`
- `yixi/electron/download/downloadService.ts`
- `yixi/electron/mediaCache/types.ts`
- `yixi/electron/mediaCache/` 中决定可缓存 source 的现有文件
- `yixi/src/store/lyricStore.ts`

**步骤**

1. 统一质量类型增加 cloud 默认项：

```ts
{
  key: "cloud:default",
  source: "cloud",
  label: "默认",
  shortLabel: "默认",
  kind: "cloud",
}
```

2. main 的播放 URL resolver 遇到 cloud 时调用 `/api/cloud-music/tracks/:uuid/play-url`，不经过 gateway/cookie/VIP 逻辑。
3. main 获取歌词时先请求 `/lyrics-url`，再拉取 server 签发的资源 URL；LRC 作为现有 `lrc` payload 返回，TXT 由 `lyricStore` 按行转换为无时间轴的可展示文本，不能把整篇歌词挤成一行。
4. 下载只提供“默认”质量，开始下载前重新取 URL，记录只保存 source、uuid、`cloud:default` 和稳定展示字段。
5. media cache 的 `isCacheableSource` 或同等分流明确排除 cloud；未来要开放缓存，必须先设计每次播放的 server 状态复核和撤权策略。
6. 所有资源失败使用现有统一错误提示；不要把 cloud 失败计为 KG/WY/KW 网关故障。

### Task 6：统一歌曲操作的 disabled 守卫和 cloud 边界

**修改文件**

- `yixi/src/listenTogether/playbackCommands.ts`
- `yixi/src/components/list/SongList.vue`
- `yixi/src/components/search/CommonSongItem.vue`
- `yixi/src/components/common/ContextMenu.vue`
- `yixi/src/composables/useSongDownload.ts`
- `yixi/src/share/mediaDetailRoute.ts`

**步骤**

1. 在 playbackCommands 等统一命令入口增加 `playable === false` 守卫，覆盖单击播放、双击、下一首、播放全部和加入队列；UI 置灰只是展示层。
2. ContextMenu 对 disabled 隐藏/禁用播放类和下载类动作，收藏、分享、详情、加入歌单继续可用。
3. 一起听模式检测到 cloud 时拒绝发命令并提示暂不支持；不修改现有 socket 协议和 server source 联合类型。
4. 分享 payload 保持 `{ source: "cloud", id: uuid }`，封面使用稳定 route；详情页不强调第三方音源，只展示统一 `C` 标签。
5. 收藏或歌单中的旧 cloud 条目触发播放前，main 仍以 server play-url 为最终真相；404/403 后更新当前 UI 的不可播状态并提示用户。

### Task 7：同步说明并做轻量校验

**修改文件**

- `yixi/AGENTS.md`
- 根目录 `AGENTS.md`

**步骤**

1. 记录 `/cloud`、`/cloud/submit`、main-only system 请求、source `cloud`、默认音质、disabled 规则和暂不支持一起听/媒体缓存。
2. 执行：

```powershell
git diff --check
pnpm --dir yixi build:t
pnpm --dir yixi test:media-cache
git status --short
```

3. `test:media-cache` 只在实际修改媒体缓存 source 分流时执行；否则跳过并在交付说明中写明。
4. 不运行完整测试，不执行 `build:win`，不启动 Electron。

**提交建议**

客户端改动单独提交：

`功能（yixi）：接入共享云盘音乐页面与播放`

## 手工验收清单

- 左侧“云盘”位置、图标、active 状态正确；`/cloud/submit` 仍保持云盘菜单高亮。
- 页面标题、概览卡、工具条、搜索、列表在浅色/深色和窄窗口下都漂亮、干净，无后台表格感。
- 统计总数和最近更新与 server 一致；无记录时显示合理空值。
- 空关键词每页 20 条，触底追加；快速搜索没有旧响应覆盖新响应。
- 歌曲列表复用现有虚拟列表和操作，来源显示青绿色 `C`，音质菜单只有“默认”。
- active 歌曲播放、歌词、下一首、下载、收藏、分享、详情和加入歌单正常。
- disabled 歌曲可搜到且可查看/收藏/分享，但播放、队列和下载从 UI 到 main 全链路拒绝。
- 投稿按钮使用 primary 蓝色圆角和分享图标，进入独立、完整但无假功能的占位页。
- renderer 没有 server base URL、AES、七牛对象 key或通用网络代理。
- cloud 播放和歌词请求命中外层 server，不经过 KG/WY/KW 网关；旧签名 URL 不落库。

## 不在本期范围

- 投稿上传、表单、进度、用户配额和审核记录。
- 云盘歌曲一起听协议。
- 云盘在线播放持久缓存。
- 云盘歌单或把 cloud 聚合到第三方搜索页。
- Windows 安装包构建与发布。
