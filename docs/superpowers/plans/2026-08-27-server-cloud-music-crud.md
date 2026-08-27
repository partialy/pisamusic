# Server Cloud Music CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `server/` 建立由管理员上传和维护的公共网盘曲库，将音频直传七牛、自动解析音乐元数据并以唯一 UUID 入库，同时提供独立的后台 CRUD 页面和 `cloud` 音源搜索、详情、播放链接接口。

**Architecture:** `cloudMusicService.ts` 作为深模块，只向路由暴露创建、更新、删除和播放链接等小接口，内部隐藏七牛校验、临时文件、元数据解析和 SQLite 事务。音频对象继续登记到统一 `file_records`，业务信息单独存入 `cloud_music_tracks`；客户端接口固定挂载 `/api/cloud-music`，不得并入 KG/WY/KW 搜索或现有音乐网关。

**Tech Stack:** Node.js 22+、TypeScript 6、Express 5、Node SQLite、七牛 Node SDK、`music-metadata`、React 18、Vite 5、Tailwind CSS。

## Global Constraints

- 本计划只修改 `server/`、根 `AGENTS.md` 和本文档，不修改 `pm/`、`yixi/`。
- 当前工作区已有未提交的 PC 端改动，执行时不得回退、暂存或提交这些文件。
- “网盘”定义为平台管理员维护、客户端共同读取的公共曲库，不按用户隔离。
- 独立音乐源代码固定为 `cloud`，不聚合到 KG、WY、KW，不修改已有三源搜索结果和排序。
- 音频文件使用现有私有 `QINIU_BUCKET`，对象 Key 固定前缀 `pisamusic/cloud-music/`；不新增公开直链。
- 上传由管理后台直接传七牛，服务端不接收浏览器的大文件 multipart body。
- 支持扩展名固定为 `.mp3`、`.flac`、`.m4a`、`.mp4`、`.aac`、`.ogg`、`.opus`、`.wav`；默认单文件上限 500 MiB。
- 自动提取并允许修改：歌名、歌手、专辑、时长、格式、编码、码率、采样率、声道数、年份、音轨号。
- 七牛对象 Key、Hash、真实文件大小、MIME、原始文件名为物理事实，只读不可编辑。
- UUID、`file_record_id` 和对象 Key 创建后不可修改；替换音频必须删除后重新上传，生成新 UUID。
- 删除音频时先删除七牛对象，成功后在同一 SQLite 事务中逻辑删除 `cloud_music_tracks` 和 `file_records`；数据库历史不得物理删除。
- 元数据解析失败时不得入库；服务端对七牛对象执行尽力删除，并向后台返回明确错误。
- 不把封面二进制或完整 `music-metadata` 原始对象写入 SQLite；首期不处理内嵌封面。
- 新增或修改接口必须同步更新 `server/apidoc/` 对应文档和 `server/apidoc/index.md`。
- 按老大要求不做复杂测试：不跑全量测试、不启动服务、不真实上传七牛；只计划服务端构建、管理后台构建、`git diff --check` 和一轮人工小文件验收。
- 本计划仅输出方案，不执行、不提交 Git。

---

## Business Rules and Data Contract

### 权威字段

| 字段 | 来源 | 是否可编辑 | 规则 |
|---|---|---:|---|
| `uuid` | 服务端 `randomUUID()` | 否 | `cloud_music_tracks` 主键，也是独立音源歌曲 ID |
| `title` | ID3/Vorbis/MP4 tag，缺失时取去扩展名文件名 | 是 | 去首尾空白，1-200 字符 |
| `artist` | `common.artists`，否则 `common.artist`，再否则“未知歌手” | 是 | 多歌手用 ` / ` 连接，1-300 字符 |
| `album` | `common.album` | 是 | 0-200 字符 |
| `durationMs` | `format.duration * 1000` | 是 | 0-24 小时，整数毫秒 |
| `format` | 容器/扩展名归一化 | 是 | 1-32 字符，如 `mp3`、`flac`、`m4a` |
| `codec` | `format.codec` | 是 | 0-64 字符 |
| `bitrate` | `format.bitrate` | 是 | 非负整数 bps |
| `sampleRate` | `format.sampleRate` | 是 | 非负整数 Hz |
| `channels` | `format.numberOfChannels` | 是 | 0-32 |
| `year` | `common.year` | 是 | `null` 或 1000-9999 |
| `trackNo` | `common.track.no` | 是 | `null` 或正整数 |
| `enabled` | 管理员 | 是 | `false` 时客户端搜索、详情和播放链接均不可见 |
| `fileSize/hash/mime/objectKey` | 七牛 `stat` | 否 | 不信任浏览器 complete 请求里的值 |

### 客户端 DTO

```ts
export type CloudMusicTrack = {
  uuid: string;
  source: "cloud";
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  format: string;
  codec: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  year: number | null;
  trackNo: number | null;
  enabled: boolean;
  file: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    hash: string;
  };
  createdAt: number;
  updatedAt: number;
};
```

---

### Task 1: 建立网盘曲库表和独立 Store

**Files:**
- Modify: `server/src/db/appDb.ts`
- Create: `server/src/db/cloudMusicStore.ts`
- Modify: `server/src/db/configStore.ts`

**Interfaces:**

```ts
export type CloudMusicTrackStatus = "active" | "disabled" | "deleted";

export type CloudMusicCreateInput = {
  uuid: string;
  fileRecordId: string;
  file: {
    bucket: string;
    objectKey: string;
    hash: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  };
  metadata: Omit<CloudMusicTrack, "uuid" | "source" | "file" | "enabled" | "createdAt" | "updatedAt">;
};

export function createCloudMusicTrack(input: CloudMusicCreateInput): CloudMusicTrack;
export function readCloudMusicTrack(uuid: string, includeDeleted?: boolean): CloudMusicTrack | null;
export function listCloudMusicTracks(input: CloudMusicListInput): CloudMusicListResult;
export function searchActiveCloudMusic(input: CloudMusicSearchInput): CloudMusicListResult;
export function updateCloudMusicTrack(uuid: string, patch: CloudMusicUpdateInput): CloudMusicTrack | null;
export function markCloudMusicDeleted(uuid: string, deletedAt: number): CloudMusicTrack | null;
export function readCloudMusicByFileRecordId(fileRecordId: string): CloudMusicTrack | null;
```

- [ ] **Step 1: 在 `CREATE_SQL` 新增业务表**

```sql
CREATE TABLE IF NOT EXISTS cloud_music_tracks (
    uuid            TEXT    PRIMARY KEY,
    file_record_id  TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    artist          TEXT    NOT NULL,
    album           TEXT    NOT NULL DEFAULT '',
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    format          TEXT    NOT NULL,
    codec           TEXT    NOT NULL DEFAULT '',
    bitrate         INTEGER NOT NULL DEFAULT 0,
    sample_rate     INTEGER NOT NULL DEFAULT 0,
    channels        INTEGER NOT NULL DEFAULT 0,
    year            INTEGER,
    track_no        INTEGER,
    enabled         INTEGER NOT NULL DEFAULT 1,
    metadata_json   TEXT    NOT NULL DEFAULT '{}',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER,
    FOREIGN KEY (file_record_id) REFERENCES file_records(id)
);
CREATE INDEX IF NOT EXISTS idx_cloud_music_active_created
ON cloud_music_tracks (deleted_at, enabled, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_music_title_artist
ON cloud_music_tracks (title, artist);
```

- [ ] **Step 2: 实现 `cloudMusicStore.ts` 的行映射和分页查询**

列表查询必须 `JOIN file_records` 返回物理文件字段；后台关键词匹配 `uuid/title/artist/album/file_name`，客户端查询固定增加 `deleted_at IS NULL AND enabled = 1 AND file_records.status = 'uploaded'`。

- [ ] **Step 3: 用一个 SQLite 事务创建两条记录**

`createCloudMusicTrack()` 同时插入：

```text
file_records.usage_type = cloud-music
file_records.platform = server
file_records.asset_type = audio
file_records.status = uploaded
file_records.download_url = ""
file_records.referenced_by = ["cloud-music:<uuid>"]
```

以及对应 `cloud_music_tracks`。任一插入失败必须整体回滚。

- [ ] **Step 4: 实现更新和逻辑删除事务**

更新只允许业务元数据和 `enabled`。删除事务设置 `cloud_music_tracks.deleted_at`、`enabled=0`，并设置 `file_records.status='deleted'`、`deleted_at`、`referenced_by='[]'`。

- [ ] **Step 5: 扩展统一文件类型**

`configStore.ts` 的 `FileRecordInfo.usageType` 和列表过滤增加 `cloud-music`，不把歌曲字段继续塞入已经很大的 `configStore.ts`。

- [ ] **Step 6: 建议提交点**

```powershell
git add server/src/db/appDb.ts server/src/db/cloudMusicStore.ts server/src/db/configStore.ts
git commit -m "功能（server）：建立网盘音乐存储模型"
```

### Task 2: 增加七牛音频上传、对象核验和元数据解析

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/services/qiniuReleaseFiles.ts`
- Create: `server/src/services/cloudMusicMetadata.ts`

**Interfaces:**

```ts
export type CloudMusicUploadTokenInput = {
  uuid: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
};

export function createCloudMusicUploadToken(input: CloudMusicUploadTokenInput): QiniuUploadTokenInfo;
export function isCloudMusicObjectKey(uuid: string, key: string): boolean;
export async function statQiniuObject(bucket: string, key: string): Promise<{
  hash: string;
  fileSize: number;
  mimeType: string;
}>;

export async function extractCloudMusicMetadata(input: {
  signedUrl: string;
  fileName: string;
  expectedSize: number;
}): Promise<CloudMusicExtractedMetadata>;
```

- [ ] **Step 1: 添加元数据依赖**

执行时使用：

```powershell
pnpm --dir server add music-metadata@^11.12.3
```

服务端为 Node16 module resolution，`cloudMusicMetadata.ts` 使用 `await import("music-metadata")` 后调用 `parseFile(tempPath, { duration: true })`，避免把 ESM 包编译成同步 `require()`。

- [ ] **Step 2: 增加音频白名单和对象 Key**

`createCloudMusicUploadToken()` 校验扩展名、正文件大小和 500 MiB 上限；Key 固定为：

```text
pisamusic/cloud-music/YYYYMM/<uuid>.<lowercase-extension>
```

七牛 PutPolicy 必须 `insertOnly=1`、固定 scope、精确 `fsizeLimit`、1 小时有效。

- [ ] **Step 3: 增加七牛 `stat` 核验**

complete 请求到达后由服务端读取七牛对象的 `hash/fsize/mimeType`，校验 bucket、Key 前缀、UUID、扩展名和大小；浏览器返回的 `hash/fsize/mimeType` 仅用于诊断，不作为入库值。

- [ ] **Step 4: 实现安全临时下载**

`extractCloudMusicMetadata()` 用私有签名 URL 流式下载到 `os.tmpdir()/pisamusic-cloud-music/<randomUUID><ext>`；同时检查 `Content-Length` 和实际累计字节，不得超过预期大小或 500 MiB。所有成功、失败和异常路径都在 `finally` 删除临时文件。

- [ ] **Step 5: 归一化解析结果**

```ts
const title = common.title?.trim() || basename(fileName, extname(fileName));
const artist = common.artists?.filter(Boolean).join(" / ") || common.artist?.trim() || "未知歌手";
const album = common.album?.trim() || "";
const durationMs = Math.max(0, Math.round((format.duration ?? 0) * 1000));
```

同时归一化容器、codec、bitrate、sampleRate、channels、year、track.no；`metadata_json` 只保存这些标量和告警文本，不保存 picture、歌词或任意大对象。

- [ ] **Step 6: 建议提交点**

```powershell
git add server/package.json server/src/services/qiniuReleaseFiles.ts server/src/services/cloudMusicMetadata.ts
git commit -m "功能（server）：支持网盘音频上传与元数据解析"
```

### Task 3: 建立深模块并提供管理员 CRUD 接口

**Files:**
- Create: `server/src/services/cloudMusicService.ts`
- Create: `server/src/routes/adminCloudMusic.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/services/fileManagementService.ts`

**Interfaces:**

```ts
export interface CloudMusicModule {
  createUploadTicket(input: CloudMusicUploadRequest): QiniuUploadTokenInfo & { uuid: string };
  completeUpload(input: CloudMusicCompleteRequest): Promise<CloudMusicTrack>;
  list(input: CloudMusicListInput): CloudMusicListResult;
  get(uuid: string, includeDeleted?: boolean): CloudMusicTrack | null;
  update(uuid: string, patch: CloudMusicUpdateInput): CloudMusicTrack | null;
  delete(uuid: string): Promise<CloudMusicTrack>;
  createPlayUrl(uuid: string): { url: string; expiresAt: number } | null;
}
```

- [ ] **Step 1: 实现 `cloudMusicService.ts` 编排**

`createUploadTicket()` 在服务端生成 UUID；`completeUpload()` 按以下固定顺序执行：

```text
校验 UUID 与对象 Key
→ 七牛 stat 获取真实物理信息
→ 生成短期私有 URL
→ 下载临时文件并解析元数据
→ 用 randomUUID() 生成 fileRecordId
→ 事务写入 file_records 与 cloud_music_tracks
→ 返回完整 DTO
```

同一 UUID + objectKey + hash 的 complete 重试返回已有记录；UUID 已存在但对象不一致时返回 409。

- [ ] **Step 2: 实现更新入参校验**

`CloudMusicUpdateInput` 仅允许 `title/artist/album/durationMs/format/codec/bitrate/sampleRate/channels/year/trackNo/enabled`，按“Business Rules”范围校验。路由不得直接写数据库。

- [ ] **Step 3: 实现安全删除**

`delete(uuid)` 读取曲目和文件记录，先调用 `deleteQiniuObject(bucket, objectKey)`，成功后调用 Store 的逻辑删除事务。七牛 612 视为对象已不存在并继续；其他错误保持数据库 active，返回失败。

- [ ] **Step 4: 增加管理员路由**

将 `adminCloudMusicRouter` 挂载到 `adminRouter.use("/cloud-music", adminCloudMusicRouter)`：

| Method | Path | 行为 |
|---|---|---|
| `POST` | `/api/admin/cloud-music/upload-token` | 生成 UUID、Key、七牛上传凭证 |
| `POST` | `/api/admin/cloud-music/complete` | 核验七牛对象、解析并入库 |
| `GET` | `/api/admin/cloud-music` | 状态/格式/关键词分页列表 |
| `GET` | `/api/admin/cloud-music/:uuid` | 读取详情，包含物理文件信息 |
| `PUT` | `/api/admin/cloud-music/:uuid` | 修改允许的元数据和启用状态 |
| `DELETE` | `/api/admin/cloud-music/:uuid` | 删除七牛对象并逻辑删除记录 |

- [ ] **Step 5: 保护统一文件管理删除入口**

`deleteManagedFileRecord()` 遇到 `usageType === "cloud-music"` 时先通过 `fileRecordId` 找到曲目，再委托 `cloudMusicService.delete(uuid)`；禁止只把 `file_records` 标记删除而留下可搜索歌曲。

- [ ] **Step 6: 建议提交点**

```powershell
git add server/src/services/cloudMusicService.ts server/src/routes/adminCloudMusic.ts server/src/routes/admin.ts server/src/services/fileManagementService.ts
git commit -m "功能（server）：提供网盘音乐后台CRUD接口"
```

### Task 4: 提供独立 `cloud` 音源查询与播放链接

**Files:**
- Create: `server/src/routes/cloudMusic.ts`
- Modify: `server/src/index.ts`

**Interfaces:**

```ts
export type CloudMusicSearchResponse = {
  source: "cloud";
  items: CloudMusicTrack[];
  total: number;
  offset: number;
  limit: number;
};

export type CloudMusicPlayUrlResponse = {
  uuid: string;
  source: "cloud";
  url: string;
  expiresAt: number;
};
```

- [ ] **Step 1: 挂载独立 Router**

在 `index.ts` 增加 `app.use("/api/cloud-music", cloudMusicRouter)`；不得把路由挂入 `configRouter`、现有音乐源代理或客户端聚合搜索。

- [ ] **Step 2: 实现三个客户端接口**

| Method | Path | 鉴权与结果 |
|---|---|---|
| `GET` | `/api/cloud-music/search?keyword&offset&limit` | 无 User Token，走系统 AES 加密；只返回 active 曲目 |
| `GET` | `/api/cloud-music/tracks/:uuid` | 无 User Token，走系统 AES 加密；disabled/deleted 返回 404 |
| `GET` | `/api/cloud-music/tracks/:uuid/play-url` | 无 User Token，走系统 AES 加密；返回 1 小时七牛私有 URL |

`keyword` 同时匹配 title、artist、album 和 UUID；limit 默认 30、最大 100。空关键词返回按 `created_at DESC` 排序的独立曲库列表。

- [ ] **Step 3: 不修改加密白名单**

接口均返回 JSON 并由现有加密中间件处理；音频字节由客户端直接访问短期七牛 URL，因此不新增明文流媒体路径，也不改 `DEFAULT_PLAINTEXT_PATHS`。

- [ ] **Step 4: 建议提交点**

```powershell
git add server/src/routes/cloudMusic.ts server/src/index.ts
git commit -m "功能（server）：开放独立网盘音乐源接口"
```

### Task 5: 增加管理后台网盘音乐页面

**Files:**
- Create: `server/admin/src/types/cloudMusic.ts`
- Create: `server/admin/src/api/cloudMusic.ts`
- Modify: `server/admin/src/api/client.ts`
- Create: `server/admin/src/components/tabs/CloudMusicManagementTab.tsx`
- Create: `server/admin/src/components/modals/CloudMusicUploadModal.tsx`
- Create: `server/admin/src/components/modals/CloudMusicEditModal.tsx`
- Modify: `server/admin/src/components/tabs/FileManagementTab.tsx`
- Modify: `server/admin/src/constants/theme.ts`
- Modify: `server/admin/src/App.tsx`

**Interfaces:**

```ts
export async function uploadCloudMusic(
  file: File,
  onProgress?: (state: { phase: "uploading" | "extracting"; percent: number }) => void,
): Promise<CloudMusicTrack>;

export async function listCloudMusic(params: CloudMusicListParams): Promise<CloudMusicListResult>;
export async function updateCloudMusic(uuid: string, patch: CloudMusicUpdateInput): Promise<CloudMusicTrack>;
export async function deleteCloudMusic(uuid: string): Promise<void>;
export async function getCloudMusicPlayUrl(uuid: string): Promise<CloudMusicPlayUrlResponse>;
```

- [ ] **Step 1: 复用现有管理请求和七牛上传逻辑**

在 `client.ts` 导出一个泛型 `adminJson<T>(url, init)` 和现有 `uploadFileToQiniu()`、上传类型，供 `api/cloudMusic.ts` 使用；不得复制认证、加密、401 清理或 XHR 进度代码。

- [ ] **Step 2: 实现上传两阶段 UI**

`CloudMusicUploadModal` 仅允许单文件和白名单扩展名。状态固定显示：

```text
正在上传到七牛 0-100%
→ 正在由服务端解析音乐信息
→ 上传完成并打开编辑弹窗
```

complete 失败时显示服务端错误，不伪造成功记录。

- [ ] **Step 3: 实现列表页面**

`CloudMusicManagementTab` 自己管理列表、筛选、分页、选中项和上传/编辑/删除状态，避免继续扩大 1780 行的 `App.tsx`。页面包含：

- 关键词、状态、格式筛选；
- 歌名、歌手、专辑、时长、格式、文件大小、启用状态、更新时间；
- 上传、刷新、试听、编辑、删除操作；
- 删除前显示“七牛对象将实际删除，数据库仅保留删除记录”的确认文案。

- [ ] **Step 4: 实现编辑弹窗**

`CloudMusicEditModal` 将可编辑业务字段与只读物理字段分区。时长以 `mm:ss`/`hh:mm:ss` 展示并转换为毫秒；保存前复用和服务端一致的长度、数字范围校验。

- [ ] **Step 5: 接入菜单但保持 App 轻量**

`theme.ts` 新增 `{ id: "cloudMusic", name: "网盘音乐" }`；`App.tsx` 只增加 lazy import 和：

```tsx
{currentTab === "cloudMusic" && <CloudMusicManagementTab themeColor={themeColor} />}
```

不得把曲库分页、上传和弹窗状态提升进 `App.tsx`。

- [ ] **Step 6: 更新统一文件管理展示**

`FileManagementTab.tsx` 的用途筛选和文案增加“网盘音乐”，详情页展示引用 `cloud-music:<uuid>`；删除仍走统一 `/api/admin/files/:id`，由 Task 3 保证业务联动。

- [ ] **Step 7: 建议提交点**

```powershell
git add server/admin/src
git commit -m "功能（server）：增加网盘音乐管理界面"
```

### Task 6: 补齐接口文档和项目上下文

**Files:**
- Create: `server/apidoc/cloudMusic/searchTracks.md`
- Create: `server/apidoc/cloudMusic/getTrack.md`
- Create: `server/apidoc/cloudMusic/getPlayUrl.md`
- Create: `server/apidoc/admin/getCloudMusicUploadToken.md`
- Create: `server/apidoc/admin/completeCloudMusicUpload.md`
- Create: `server/apidoc/admin/listCloudMusic.md`
- Create: `server/apidoc/admin/getCloudMusicDetail.md`
- Create: `server/apidoc/admin/updateCloudMusic.md`
- Create: `server/apidoc/admin/deleteCloudMusic.md`
- Modify: `server/apidoc/index.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写明客户端接口契约**

每个文档必须包含请求方法、路径、加密要求、参数边界、完整成功响应、400/404/409/500 错误和“`source=cloud` 不参与其他音源聚合”的说明。

- [ ] **Step 2: 写明管理员 CRUD 契约**

上传文档明确“浏览器直传七牛、complete 由服务端 stat 和解析”；删除文档明确对象实际删除、数据库逻辑删除且不可恢复。

- [ ] **Step 3: 更新总索引**

在 `apidoc/index.md` 增加“网盘音乐源 (`/api/cloud-music`)”模块，并在管理员 API 下增加“网盘音乐管理”小节，所有新文档必须有链接。

- [ ] **Step 4: 更新根项目规则**

`AGENTS.md` 增加表、模块职责、七牛 Key 前缀、删除语义、独立音源约束和验证命令，避免后续把 `cloud` 聚合进 KG/WY/KW。

- [ ] **Step 5: 建议提交点**

```powershell
git add server/apidoc AGENTS.md
git commit -m "文档（server）：补充网盘音乐接口与模块规则"
```

### Task 7: 轻量验证和人工验收交接

**Files:**
- Read-only verify: `server/src/**`
- Read-only verify: `server/admin/src/**`
- Read-only verify: `server/apidoc/**`

- [ ] **Step 1: 服务端语法构建**

```powershell
pnpm --dir server build
```

Expected: TypeScript 编译成功，不生成源码目录内待提交运行数据。

- [ ] **Step 2: 管理后台语法构建**

```powershell
pnpm --dir server/admin build
```

Expected: `tsc --noEmit` 和 Vite 构建成功；忽略的 `server/web-admin/` 构建产物不提交。

- [ ] **Step 3: 检查格式和边界**

```powershell
git diff --check
git status --short
```

Expected: 无空白错误；只出现 `server/`、`AGENTS.md` 和本计划相关文件，原有 `yixi/` 改动保持原样。

- [ ] **Step 4: 交给老大做一轮非复杂人工验收**

只选择一个小 MP3 和一个 FLAC：

1. 上传后确认自动生成 UUID，歌名/歌手/时长/大小/格式正确；
2. 修改歌名、歌手、时长和格式后刷新仍保留；
3. 后台关键词可以搜到，禁用后客户端搜索和播放接口返回不可用；
4. `/api/cloud-music/search` 只返回 `source=cloud`，不混入 KG/WY/KW；
5. 获取播放链接后验证七牛临时 URL 可播放并支持拖动；
6. 删除后确认后台保留删除记录、客户端 404、七牛对象不存在；
7. 从“文件管理”删除同一曲目时，曲库记录也同步逻辑删除。

不运行全量测试、不做压力测试、不启动 Android/PC 客户端、不打安装包。

---

## Out of Scope for This Phase

- Android/PC 客户端新增 `cloud` Tab、播放器接入和下载缓存；
- 与 KG/WY/KW 的跨源聚合搜索；
- 用户个人私有网盘、配额和用户隔离；
- 歌词上传/自动匹配；
- 内嵌封面提取、封面七牛上传和图片缩略图；
- 批量目录导入、断点续传、分片上传、转码和响度分析；
- 已删除音频恢复或替换文件保留原 UUID。
