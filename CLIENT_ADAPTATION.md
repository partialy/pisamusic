# 客户端待适配功能记录

本文档记录后端契约升级后，客户端（`pm/` Android、`yixi/` PC、官网等）需要跟进适配的功能与接口清单。每个事项均包含涉及客户端、模块、代码路径、变更说明及完成状态；所有涉及端均完成适配后，将对应状态标记为 `[x] 已完成`。

---

## 适配清单

### 1. 云盘音乐搜索 & 投稿历史切换至 v2 统一分页接口

- **状态**：`[ ] 待适配`
- **背景与原因**：服务端已将分页响应结构统一为 `{ code, msg, success, data: { list: [], total, offset, limit, hasMore } }`。为保障现网旧版客户端兼容性，原 `/api/cloud-music/search` 与 `/api/cloud-music/submit/my-history` 保持原结构（`items`）继续服务，新增 v2 接口供客户端后续版本逐步切换。
- **接口对照**：
  1. **云盘公开搜索**
     - 原接口：`GET /api/cloud-music/search`（返回 `{ source: "cloud", items, total, offset, limit }`）
     - 新接口：`GET /api/cloud-music/v2/search`（返回 `{ list, total, offset, limit, hasMore }`）
     - 文档：[searchTracks.md](server/apidoc/cloudMusic/searchTracks.md)
  2. **我的投稿历史**
     - 原接口：`GET /api/cloud-music/submit/my-history`（返回 `{ items, total, offset, limit }`）
     - 新接口：`GET /api/cloud-music/v2/submit/my-history`（返回 `{ list, total, offset, limit, hasMore }`）
     - 文档：[submit.md](server/apidoc/cloudMusic/submit.md)

- **涉及客户端与模块路径**：
  - **`pm/`（Android / Kotlin）**
    - `[ ]` 云盘音乐搜索模块：
      - 接口定义：`pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`（`searchCloudMusic` 等）
      - 数据模型：`pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicModels.kt`（`CloudMusicSearchDto`：`items` 改为 `list`，新增 `hasMore`）
      - 仓库层：`pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicRepository.kt`
      - 视图模型：`pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/CloudMusicViewModel.kt`（可直接消费服务端 `hasMore`）
    - `[ ]` 云盘投稿历史模块：
      - 接口定义：`pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`（`getMyCloudMusicSubmissions` 等）
      - 数据模型：`pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicSubmissionModels.kt`（`CloudMusicSubmissionHistoryDto`：`items` 改为 `list`，新增 `hasMore`）
      - 仓库层：`pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicSubmissionRepository.kt`
      - 视图模型：`pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/submission/CloudMusicSubmissionViewModel.kt`
  - **`yixi/`（PC Electron / Vue）**
    - `[ ]` 云盘音乐搜索模块：
      - 主进程客户端：`yixi/electron/cloudMusic/cloudMusicClient.ts`（`searchCloudMusic` 请求路径与返回字段映射）
      - 类型定义：`yixi/src/types/cloudMusic.ts`（`CloudMusicSearchResult`：`items` 改为 `list`，新增 `hasMore`）
      - 列表 Composable：`yixi/src/cloud/useCloudMusicList.ts`
    - `[ ]` 云盘投稿历史模块：
      - 主进程客户端：`yixi/electron/cloudMusic/cloudMusicClient.ts`（`getMySubmissions` 请求路径与返回字段映射）
      - 类型定义：`yixi/src/types/cloudMusic.ts`（`CloudMusicSubmissionHistoryResult`：`items` 改为 `list`，新增 `hasMore`）
      - 页面组件：`yixi/src/views/cloud/CloudSubmitPlaceholderView.vue`

- **清理计划**：待 `pm` 与 `yixi` 均切换至 v2 并覆盖历史版本后，再评估下线旧版 `/api/cloud-music/search` 与 `/api/cloud-music/submit/my-history`。

---

### 2. 三方账号 Cookie 歌单拉取缓存与可选导入弹窗

- **状态**：`[ ] 待适配`
- **背景与原因**：`yixi` PC 端「我的 - 歌单」已将三方 Cookie 歌单导入升级为“缓存 + 可选导入 Modal”模式：点击「导入歌单」时优先检查本地缓存，无缓存再拉取 KG / WY 歌单并持久化缓存，随后弹出选择框支持搜索、分音源过滤（全部 / KG / WY）、刷新数据、多选导入、全部导入及已导入状态标记/跳过；同时支持在列表中移除已导入的三方歌单。目前 `pm` Android 端仍为侧拉栏一键全量导入并直接写入 `favorite_playlists`，后续需对齐该可选导入体验。
- **核心交互对齐要求**：
  1. **拉取与缓存**：拉取已登录 KG / WY Cookie 账号歌单元数据后先缓存至本机持久化存储（账号退出登录时清理对应缓存，弹窗内支持手动刷新重拉）。
  2. **可选导入弹窗**：展示缓存的候选歌单列表，支持：
     - 关键词搜索与分音源过滤（全部 / KG / WY）；
     - 标记已导入歌单并禁止重复勾选/跳过重复项；
     - 多选导入、全部导入及导入结果统计（新增 / 跳过数）；
     - 弹窗内手动「刷新数据」重新拉取并更新缓存。
- **涉及客户端与模块路径**：
  - **`yixi/`（PC Electron / Vue）**
    - `[x]` 已完成：
      - `yixi/src/store/mineLibrary.ts`（`mine-third-party-playlist-candidates` 候选缓存、分页对齐、增量导入）
      - `yixi/src/components/mine/ThirdPartyPlaylistImportModal.vue`（可选导入弹窗）
      - `yixi/src/components/mine/MinePlaylistPanel.vue`（导入入口、主列表展示与多选移除）
      - `yixi/electron/database/accountLibraryRepository.ts`（`importUserPlaylists` 增量入库与非 `local` 歌单移除）
  - **`pm/`（Android / Kotlin）**
    - `[ ]` 三方歌单拉取缓存与可选导入弹窗：
      - 入口与拉取逻辑：`pm/app/src/main/java/cn/partialy/pm/activity/MainActivity.kt`（`importLoggedInPlaylistsFromDrawer`、`importKgPlaylistsForLoggedInSource`、`importWyPlaylistsForLoggedInSource`）
      - Cookie 仓库层：`pm/app/src/main/java/cn/partialy/pm/network/cookie/KugouCookieRepository.kt`、`pm/app/src/main/java/cn/partialy/pm/network/cookie/WyCookieRepository.kt`、`pm/app/src/main/java/cn/partialy/pm/network/cookie/MusicCookieManager.kt`
      - 歌单列表与收藏管理：`pm/app/src/main/java/cn/partialy/pm/ui/mine/MinePlaylistsTabFragment.kt`、`pm/app/src/main/java/cn/partialy/pm/utils/playlistUtil/PlaylistCollectionManager.kt`
      - 待新增：三方候选歌单本地缓存表/存储及可选导入弹窗 UI（支持搜索、分音源过滤、刷新数据、多选导入、全部导入）。
