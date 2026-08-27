# Server Cloud Music CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `server/` 建立可追踪上传全过程、支持用户归属、音频/封面/歌词资产、审核状态和临时文件清理的公共网盘曲库，并提供管理后台 CRUD 与独立 `cloud` 音源接口。

**Architecture:** `cloudMusicService.ts` 是网盘音乐深模块的唯一业务 seam，路由只调用“创建上传会话、确认资产、保存曲目、审核、清理、查询、获取资源地址”等小接口；模块内部统一隐藏 UUID、状态机、七牛对象、元数据解析、资产替换和 SQLite 事务。上传凭证签发前先创建 `temp` 曲目和 `pending` 文件记录，所有七牛 Key 都有数据库归属，因此浏览器在上传成功后中断也不会产生无法追踪的幽灵文件。

**Tech Stack:** Node.js 22+、TypeScript 6、Express 5、Node SQLite、七牛 Node SDK、`music-metadata`、React 18、Vite 5、Tailwind CSS。

## Global Constraints

- 本计划只修改 `server/`、根 `AGENTS.md` 和本文档，不修改 `pm/`、`yixi/`。
- 当前工作区已有未提交的 PC 端改动，执行时不得回退、暂存或提交这些文件。
- “网盘”首期是平台公共曲库；管理端上传的所有者固定为 `system`，后续用户上传时从登录 Token 绑定真实 `users.id`，不得接受客户端伪造用户 ID。
- 独立音乐源代码固定为 `cloud`，不聚合到 KG、WY、KW，不修改已有三源搜索结果和排序。
- 音频、封面、歌词均使用现有私有 `QINIU_BUCKET`；对象 Key 统一位于 `pisamusic/cloud-music/`，不下发永久公开直链。
- 上传由管理后台直接传七牛，服务端不接收浏览器的大文件 multipart body。
- 签发任何七牛上传凭证前，必须先事务写入 `cloud_music_tracks(status='temp')` 和对应 `file_records(status='pending')`；禁止“先传七牛、后建数据库记录”。
- 音频扩展名固定支持 `.mp3`、`.flac`、`.m4a`、`.mp4`、`.aac`、`.ogg`、`.opus`、`.wav`，单文件上限 500 MiB。
- 手动封面固定支持 `.jpg`、`.jpeg`、`.png`、`.webp`，单文件上限 10 MiB；歌词固定支持 UTF-8 `.lrc`、`.txt`，单文件上限 2 MiB。
- 七牛对象 Key、Hash、真实文件大小、MIME、原始文件名为物理事实，只读不可编辑；所有物理值由服务端 `stat`/文件头校验，不信任浏览器回传。
- UUID、音频 `fileRecordId` 和已经完成上传的对象 Key 不可修改；替换音频必须新建上传会话，生成新 UUID。
- 删除时先删除七牛对象，再逻辑删除业务记录和所有关联 `file_records`；数据库历史不得物理删除。
- 新增或修改接口必须同步更新 `server/apidoc/` 对应文档和 `server/apidoc/index.md`。
- 按老大要求不做复杂测试：不跑全量测试、不启动服务、不真实上传七牛；只执行服务端构建、管理后台构建、`git diff --check`，真实小文件流程交给老大验收。
- 本计划仅输出方案，不执行、不提交 Git。

---

## Business Rules and Data Contract

### 曲目状态机

```ts
export type CloudMusicTrackStatus =
  | "temp"
  | "active"
  | "disabled"
  | "offline"
  | "pending_review"
  | "rejected"
  | "deleted";

export type CloudMusicUploadState =
  | "reserved"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export type CloudMusicAssetState = "pending" | "uploaded" | "superseded" | "deleted";
export type CloudMusicAssetKind = "audio" | "cover-uploaded" | "cover-extracted" | "lyrics";
```

| 状态 | 客户端搜索 | 客户端详情 | 播放/歌词地址 | 管理端试听 | 说明 |
|---|---:|---:|---:|---:|---|
| `temp` 临时 | 否 | 否 | 否 | 音频已上传时允许 | 已创建上传会话但管理端尚未保存，可一键清理 |
| `active` 可用 | 是 | 是 | 是 | 是 | 正常曲目 |
| `disabled` 禁用 | 是 | 是 | 否 | 是 | 可发现；播放接口返回 403 `CLOUD_MUSIC_DISABLED` |
| `offline` 下架 | 否 | 否 | 否 | 是 | 运营下架，保留文件和记录 |
| `pending_review` 待审核 | 否 | 否 | 否 | 是 | 后期用户上传并确认后进入此状态 |
| `rejected` 审核不通过 | 否 | 否 | 否 | 是 | 保留审核记录和文件，可重新送审或删除 |
| `deleted` 删除 | 否 | 否 | 否 | 否 | 七牛对象已删除，数据库逻辑删除；终态 |

允许转换：

```text
管理端：temp --保存--> active | disabled | offline
未来用户：temp --提交审核--> pending_review --通过--> active | disabled
                                      └--拒绝--> rejected
active <--> disabled
active | disabled <--> offline
rejected --> pending_review | active
除 deleted 外任意状态 --删除/清理--> deleted
deleted 不允许恢复
```

业务 `status` 与上传过程 `uploadState` 分开：

```text
创建上传会话：status=temp, uploadState=reserved, file_records.status=pending
七牛音频存在：uploadState=uploaded
解析中：uploadState=processing
解析成功：uploadState=ready，status 仍为 temp
解析失败：uploadState=failed，status 仍为 temp，可重试或清理
管理端保存：status=active/disabled/offline，要求 uploadState=ready
```

状态转换全部集中在 `cloudMusicService.ts`；Store 只接收已经校验过的目标状态，路由和 React 页面不得自行写状态 SQL。

### 临时记录与幽灵文件防护

创建上传会话时先生成 UUID，为音频及已选择的封面/歌词生成固定 Key，在一个 SQLite 事务中写入临时曲目和临时 `file_records`，提交后才返回上传 Token。七牛成功但 complete 未到达时，数据库仍保留 Key，可由后台清理。

“一键清理临时文件”默认处理 `status=temp AND updated_at <= now-24h`；弹窗可选“24 小时前 / 72 小时前 / 全部临时记录”。清理逐曲删除音频、手动封面、解析封面和歌词；七牛 612 视为对象已不存在，其他错误保留 temp 并返回失败明细，避免数据库标记删除但云端仍残留。

### 文件所有者

```ts
export type CloudMusicOwner =
  | { type: "system"; userId: null; displayName: "system" }
  | { type: "user"; userId: string; displayName: string };
```

- `file_records` 新增 `owner_type`、`owner_user_id`、`owner_snapshot_json`；旧记录迁移为 `owner_type='system'`。
- 管理端上传时服务端强制 owner 为 system，请求体不接收 owner。
- 后期用户上传只能从有效账号 Token 获取 `users.id`；快照保存当时的 `id/username/email`，用户硬删除后仍可审计。
- 同一曲目的音频、封面和歌词必须拥有相同 owner，由 `cloudMusicService.ts` 保证。

### 元数据、封面和歌词优先级

歌名、歌手、专辑、时长先解析并填入编辑表单：

```text
歌名：metadata.title > 去扩展名文件名
歌手：metadata.artists/artist > 未知歌手
专辑：metadata.album > 空字符串
时长：metadata.duration > 0
```

管理员手动修改后，保存值覆盖解析值；“元数据优先”仅指表单初值优先于文件名或默认值，不覆盖已经保存的人工修改。

封面顺序固定：

```text
手动上传封面 > 音频内嵌封面 > /static/cloud-music/default-cover.svg
```

- 服务端尝试提取第一张合法内嵌封面，只允许 JPEG/PNG/WebP 且不超过 10 MiB，上传七牛并登记 `asset_type='cover-extracted'`。
- 手动封面登记为 `asset_type='cover-uploaded'`；删除后回退内嵌封面，再回退默认封面。
- 默认封面是仓库静态 SVG，不登记 `file_records`。
- 歌词登记为 `asset_type='lyrics'`，只允许 UTF-8 LRC/TXT；首期不解析内嵌歌词、不自动匹配。

### 管理端 DTO

```ts
export type CloudMusicTrack = {
  uuid: string;
  source: "cloud";
  owner: CloudMusicOwner;
  status: CloudMusicTrackStatus;
  uploadState: CloudMusicUploadState;
  statusReason: string;
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
  playable: boolean;
  cover: { source: "uploaded" | "embedded" | "default"; url: string };
  lyrics: null | { format: "lrc" | "txt"; fileName: string };
  audioFile: CloudMusicFileInfo;
  createdAt: number;
  updatedAt: number;
  reviewedAt: number | null;
  reviewedBy: string;
};
```

客户端 DTO 不返回 owner 邮箱、bucket/objectKey/hash、审核人、失败信息或已删除资产；管理端 DTO 才返回完整物理文件和审计字段。

### 共享实现类型

```ts
export type CloudMusicFileInfo = {
  id: string;
  kind: CloudMusicAssetKind;
  state: CloudMusicAssetState;
  fileName: string;
  mimeType: string;
  fileSize: number;
  hash: string;
  bucket: string;
  objectKey: string;
};

export type CloudMusicSelectedFile = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type CloudMusicUploadSessionRequest = {
  audio: CloudMusicSelectedFile;
  cover?: CloudMusicSelectedFile;
  lyrics?: CloudMusicSelectedFile;
};

export type CloudMusicAssetReserveRequest = CloudMusicSelectedFile & {
  kind: "cover-uploaded" | "lyrics";
};

export type CloudMusicAssetUploadTicket = {
  assetId: string;
  fileRecordId: string;
  kind: CloudMusicAssetKind;
  key: string;
  uploadToken: string;
  uploadUrl: string;
};

export type CloudMusicReservedAsset = {
  assetId: string;
  fileRecordId: string;
  trackUuid: string;
  kind: CloudMusicAssetKind;
  bucket: string;
  objectKey: string;
  declaredFile: CloudMusicSelectedFile;
};

export type CloudMusicUploadSession = {
  uuid: string;
  track: CloudMusicTrack;
  tickets: CloudMusicAssetUploadTicket[];
};

export type CloudMusicListInput = {
  keyword?: string;
  ownerType?: "system" | "user" | "all";
  status?: CloudMusicTrackStatus | "all";
  uploadState?: CloudMusicUploadState | "all";
  format?: string;
  offset?: number;
  limit?: number;
};

export type CloudMusicListResult = {
  items: CloudMusicTrack[];
  total: number;
  offset: number;
  limit: number;
};

export type CloudMusicSearchInput = Pick<CloudMusicListInput, "keyword" | "offset" | "limit">;
export type CloudMusicDraftUpdateInput = Pick<CloudMusicTrack, "title" | "artist" | "album" | "durationMs">;
export type CloudMusicStatusTransitionInput = {
  uuid: string;
  from: CloudMusicTrackStatus[];
  to: CloudMusicTrackStatus;
  reason: string;
  actor: string;
};

export type CloudMusicSessionCreateInput = {
  uuid: string;
  owner: CloudMusicOwner;
  audio: CloudMusicReservedAsset;
  cover?: CloudMusicReservedAsset;
  lyrics?: CloudMusicReservedAsset;
};

export type CloudMusicAssetReserveInput = {
  uuid: string;
  owner: CloudMusicOwner;
  asset: CloudMusicReservedAsset;
};

export type CloudMusicAssetConfirmInput = {
  uuid: string;
  assetId: string;
  hash: string;
  mimeType: string;
  fileSize: number;
};

export type QiniuObjectStat = { hash: string; fileSize: number; mimeType: string };
export type MetadataExtractInput = { signedUrl: string; fileName: string; expectedSize: number };
export type ExtractedCoverUploadInput = {
  uuid: string;
  owner: CloudMusicOwner;
  picture: NonNullable<CloudMusicExtractedMetadata["picture"]>;
};

export type CloudMusicResourceUrls = {
  audioUrl: string;
  audioExpiresAt: number;
  coverUrl: string;
  lyricsUrl: string | null;
  lyricsExpiresAt: number | null;
};

export type CloudMusicExtractedMetadata = {
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
  picture: null | { mimeType: "image/jpeg" | "image/png" | "image/webp"; data: Uint8Array };
  warnings: string[];
};
```

这些 Store 输入中的 UUID、owner、对象 Key、fileRecordId 和七牛 stat 结果只由 `cloudMusicService.ts` 传入，不从 HTTP 请求直接构造。

---

### Task 1: 扩展文件所有者并建立曲目、资产和状态存储

**Files:**
- Modify: `server/src/db/appDb.ts`
- Create: `server/src/db/cloudMusicStore.ts`
- Modify: `server/src/db/configStore.ts`

**Interfaces:**

```ts
export function createCloudMusicUploadSession(input: CloudMusicSessionCreateInput): CloudMusicTrack;
export function reserveCloudMusicAsset(input: CloudMusicAssetReserveInput): CloudMusicReservedAsset;
export function confirmCloudMusicAsset(input: CloudMusicAssetConfirmInput): CloudMusicTrack;
export function readCloudMusicTrack(uuid: string, includeDeleted?: boolean): CloudMusicTrack | null;
export function listCloudMusicTracks(input: CloudMusicListInput): CloudMusicListResult;
export function searchVisibleCloudMusic(input: CloudMusicSearchInput): CloudMusicListResult;
export function updateCloudMusicDraft(uuid: string, input: CloudMusicDraftUpdateInput): CloudMusicTrack | null;
export function transitionCloudMusicStatus(input: CloudMusicStatusTransitionInput): CloudMusicTrack | null;
export function listStaleTempTracks(olderThan: number, limit: number): CloudMusicTrack[];
export function markCloudMusicDeleted(uuid: string, deletedAt: number): CloudMusicTrack | null;
export function readCloudMusicByFileRecordId(fileRecordId: string): CloudMusicTrack | null;
```

- [ ] **Step 1: 扩展统一文件所有者字段**

在 `file_records` 建表 SQL 增加：

```sql
owner_type          TEXT NOT NULL DEFAULT 'system',
owner_user_id       TEXT,
owner_snapshot_json TEXT NOT NULL DEFAULT '{}',
```

增加 `migrateFileRecords()`，通过 `PRAGMA table_info(file_records)` 为已有数据库补列并修复空 owner；增加索引：

```sql
CREATE INDEX IF NOT EXISTS idx_file_records_owner
ON file_records (owner_type, owner_user_id, created_at DESC);
```

- [ ] **Step 2: 新增网盘曲目表**

```sql
CREATE TABLE IF NOT EXISTS cloud_music_tracks (
    uuid                       TEXT    PRIMARY KEY,
    status                     TEXT    NOT NULL DEFAULT 'temp',
    upload_state               TEXT    NOT NULL DEFAULT 'reserved',
    status_reason              TEXT    NOT NULL DEFAULT '',
    title                      TEXT    NOT NULL DEFAULT '',
    artist                     TEXT    NOT NULL DEFAULT '未知歌手',
    album                      TEXT    NOT NULL DEFAULT '',
    duration_ms                INTEGER NOT NULL DEFAULT 0,
    format                     TEXT    NOT NULL DEFAULT '',
    codec                      TEXT    NOT NULL DEFAULT '',
    bitrate                    INTEGER NOT NULL DEFAULT 0,
    sample_rate                INTEGER NOT NULL DEFAULT 0,
    channels                   INTEGER NOT NULL DEFAULT 0,
    year                       INTEGER,
    track_no                   INTEGER,
    lyrics_format              TEXT,
    metadata_json              TEXT    NOT NULL DEFAULT '{}',
    reviewed_by                TEXT    NOT NULL DEFAULT '',
    reviewed_at                INTEGER,
    created_at                 INTEGER NOT NULL,
    updated_at                 INTEGER NOT NULL,
    deleted_at                 INTEGER,
    CHECK (status IN ('temp','active','disabled','offline','pending_review','rejected','deleted'))
);
CREATE TABLE IF NOT EXISTS cloud_music_assets (
    id              TEXT    PRIMARY KEY,
    track_uuid      TEXT    NOT NULL,
    file_record_id  TEXT    NOT NULL UNIQUE,
    kind            TEXT    NOT NULL,
    state           TEXT    NOT NULL DEFAULT 'pending',
    is_current      INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER,
    FOREIGN KEY (track_uuid) REFERENCES cloud_music_tracks(uuid),
    FOREIGN KEY (file_record_id) REFERENCES file_records(id),
    CHECK (kind IN ('audio','cover-uploaded','cover-extracted','lyrics')),
    CHECK (state IN ('pending','uploaded','superseded','deleted'))
);
CREATE INDEX IF NOT EXISTS idx_cloud_music_status_updated
ON cloud_music_tracks (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_music_title_artist
ON cloud_music_tracks (title, artist);
CREATE INDEX IF NOT EXISTS idx_cloud_music_assets_track
ON cloud_music_assets (track_uuid, kind, state, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cloud_music_current_asset
ON cloud_music_assets (track_uuid, kind)
WHERE is_current = 1 AND deleted_at IS NULL;
```

资产关系单独建表，避免在曲目表继续增加 audio/cover/lyrics 外键，并支持后续替换封面或歌词。新资产先以 `is_current=0/state=pending` 预登记，确认成功后事务切换 current；旧资产改为 superseded，再由业务模块删除旧七牛对象并逻辑删除记录。

- [ ] **Step 3: 用一个事务预登记上传会话**

先写曲目，再写音频临时 `file_records + cloud_music_assets`；已选择封面和歌词也在同一事务预登记：

```text
usage_type = cloud-music
platform = server
asset_type = audio | cover-uploaded | lyrics
provider = qiniu
status = pending
owner_type = system
owner_user_id = NULL
owner_snapshot_json = {"displayName":"system"}
referenced_by = [{"type":"cloud-music","id":"<uuid>"}]
```

初始 title 取文件名、artist 为“未知歌手”、status=temp、uploadState=reserved。事务提交后才能签发 Token。

- [ ] **Step 4: 实现资产确认与解析结果事务**

确认资产时用七牛 `stat` 覆盖 `hash/mime_type/file_size`，并把文件和资产改为 uploaded/current。音频解析阶段依次写入 uploaded、processing、ready/failed；解析结果和当前资产切换在一个事务更新。`readCloudMusicByFileRecordId()` 通过 `cloud_music_assets` 反查曲目。

- [ ] **Step 5: 实现状态查询和逻辑删除**

客户端搜索只返回 `status IN ('active','disabled')`。删除事务设置曲目 deleted/deleted_at，并将 `cloud_music_assets` 及所有关联文件记录改为 deleted、清空引用、写入 deleted_at。

- [ ] **Step 6: 扩展统一文件类型**

`FileRecordUsageType` 增加 `cloud-music`，文件状态类型增加 `pending`，`FileRecordReferenceType` 增加 `{ type: 'cloud-music'; id: string }`，`FileRecordInfo` 增加 owner 字段。现有发布文件映射为 system；曲目字段继续留在独立 Store。

- [ ] **Step 7: 建议提交点**

```powershell
git add server/src/db/appDb.ts server/src/db/cloudMusicStore.ts server/src/db/configStore.ts
git commit -m "功能（server）：建立网盘音乐状态与文件归属模型"
```

### Task 2: 增加七牛预登记上传、音频解析、封面和歌词处理

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/services/qiniuReleaseFiles.ts`
- Create: `server/src/services/cloudMusicAssets.ts`
- Create: `server/src/services/cloudMusicMetadata.ts`
- Create: `server/static/cloud-music/default-cover.svg`

**Interfaces:**

```ts
export function createCloudMusicAssetUploadToken(input: {
  uuid: string;
  asset: CloudMusicReservedAsset;
}): QiniuUploadTokenInfo;
export async function statCloudMusicAsset(asset: CloudMusicReservedAsset): Promise<QiniuObjectStat>;
export async function deleteCloudMusicAsset(asset: CloudMusicFileInfo): Promise<void>;
export async function uploadExtractedCover(input: ExtractedCoverUploadInput): Promise<CloudMusicFileInfo>;
export function createCloudMusicAssetUrl(asset: CloudMusicFileInfo, ttlSeconds: number): string;
export async function extractCloudMusicMetadata(input: MetadataExtractInput): Promise<CloudMusicExtractedMetadata>;
```

- [ ] **Step 1: 添加音乐元数据依赖**

```powershell
pnpm --dir server add music-metadata@^11.12.3
```

使用 `await import('music-metadata')` 调用 `parseFile(tempPath, { duration: true })`，兼容当前 Node16 module resolution。

- [ ] **Step 2: 按预登记记录签发固定 Key Token**

```text
音频：pisamusic/cloud-music/YYYYMM/<uuid>/audio.<ext>
手动封面：pisamusic/cloud-music/YYYYMM/<uuid>/cover-uploaded.<ext>
解析封面：pisamusic/cloud-music/YYYYMM/<uuid>/cover-embedded.<ext>
歌词：pisamusic/cloud-music/YYYYMM/<uuid>/lyrics.<ext>
```

PutPolicy 固定 `insertOnly=1`、精确 scope、`fsizeLimit` 和 1 小时有效。只有 status=temp 且文件记录 pending 才能签发或重签 Token。

- [ ] **Step 3: 实现对象核验和安全临时下载**

complete 后由服务端 stat 校验 bucket、Key、Hash、真实大小和 MIME。音频流式下载到 `os.tmpdir()/pisamusic-cloud-music/<randomUUID><ext>`，检查 Content-Length 和累计字节，所有路径 finally 删除临时文件。

- [ ] **Step 4: 解析并归一化音乐信息**

```ts
const title = common.title?.trim() || basename(fileName, extname(fileName));
const artist = common.artists?.filter(Boolean).join(" / ") || common.artist?.trim() || "未知歌手";
const album = common.album?.trim() || "";
const durationMs = Math.max(0, Math.round((format.duration ?? 0) * 1000));
```

同时归一化 format、codec、bitrate、sampleRate、channels、year、track.no；metadata_json 只存标量和告警。

- [ ] **Step 5: 提取内嵌封面**

读取 `common.picture[0]`，校验 JPEG/PNG/WebP 且 Buffer 不超过 10 MiB；先建 `cover-extracted/pending` 文件及资产记录，再由服务端上传并改为 uploaded/current。无封面或解析失败不阻断音频，记录告警并回退默认封面。

- [ ] **Step 6: 校验手动封面和歌词**

手动封面 complete 后检查文件头魔数；歌词读取最多 2 MiB，去 BOM 并用 fatal UTF-8 decoder 拒绝非法编码。失败保留 temp 和原因，允许重签、重传或清理。

- [ ] **Step 7: 新增默认封面**

创建蓝色背景、白色音符的 `server/static/cloud-music/default-cover.svg`，通过现有 `/static/*` 路由提供，不新增明文白名单。

- [ ] **Step 8: 建议提交点**

```powershell
git add server/package.json server/src/services/qiniuReleaseFiles.ts server/src/services/cloudMusicAssets.ts server/src/services/cloudMusicMetadata.ts server/static/cloud-music/default-cover.svg
git commit -m "功能（server）：支持网盘音乐多资产上传与解析"
```

### Task 3: 建立深模块、保存规则、审核状态和临时清理

**Files:**
- Create: `server/src/services/cloudMusicService.ts`
- Modify: `server/src/services/fileManagementService.ts`

**Interfaces:**

```ts
export interface CloudMusicModule {
  createAdminUploadSession(input: CloudMusicUploadSessionRequest): CloudMusicUploadSession;
  reserveAsset(uuid: string, input: CloudMusicAssetReserveRequest): CloudMusicAssetUploadTicket;
  confirmAsset(uuid: string, kind: CloudMusicAssetKind): Promise<CloudMusicTrack>;
  saveAdminDraft(uuid: string, input: CloudMusicAdminSaveInput, adminUsername: string): CloudMusicTrack;
  review(uuid: string, input: CloudMusicReviewInput, adminUsername: string): CloudMusicTrack;
  list(input: CloudMusicListInput): CloudMusicListResult;
  getAdminDetail(uuid: string): CloudMusicTrack | null;
  removeManualCover(uuid: string): Promise<CloudMusicTrack>;
  delete(uuid: string): Promise<CloudMusicTrack>;
  preview(uuid: string): CloudMusicResourceUrls;
  cleanupTemp(input: CloudMusicTempCleanupInput): Promise<CloudMusicTempCleanupResult>;
}
```

- [ ] **Step 1: 实现管理端上传会话**

固定 owner=system，事务预登记 UUID、曲目和资产后再生成 Token。Token 生成失败时记录保持 temp/reserved，允许重试或清理，禁止删除记录掩盖问题。`reserveAsset()` 同样先为封面/歌词写入 pending 资产，再签发 Token，因此已有曲目后续新增或替换资产也不会产生幽灵文件。

- [ ] **Step 2: 实现幂等资产确认**

以 uuid + kind + objectKey + hash 幂等；重复 complete 返回已有结果，不重复解析。UUID/Key 相同但 Hash 不同返回 409。音频确认后解析元数据并提取封面，status 仍保持 temp。

- [ ] **Step 3: 实现手动保存**

```ts
export type CloudMusicAdminSaveInput = {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  status: "active" | "disabled" | "offline";
  statusReason?: string;
};
```

要求 uploadState=ready 且音频 uploaded。歌名 1-200 字、歌手 1-300、专辑 0-200、时长 0 至 24 小时整数毫秒；保存值覆盖解析初值，首次保存才把 temp 转为正式状态。

- [ ] **Step 4: 实现审核状态**

```ts
export type CloudMusicReviewInput =
  | { decision: "approve"; targetStatus: "active" | "disabled" }
  | { decision: "reject"; reason: string }
  | { decision: "resubmit"; reason?: string };
```

pending_review 可通过/拒绝；拒绝强制 1-500 字原因；rejected 可重新送审。首期 system 上传不经过审核，但后端和页面必须可管理未来 user owner 的记录。

- [ ] **Step 5: 实现封面回退和管理端预览**

替换封面/歌词时先完整上传并确认新资产，再事务切换 current；旧资产变为 superseded，随后尝试删除七牛对象并逻辑删除。删除手动封面后回退内嵌或默认封面。除 deleted 外且音频 uploaded 的状态均可生成 1 小时管理端试听 URL，供 temp、pending_review、rejected 审核。

- [ ] **Step 6: 实现一键清理**

```ts
export type CloudMusicTempCleanupInput = { olderThanHours: 0 | 24 | 72 };
export type CloudMusicTempCleanupResult = {
  scanned: number;
  deleted: number;
  failed: Array<{ uuid: string; message: string }>;
};
```

逐曲删除 temp 的全部资产，并一并回收超过阈值的 pending/superseded 资产；七牛 612 视为成功，其他错误保留对应记录。`olderThanHours=0` 只在管理端二次确认后发送。

- [ ] **Step 7: 保护统一文件删除**

`deleteManagedFileRecord()` 遇到 cloud-music 时，通过任意 fileRecordId 找到曲目并委托模块删除；禁止只删某个资产留下曲目悬空。移除手动封面走专用接口。

- [ ] **Step 8: 建议提交点**

```powershell
git add server/src/services/cloudMusicService.ts server/src/services/fileManagementService.ts
git commit -m "功能（server）：实现网盘音乐状态流转与临时清理"
```

### Task 4: 提供管理员上传、CRUD、审核和清理接口

**Files:**
- Create: `server/src/routes/adminCloudMusic.ts`
- Modify: `server/src/routes/admin.ts`

**Interfaces:**
- Consumes: Task 3 的 `CloudMusicModule`。
- Produces: `/api/admin/cloud-music/*`；继续使用管理员 JWT 和现有加密中间件。

- [ ] **Step 1: 挂载独立 Router**

```ts
adminRouter.use("/cloud-music", adminCloudMusicRouter);
```

路由只做参数读取、基础校验、管理员身份传递和响应映射。

- [ ] **Step 2: 增加上传与资产接口**

| Method | Path | 行为 |
|---|---|---|
| POST | `/api/admin/cloud-music/upload-sessions` | 先入库 temp/pending，再返回音频及可选封面/歌词 Token |
| POST | `/api/admin/cloud-music/:uuid/assets/:kind/reserve` | 先登记新增/替换资产，再返回 Token；已有 pending 时幂等重签 |
| POST | `/api/admin/cloud-music/:uuid/assets/:kind/complete` | stat、校验、解析并确认资产 |
| DELETE | `/api/admin/cloud-music/:uuid/cover` | 删除手动封面并回退 |

创建会话和 reserve 请求只接收文件的 fileName/fileSize/mimeType，不接收 owner、Key、Hash 或正式状态。audio 只允许创建会话时保留；reserve 仅允许 cover-uploaded/lyrics。

- [ ] **Step 3: 增加 CRUD、审核和预览接口**

| Method | Path | 行为 |
|---|---|---|
| GET | `/api/admin/cloud-music` | owner/状态/uploadState/格式/关键词分页 |
| GET | `/api/admin/cloud-music/:uuid` | 完整详情和关联资产 |
| PUT | `/api/admin/cloud-music/:uuid` | 保存四个手填字段及正式状态 |
| POST | `/api/admin/cloud-music/:uuid/review` | 审核通过、拒绝或重新送审 |
| GET | `/api/admin/cloud-music/:uuid/preview-url` | 管理端试听 URL |
| DELETE | `/api/admin/cloud-music/:uuid` | 删除全部七牛资产并逻辑删除 |

- [ ] **Step 4: 增加临时文件接口**

| Method | Path | 行为 |
|---|---|---|
| GET | `/api/admin/cloud-music/temp-summary` | 返回全部、24h、72h temp 曲目及 stale pending/superseded 资产数量和大小 |
| POST | `/api/admin/cloud-music/temp-cleanup` | `{ olderThanHours: 0|24|72 }`，清理 temp 曲目和过期非 current 资产，返回部分成功结果 |

批量清理部分失败仍返回 200 和 failed[]；模块整体异常才返回 500。

- [ ] **Step 5: 建议提交点**

```powershell
git add server/src/routes/adminCloudMusic.ts server/src/routes/admin.ts
git commit -m "功能（server）：提供网盘音乐管理与审核接口"
```

### Task 5: 提供独立 `cloud` 音源搜索、详情和资源地址

**Files:**
- Create: `server/src/routes/cloudMusic.ts`
- Modify: `server/src/index.ts`

**Interfaces:**

```ts
export type CloudMusicPublicTrack = Pick<
  CloudMusicTrack,
  "uuid" | "source" | "title" | "artist" | "album" | "durationMs" | "format" | "playable" | "cover" | "lyrics" | "createdAt" | "updatedAt"
>;

export type CloudMusicSearchResponse = {
  source: "cloud";
  items: CloudMusicPublicTrack[];
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

```ts
app.use("/api/cloud-music", cloudMusicRouter);
```

不得挂入 configRouter、音乐网关或跨源聚合搜索。

- [ ] **Step 2: 实现客户端接口**

| Method | Path | 规则 |
|---|---|---|
| GET | `/api/cloud-music/search?keyword&offset&limit` | active + disabled；disabled.playable=false |
| GET | `/api/cloud-music/tracks/:uuid` | active + disabled 可见；其他 404 |
| GET | `/api/cloud-music/tracks/:uuid/play-url` | 仅 active；disabled 403，其他 404 |
| GET | `/api/cloud-music/tracks/:uuid/lyrics-url` | 仅 active 且有歌词；无歌词 404，disabled 403 |

关键词匹配 title、artist、album、UUID；limit 默认 30、最大 100，空关键词按 created_at DESC。

- [ ] **Step 3: 生成封面地址**

手动/内嵌封面返回 1 小时七牛签名 URL，默认封面返回 `/static/cloud-music/default-cover.svg`；不得返回 bucket、objectKey、Hash 或 owner 邮箱。

- [ ] **Step 4: 保持加密和隔离**

接口 JSON 继续由现有加密中间件处理；资源字节走短期七牛 URL，不修改 `DEFAULT_PLAINTEXT_PATHS`。

- [ ] **Step 5: 建议提交点**

```powershell
git add server/src/routes/cloudMusic.ts server/src/index.ts
git commit -m "功能（server）：开放独立网盘音乐源接口"
```

### Task 6: 增加管理后台 CRUD、审核和清理页面

**Files:**
- Create: `server/admin/src/types/cloudMusic.ts`
- Create: `server/admin/src/api/cloudMusic.ts`
- Modify: `server/admin/src/api/client.ts`
- Create: `server/admin/src/components/tabs/CloudMusicManagementTab.tsx`
- Create: `server/admin/src/components/modals/CloudMusicUploadModal.tsx`
- Create: `server/admin/src/components/modals/CloudMusicEditModal.tsx`
- Create: `server/admin/src/components/modals/CloudMusicReviewModal.tsx`
- Modify: `server/admin/src/components/tabs/FileManagementTab.tsx`
- Modify: `server/admin/src/constants/theme.ts`
- Modify: `server/admin/src/App.tsx`

**Interfaces:**

```ts
export type CloudMusicSelectedFiles = {
  audio: File;
  cover?: File;
  lyrics?: File;
};

export type CloudMusicUploadProgress = (state: {
  phase: "reserving" | "audio" | "cover" | "lyrics" | "processing";
  percent: number;
}) => void;

export type CloudMusicTempSummary = {
  total: { count: number; bytes: number };
  olderThan24h: { count: number; bytes: number };
  olderThan72h: { count: number; bytes: number };
  staleAssets: { count: number; bytes: number };
};

export async function createCloudMusicUploadSession(files: CloudMusicSelectedFiles): Promise<CloudMusicUploadSession>;
export async function uploadCloudMusicSession(session: CloudMusicUploadSession, files: CloudMusicSelectedFiles, onProgress: CloudMusicUploadProgress): Promise<CloudMusicTrack>;
export async function saveCloudMusic(uuid: string, input: CloudMusicAdminSaveInput): Promise<CloudMusicTrack>;
export async function reviewCloudMusic(uuid: string, input: CloudMusicReviewInput): Promise<CloudMusicTrack>;
export async function fetchCloudMusicTempSummary(): Promise<CloudMusicTempSummary>;
export async function cleanupCloudMusicTemp(olderThanHours: 0 | 24 | 72): Promise<CloudMusicTempCleanupResult>;
```

- [ ] **Step 1: 复用现有请求和上传实现**

从 `client.ts` 导出 `adminJson<T>()`、现有 `uploadFileToQiniu()` 和上传类型，禁止复制 JWT、AES、401 清理或 XHR 进度逻辑。

- [ ] **Step 2: 实现三资产上传流程**

弹窗支持一个必选音频、一个可选封面、一个可选歌词：

```text
创建临时记录 → 上传/确认音频 → 上传/确认可选封面 → 上传/确认可选歌词
→ 服务端解析完成 → 打开编辑弹窗，曲目仍为临时
```

关闭或失败后列表仍显示 temp/uploadState/原因，可重试或删除。编辑弹窗也允许后续新增/替换手动封面和歌词，继续使用“先 reserve、后上传、再 complete”的相同流程。

- [ ] **Step 3: 实现编辑保存**

只手填歌名、歌手、专辑、时长，初值来自解析结果；时长支持 mm:ss/hh:mm:ss。首次保存选择“可用（默认）/禁用/下架”，成功后才转正式状态。

- [ ] **Step 4: 实现列表和审核**

支持关键词、所有者、业务状态、上传状态、格式筛选；显示封面、四个主要字段、格式、大小、owner、状态、更新时间。操作包括试听、编辑、审核、切换可用/禁用、下架、删除。待审核可试听后通过或填写 1-500 字原因拒绝。

- [ ] **Step 5: 实现一键清理**

工具栏显示 temp 数量和“清理临时文件”。先读 summary，再选 24h/72h/全部；全部使用危险色二次确认。完成提示成功/失败数量和失败 UUID，并刷新曲库及文件管理。

- [ ] **Step 6: 接入菜单和统一文件管理**

`theme.ts` 新增 `{ id: 'cloudMusic', name: '网盘音乐' }`；`App.tsx` 只 lazy import 和挂载。`FileManagementTab.tsx` 增加 cloud-music、owner、audio/cover/lyrics 资产和 pending 状态。

- [ ] **Step 7: 建议提交点**

```powershell
git add server/admin/src
git commit -m "功能（server）：增加网盘音乐管理审核界面"
```

### Task 7: 补齐接口文档和项目上下文

**Files:**
- Create: `server/apidoc/cloudMusic/searchTracks.md`
- Create: `server/apidoc/cloudMusic/getTrack.md`
- Create: `server/apidoc/cloudMusic/getPlayUrl.md`
- Create: `server/apidoc/cloudMusic/getLyricsUrl.md`
- Create: `server/apidoc/admin/createCloudMusicUploadSession.md`
- Create: `server/apidoc/admin/reserveCloudMusicAsset.md`
- Create: `server/apidoc/admin/completeCloudMusicAsset.md`
- Create: `server/apidoc/admin/listCloudMusic.md`
- Create: `server/apidoc/admin/getCloudMusicDetail.md`
- Create: `server/apidoc/admin/updateCloudMusic.md`
- Create: `server/apidoc/admin/reviewCloudMusic.md`
- Create: `server/apidoc/admin/getCloudMusicPreviewUrl.md`
- Create: `server/apidoc/admin/getCloudMusicTempSummary.md`
- Create: `server/apidoc/admin/cleanupCloudMusicTemp.md`
- Create: `server/apidoc/admin/deleteCloudMusic.md`
- Modify: `server/apidoc/index.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写明客户端契约**

包含方法、路径、加密、参数、完整响应、400/403/404/409/500、状态可见矩阵和“source=cloud 不参与其他音源聚合”。

- [ ] **Step 2: 写明上传会话契约**

明确先建 temp/pending 再返回固定 Key Token；complete 只确认已有记录。写清中断保留、清理阈值、部分失败、幂等规则。

- [ ] **Step 3: 写明状态、owner 和资产契约**

列出七种 status、五种 uploadState、转换、system/user 规则、disabled 可搜不可取资源、待审核仅管理员试听、封面三级回退和歌词限制。

- [ ] **Step 4: 更新索引与 AGENTS**

`apidoc/index.md` 增加客户端和管理端小节；`AGENTS.md` 增加表、模块 seam、状态机、owner、Key、临时清理、封面/歌词、删除语义和独立音源约束。

- [ ] **Step 5: 建议提交点**

```powershell
git add server/apidoc AGENTS.md
git commit -m "文档（server）：补充网盘音乐状态与审核契约"
```

### Task 8: 轻量构建检查和人工验收交接

**Files:**
- Read-only verify: `server/src/**`
- Read-only verify: `server/admin/src/**`
- Read-only verify: `server/apidoc/**`

- [ ] **Step 1: 服务端构建**

```powershell
pnpm --dir server build
```

Expected: TypeScript 编译成功。

- [ ] **Step 2: 管理后台构建**

```powershell
pnpm --dir server/admin build
```

Expected: `tsc --noEmit` 和 Vite 构建成功；不提交忽略的 `server/web-admin/`。

- [ ] **Step 3: 检查格式和范围**

```powershell
git diff --check
git status --short
```

Expected: 无空白错误；原有 `yixi/` 改动保持原样。

- [ ] **Step 4: 交给老大做非复杂人工验收**

1. 创建会话后暂停上传，确认立即出现 owner=system、temp/reserved；
2. 上传后不保存，刷新仍为 temp，客户端搜不到；
3. 清理过期/全部 temp，确认七牛资产和临时文件记录同步处理；
4. 验证手动封面 > 内嵌封面 > 默认封面；
5. 上传 LRC，active 时能取歌词地址；
6. 四个字段先解析，人工修改保存后不被覆盖；
7. active 可搜可播，disabled 可搜但播放 403，其他状态不可搜；
8. pending_review 可在管理端试听，审核通过后才对客户端可用；
9. 删除后全部资产从七牛删除，数据库只逻辑删除；
10. cloud 结果不混入 KG/WY/KW。

不运行全量测试、不做压力测试、不启动 Android/PC、不打安装包。

---

## Out of Scope for This Phase

- Android/PC 客户端正式接入 `cloud`、播放器和下载缓存；
- 与 KG/WY/KW 的聚合搜索；
- 普通用户上传页面、配额、私有可见性和主动共享开关；
- 自动解析内嵌歌词、歌词匹配和逐字歌词转换；
- 封面裁剪、缩略图服务和图片转码；
- 批量导入、分片上传、断点续传、音频转码和响度分析；
- 已删除曲目恢复、替换音频保留 UUID；
- 自动定时清理 temp；首期只提供管理端一键清理。
