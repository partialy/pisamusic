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

- **状态**：`[x] 已全端完成`
- **背景与原因**：`yixi` PC 端「我的 - 歌单」已将三方 Cookie 歌单导入升级为“缓存 + 可选导入 Modal”模式：点击「导入歌单」时优先检查本地缓存，无缓存再拉取 KG / WY 歌单并持久化缓存，随后弹出选择框支持搜索、分音源过滤（全部 / KG / WY）、刷新数据、多选导入、全部导入及已导入状态标记/跳过；同时支持在列表中移除已导入的三方歌单。`pm` Android 端已对齐同步完成“SQLite v19 候选缓存 + 全屏可选导入页”改造。
- **核心交互对齐要求**：
  1. **拉取与缓存**：拉取已登录 KG / WY Cookie 账号歌单元数据后先缓存至本机持久化存储（账号退出/换号时清理对应缓存，支持手动刷新重拉）。
  2. **可选导入视图**：展示缓存的候选歌单列表，支持：
     - 关键词搜索与分音源过滤（全部 / KG / WY）；
     - 标记已导入歌单并禁止重复勾选/跳过重复项；
     - 多选导入、全选/反选导入及导入结果统计（新增 / 跳过数）；
     - 手动刷新重新拉取并更新缓存。
- **涉及客户端与模块路径**：
  - **`yixi/`（PC Electron / Vue）**
    - `[x]` 已完成：
      - `yixi/src/store/mineLibrary.ts`（`mine-third-party-playlist-candidates` 候选缓存、分页对齐、增量导入）
      - `yixi/src/components/mine/ThirdPartyPlaylistImportModal.vue`（可选导入弹窗）
      - `yixi/src/components/mine/MinePlaylistPanel.vue`（导入入口、主列表展示与多选移除）
      - `yixi/electron/database/accountLibraryRepository.ts`（`importUserPlaylists` 增量入库与非 `local` 歌单移除）
  - **`pm/`（Android / Kotlin）**
    - `[x]` 已完成：
      - 本地缓存与清理：`pm/app/src/main/java/cn/partialy/pm/utils/localdata/LocalMusicDbOpenHelper.kt`（v19 `third_party_playlist_candidates` / `third_party_playlist_cache_meta`）、`pm/app/src/main/java/cn/partialy/pm/network/cookie/ThirdPartyPlaylistCandidateStore.kt`、`pm/app/src/main/java/cn/partialy/pm/network/cookie/MusicCookieManager.kt`
      - 拉取与增量入库：`pm/app/src/main/java/cn/partialy/pm/network/cookie/ThirdPartyPlaylistImportRepository.kt`、`pm/app/src/main/java/cn/partialy/pm/utils/playlistUtil/FavoritePlaylistsDbStore.kt`、`pm/app/src/main/java/cn/partialy/pm/utils/playlistUtil/PlaylistCollectionManager.kt`（`addNetworkPlaylists`）
      - 入口与可选导入页：`pm/app/src/main/java/cn/partialy/pm/activity/MainActivity.kt`（侧栏点击打开导入页）、`pm/app/src/main/java/cn/partialy/pm/activity/ThirdPartyPlaylistImportActivity.kt`、`pm/app/src/main/java/cn/partialy/pm/ui/mine/ThirdPartyPlaylistImportAdapter.kt`、`pm/app/src/main/java/cn/partialy/pm/ui/mine/ThirdPartyPlaylistImportRules.kt`（搜索 + 药丸来源筛选 + 全选/反选/导入 + 已导入标记与跳过；已导入歌单移除继续沿用 `MinePlaylistsTabFragment` → `PlaylistActionBottomSheet`）

---

### 3. 设置 - 意见反馈「反馈记录」页面与身份归属同步

- **状态**：`[ ] 待适配`（`server/` 与 `pm/` 已完成，`yixi/` 待适配）
- **背景与原因**：服务端 Schema v7 已为 `feedback` 表新增 `user_id`、`device_kind`、`device_id` 归属字段与查询索引（兼容回填历史 `device_json.serverDeviceId`），并新增客户端查询接口 `GET /api/feedback` 与 `GET /api/feedback/:id`（支持账号 JWT 与设备凭证 `x-pm-device-token` 单独或联合查询，不可删除）。`pm` Android 端已在「设置 → 意见反馈」右上角新增「反馈记录」入口及独立记录页、详情 Sheet 与大图预览，提交反馈时同步附带可选账号与设备凭证。
- **服务端接口**：
  - 提交反馈（增强归属）：`POST /api/feedback`（支持可选 `Authorization` 与 `x-pm-device-token` 请求头，文档见 [submitFeedback.md](server/apidoc/feedback/submitFeedback.md)）
  - 分页查询我的反馈记录：`GET /api/feedback?offset=&limit=`（统一分页 `{ list, total, offset, limit, hasMore }`，文档见 [listFeedback.md](server/apidoc/feedback/listFeedback.md)）
  - 查看单条反馈详情：`GET /api/feedback/:id`（文档见 [getFeedbackDetail.md](server/apidoc/feedback/getFeedbackDetail.md)）
- **涉及客户端与模块路径**：
  - **`pm/`（Android / Kotlin）**
    - `[x]` 已完成：
      - 入口与提交鉴权：`pm/app/src/main/java/cn/partialy/pm/activity/FeedbackActivity.kt`、`pm/app/src/main/res/layout/activity_feedback.xml`
      - 历史列表与详情 Sheet：`pm/app/src/main/java/cn/partialy/pm/activity/FeedbackHistoryActivity.kt`、`pm/app/src/main/java/cn/partialy/pm/ui/feedback/FeedbackHistoryAdapter.kt`、`pm/app/src/main/java/cn/partialy/pm/ui/feedback/FeedbackDetailBottomSheet.kt`
      - 网络与数据层：`pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`、`pm/app/src/main/java/cn/partialy/pm/feedback/FeedbackHistoryRepository.kt`
  - **`yixi/`（PC Electron / Vue）**
    - `[ ]` 意见反馈记录与身份归属待适配：
      - 主进程客户端：`yixi/electron/system/systemClient.ts`（`submitFeedback` 补充附带可选账号 `Authorization` 与桌面端设备 `x-pm-device-token`；新增 `getMyFeedbackHistory` / `getMyFeedbackDetail` 请求方法）
      - 预加载与类型：`yixi/electron/preload.ts`、`yixi/electron/ipc/systemIpc.ts`、`yixi/src/types/electron.d.ts`
      - 设置页与弹窗/记录视图：`yixi/src/components/setting/about/AboutSetting.vue`、`yixi/src/components/about/AboutFeedbackDialog.vue`（增加「反馈记录」入口、记录列表展示处理状态/时间、详情查看、图片放大预览，不支持删除）

---

### 4. 下载配额弹窗适配（游客登录引导 & 额外次数）与客户端兑换入口预留

- **状态**：`[ ] 部分完成`（双端配额弹窗已适配，兑换入口待后续 `app-h5` 页面开发后接入）
- **配额弹窗已适配 (`[x]`)**：
  - `pm/`：`pm/app/src/main/java/cn/partialy/pm/download/quota/SongDownloadQuotaModels.kt`、`pm/app/src/main/java/cn/partialy/pm/ui/dialog/SongDownloadQuotaDialog.kt`（解析并展示 `extraRemaining`，游客 `isGuest` 展示登录引导并支持点击「去登录」跳转 `LoginActivity`）
  - `yixi/`：`yixi/src/types/download.ts`、`yixi/src/utils/downloadQuotaFormat.ts`、`yixi/src/components/download/DownloadQuotaExceededModal.vue`（展示 `extraRemaining`，游客展示提示并通过 `useAccountLoginDialog` 拉起登录弹窗）
- **客户端兑换码 UI 入口 (`[ ] 待后续实现`)**：
  - 服务端已提供 `POST /api/redemption-codes/redeem`，并已在 `server/app-h5/` 预留 `/h5/#/redeem` 等骨架路由，待后续 H5 页面实装后在两端接入。
