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
