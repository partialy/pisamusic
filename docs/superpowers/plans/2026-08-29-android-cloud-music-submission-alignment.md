# Android 云盘投稿、投稿记录与重新提审对齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PC 端现有的云盘“我要投稿、我的投稿记录、修改后重新提审”完整业务接入 Android，并继续使用手机端现有云盘统一入口。

**Architecture:** 后端 `/api/cloud-music/submit/*` 契约保持不变，Android 的 system Retrofit 继续统一处理账号 Token、运行时服务地址和 AES-GCM。新增独立 `CloudMusicSubmissionRepository` 负责投稿接口与七牛 URI 流式直传，`CloudMusicSubmissionViewModel` 负责上传/编辑/历史/重审状态机，现有 `CloudMusicSubmissionActivity` 改为同时承载“我要投稿”和“投稿记录”的统一投稿中心；重审复用同一套元数据编辑区，不新增平行业务页面。

**Tech Stack:** Kotlin、Android ViewBinding、Hilt、StateFlow、Retrofit、OkHttp、Activity Result API、Material Components、RecyclerView、Coil。

## Global Constraints

- 只修改 `pm/` Android 客户端和本计划文档；本轮已经确认后端接口齐全，不改 `server/`、`server/apidoc/` 和 `yixi/`。
- 手机端继续复用现有 `CloudMusicSubmissionActivity`，不新建另一套投稿 Activity。
- 云盘首页仍是统一入口：保留“搜索云盘”“我要投稿”，新增“投稿记录”；“重新提审”只出现在允许操作的投稿记录内。
- 投稿、投稿记录和重新提审都要求 PisaMusic 系统账号登录；未登录时进入投稿中心显示登录引导，登录返回后原地恢复。
- 业务字段、状态文案和允许操作范围与 PC 一致：`pending_review` 可“完善信息”，`rejected` 可“修改重提”，`active/disabled/deleted` 不显示重提按钮，`deleted` 明确提示文件已销毁。
- 音频支持 `.mp3/.flac/.wav/.ogg/.m4a/.aac`，封面支持 `.jpg/.jpeg/.png/.webp`，歌词支持 `.lrc/.txt`；服务端仍是最终校验方。
- 音频和附件必须从 `content://` 流式写入 OkHttp 请求，禁止对大音频调用 `readBytes()`；七牛直传不得经过 system AES 或音乐网关拦截器。
- 不持久化七牛 `uploadToken`、上传 URL 或投稿曲目的临时封面签名 URL；只保留当前页面内存状态。
- 不增加复杂自动化测试，不安装、不启动 App；完成后只执行 `git diff --check` 和 `:app:compileDebugKotlin`，真机业务验收由用户完成。

---

## 已确认的复用契约

Android 直接复用下列现有接口，所有接口都使用 `Authorization: Bearer <userToken>` 并走 system AES-GCM：

| 业务 | Method | Path |
| --- | --- | --- |
| 创建投稿上传会话 | `POST` | `/api/cloud-music/submit/upload-sessions` |
| 补充/更换封面或歌词 | `POST` | `/api/cloud-music/submit/:uuid/assets/:kind/reserve` |
| 确认七牛资产上传完成 | `POST` | `/api/cloud-music/submit/:uuid/assets/:kind/complete` |
| 移除手动封面 | `DELETE` | `/api/cloud-music/submit/:uuid/cover` |
| 保存并正式投稿 | `POST` | `/api/cloud-music/submit/:uuid/save` |
| 查询当前账号投稿记录 | `GET` | `/api/cloud-music/submit/my-history?offset&limit` |
| 修改信息并重新提审 | `POST` | `/api/cloud-music/submit/:uuid/resubmit` |

关键状态保持与 PC 一致：

```kotlin
enum class CloudMusicSubmissionStatus(val wireValue: String) {
    TEMP("temp"),
    PENDING_REVIEW("pending_review"),
    ACTIVE("active"),
    DISABLED("disabled"),
    REJECTED("rejected"),
    DELETED("deleted"),
    UNKNOWN("unknown"),
}
```

---

### Task 1: 补齐 Android 投稿 DTO 与 Retrofit 契约

**Files:**
- Create: `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicSubmissionModels.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicModels.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`

**Interfaces:**
- Consumes: 现有 `CloudMusicEnvelope<T>`、`CloudMusicTrackDto` 和 system Retrofit。
- Produces: 强类型上传会话、上传凭证、历史分页、提交输入，以及七个投稿接口方法。

- [x] **Step 1: 扩展共享曲目 DTO**

在 `CloudMusicTrackDto` 增加可选投稿字段，保持公开搜索响应兼容：

```kotlin
val status: String? = null,
val statusReason: String? = null,
```

- [x] **Step 2: 定义投稿网络模型**

在 `CloudMusicSubmissionModels.kt` 定义：

```kotlin
data class CloudMusicSelectedFileDto(
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
)

data class CloudMusicUploadSessionRequest(
    val audio: CloudMusicSelectedFileDto,
    val cover: CloudMusicSelectedFileDto? = null,
    val lyrics: CloudMusicSelectedFileDto? = null,
)

data class CloudMusicAssetReserveRequest(
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
    val kind: String,
)

data class CloudMusicAssetUploadTicketDto(
    val assetId: String,
    val fileRecordId: String,
    val kind: String,
    val key: String,
    val uploadToken: String,
    val uploadUrl: String,
)

data class CloudMusicUploadSessionDto(
    val uuid: String = "",
    val track: CloudMusicTrackDto,
    val tickets: List<CloudMusicAssetUploadTicketDto> = emptyList(),
)

data class CloudMusicSubmissionInput(
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
)

data class CloudMusicSubmissionHistoryDto(
    val items: List<CloudMusicTrackDto> = emptyList(),
    val total: Int = 0,
    val offset: Int = 0,
    val limit: Int = 30,
)
```

- [x] **Step 3: 增加 Retrofit 方法**

所有投稿方法都显式接收 `authorization: String`；路径和 HTTP Method 严格使用上表，不在 Activity 拼 URL。历史分页的 `limit` 在 Repository 中限制为 `1..100`。

- [x] **Step 4: 静态核对契约**

核对 Kotlin 字段与 `server/apidoc/cloudMusic/submit.md`、`yixi/src/types/cloudMusic.ts` 一致，尤其是 `kind="cover-uploaded"`、`durationMs` 和 `statusReason`，然后运行：

```powershell
git diff --check -- pm/app/src/main/java/cn/partialy/pm/network
```

Expected: 无输出。

---

### Task 2: 实现 Content URI 文件解析与七牛流式直传

**Files:**
- Create: `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicSubmissionFile.kt`
- Create: `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicUploadRequestBody.kt`
- Create: `pm/app/src/main/java/cn/partialy/pm/network/cloudmusic/CloudMusicSubmissionRepository.kt`

**Interfaces:**
- Consumes: `ContentResolver`、`@Named("cloud_asset_okhttp") OkHttpClient`、`SystemApiService`、`AccountSessionStore`。
- Produces: `resolveFile(uri, kind)`、`createAndUploadSubmission(...)`、`replaceCover(...)`、`replaceLyrics(...)`、`removeCover(...)`、`getHistory(...)`、`save(...)`、`resubmit(...)`。

- [x] **Step 1: 定义页面内文件描述**

```kotlin
enum class CloudMusicSubmissionFileKind { AUDIO, COVER, LYRICS }

data class CloudMusicSubmissionFile(
    val uri: Uri,
    val displayName: String,
    val size: Long,
    val mimeType: String,
    val kind: CloudMusicSubmissionFileKind,
)
```

`resolveFile()` 使用 `OpenableColumns.DISPLAY_NAME/SIZE` 和 `ContentResolver.getType()`；拒绝空文件及不在全局约束中的扩展名，不复制文件到应用目录。

- [x] **Step 2: 创建可汇报进度的流式 RequestBody**

`CloudMusicUploadRequestBody` 每次 `writeTo()` 重新打开 `contentResolver.openInputStream(uri)`，以 32 KiB 缓冲写入 `BufferedSink`，按已写字节/总字节回调 `0..100`。协程取消或 OkHttp Call 取消时立即停止，不把整个音频读入内存。

- [x] **Step 3: 封装七牛 multipart 直传**

请求体字段与 PC 完全一致：

```text
token=<ticket.uploadToken>
key=<ticket.key>
x:name=<displayName>
file=<streaming request body>
```

上传必须使用现有 `@Named("cloud_asset_okhttp")` client。该 client 不带 system AES/Auth/gateway header，并强制 HTTPS；若 `uploadUrl` 不是 HTTPS，Repository 直接报错。

- [x] **Step 4: 按 PC 顺序完成首次投稿上传**

流程固定为：

```text
创建 upload session
  -> 上传 audio
  -> 上传可选 cover
  -> complete cover-uploaded
  -> 上传可选 lyrics
  -> complete lyrics
  -> complete audio（触发服务端解析元数据/内嵌封面）
  -> 返回最新 CloudMusicTrackDto
```

上传进度使用 `AUDIO/COVER/LYRICS/PROCESSING` 四个 phase；Repository 只上报状态，不直接操作 View。

- [x] **Step 5: 封装附件替换、历史和提交动作**

`replaceCover/replaceLyrics` 先 reserve，再直传，再 complete；`removeCover` 只调用 DELETE；`save/resubmit` 共用同一个 `CloudMusicSubmissionInput` 校验函数：歌名 `1..200`、歌手 `1..300`、专辑最多 `200`、时长 `1..86_400_000ms`。

- [x] **Step 6: 统一登录和错误出口**

每个投稿 API 请求前从 `AccountSessionStore` 读取当前账号，未登录或 token 为空时抛出语义化 `CloudMusicSubmissionException.LoginRequired`。`CloudMusicEnvelope` 的 `msg` 原样进入 UI，避免把后端“已销毁”“已上架”等原因覆盖成统一失败文案。

---

### Task 3: 建立统一投稿中心 ViewModel 状态机

**Files:**
- Create: `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/submission/CloudMusicSubmissionViewModel.kt`
- Create: `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/submission/CloudMusicSubmissionUiState.kt`

**Interfaces:**
- Consumes: `CloudMusicSubmissionRepository`。
- Produces: 单一 `StateFlow<CloudMusicSubmissionUiState>` 和一次性 `SharedFlow<CloudMusicSubmissionEvent>`，Activity 不直接调用 Retrofit/OkHttp。

- [x] **Step 1: 定义页面和编辑模式**

```kotlin
enum class CloudMusicSubmissionSection { SUBMIT, HISTORY }
enum class CloudMusicSubmissionEditorMode { NEW_SUBMISSION, RESUBMISSION }
enum class CloudMusicSubmissionStage { SELECT_FILES, UPLOADING, EDIT_METADATA, SUCCESS }

data class CloudMusicSubmissionUiState(
    val loggedIn: Boolean = false,
    val section: CloudMusicSubmissionSection = CloudMusicSubmissionSection.SUBMIT,
    val stage: CloudMusicSubmissionStage = CloudMusicSubmissionStage.SELECT_FILES,
    val editorMode: CloudMusicSubmissionEditorMode = CloudMusicSubmissionEditorMode.NEW_SUBMISSION,
    val audio: CloudMusicSubmissionFile? = null,
    val cover: CloudMusicSubmissionFile? = null,
    val lyrics: CloudMusicSubmissionFile? = null,
    val editingTrack: CloudMusicTrackDto? = null,
    val uploadPhase: CloudMusicUploadPhase? = null,
    val uploadPercent: Int = 0,
    val historyItems: List<CloudMusicTrackDto> = emptyList(),
    val historyTotal: Int = 0,
    val historyLoading: Boolean = false,
    val historyLoadingMore: Boolean = false,
    val historyError: String? = null,
    val operationInProgress: Boolean = false,
)
```

- [x] **Step 2: 实现首次投稿状态流**

`selectAudio/selectCover/selectLyrics` 只更新选择状态；`uploadAndExtract()` 调 Repository 并把解析结果填入 `editingTrack`；`submitMetadata(input)` 成功后进入 `SUCCESS` 并发送 `SubmissionChanged` 事件。

- [x] **Step 3: 实现历史分页**

固定 `PAGE_SIZE = 30`。切到 HISTORY 首次加载 offset 0；下拉刷新替换列表；接近列表末尾加载下一页；按 `uuid` 去重追加；加载下一页失败保留已有记录。空态、首屏错误和尾页错误不能互相覆盖。

- [x] **Step 4: 实现重审编辑状态**

`openResubmission(track)` 仅接受 `rejected/pending_review`，将 `editorMode` 设为 `RESUBMISSION` 并复用元数据编辑 stage。重审时允许更换/补充封面和歌词；提交成功后返回 HISTORY、刷新第一页并发送 `SubmissionChanged`。

- [x] **Step 5: 定义返回优先级**

系统返回键按顺序处理：正在上传/提交时提示操作进行中且不退出；重审编辑返回历史；首次投稿编辑返回文件选择；其他情况才关闭 Activity。切换 Tab 时不自动重复发请求，也不丢失已选文件。

---

### Task 4: 将占位 Activity 改为“我要投稿”完整流程

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/CloudMusicSubmissionActivity.kt`
- Replace: `pm/app/src/main/res/layout/activity_cloud_music_submission.xml`
- Create: `pm/app/src/main/res/layout/include_cloud_music_submission_editor.xml`
- Modify: `pm/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: `CloudMusicSubmissionViewModel`、Activity Result API 和现有 edge-to-edge/转场封装。
- Produces: 可选择文件、查看上传进度、确认元数据、提交成功的手机端流程。

- [x] **Step 1: 改造统一页面壳**

Toolbar 标题改为“云盘投稿”，下方使用两枚同组按钮“我要投稿 / 投稿记录”。页面主体只显示一个状态：登录提示、文件选择、上传进度、元数据编辑、成功结果或历史列表。

- [x] **Step 2: 注册三个文件选择器**

使用 `ActivityResultContracts.OpenDocument()`：音频、封面、歌词分别注册 launcher；选中 URI 后交给 Repository 的文件解析器，不在 Activity 读取字节。音频为必选，封面和歌词允许清除后重新选择。

- [x] **Step 3: 构建首次投稿文件选择区**

页面显示一个主音频选择卡和两个附件卡，复用当前 `bg_cloud_music_summary`、`bg_cloud_music_entry_card`、主题颜色及 `@dimen/pm_page_content_start`。主按钮文案“上传并解析歌曲元数据”；上传时禁用文件选择和 Tab，展示当前 phase、文件名和线性进度。

- [x] **Step 4: 构建共享元数据编辑区**

`include_cloud_music_submission_editor.xml` 同时服务首次投稿和重审：封面预览、歌名、歌手、专辑、`mm:ss` 时长、歌词状态、更换封面、移除自定义封面（仅首次投稿编辑）、补充/替换歌词。字段长度和时长格式在点击提交时校验，错误显示在对应 `TextInputLayout`。

- [x] **Step 5: 构建成功态**

成功态显示“待管理员审核”，提供“继续投稿”和“查看投稿记录”。进入历史时直接加载最新记录；Activity 调用 `setResult(RESULT_OK)`，让云盘首页返回后刷新“我的贡献”和最近更新。

- [x] **Step 6: 处理登录引导**

未登录时显示“需要登录账号”和“立即登录 / 注册”，点击复用 `LoginActivity.start(this)`；`onResume()` 重新读取账号状态，登录成功后恢复原本请求的 SUBMIT/HISTORY section。

---

### Task 5: 接入投稿记录列表与重新提审

**Files:**
- Create: `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/submission/CloudMusicSubmissionHistoryAdapter.kt`
- Create: `pm/app/src/main/res/layout/item_cloud_music_submission_history.xml`
- Modify: `pm/app/src/main/res/layout/activity_cloud_music_submission.xml`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/CloudMusicSubmissionActivity.kt`
- Modify: `pm/app/src/main/res/values/strings.xml`
- Modify: `pm/app/src/main/res/values/colors.xml`
- Modify: `pm/app/src/main/res/values-night/colors.xml`

**Interfaces:**
- Consumes: ViewModel 的历史分页状态、`CloudMusicTrackDto.status/statusReason`。
- Produces: 投稿记录状态卡、刷新/分页、允许状态下的重审入口。

- [x] **Step 1: 实现 ListAdapter**

使用 `ListAdapter + DiffUtil`，身份固定为 `uuid`。每张卡展示封面、歌名、歌手、专辑、格式、时长、投稿时间、歌词标记、状态和状态原因；Coil 只加载当前 DTO 的封面 URL，不缓存进业务模型。

- [x] **Step 2: 对齐 PC 状态文案与操作**

| 状态 | 文案 | 额外说明 | 操作 |
| --- | --- | --- | --- |
| `temp` | 未保存 | 无 | 无 |
| `pending_review` | 待审核 | 展示当前状态原因（存在时） | 完善信息 |
| `active` | 已通过 | 已公开收录 | 无 |
| `disabled` | 已禁用 | 展示状态原因（存在时） | 无 |
| `rejected` | 已驳回 | 强调展示驳回原因 | 修改重提 |
| `deleted` | 已销毁 | 文件已从七牛云销毁，无法重提 | 无 |

- [x] **Step 3: 完成列表状态**

使用 `SwipeRefreshLayout + RecyclerView`。首屏加载、空记录、首屏错误、已有列表加载更多和尾页错误分别展示；空态按钮“立即发起首次投稿”切回 SUBMIT。

- [x] **Step 4: 复用编辑区进行重审**

点击“完善信息/修改重提”进入 `RESUBMISSION` 编辑模式，预填歌名、歌手、专辑、时长和现有封面/歌词。更换附件走 reserve/upload/complete；确认调用 `/resubmit`。成功后返回历史并刷新，失败保留用户输入与已上传附件状态。

- [x] **Step 5: 处理历史记录封面失败**

签名封面过期或图片失败时使用现有本地默认封面，不尝试把失败 URL 写入 SharedPreferences、数据库或歌曲收藏。

---

### Task 6: 在手机端云盘统一入口增加“投稿记录”按钮

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/ui/cloudmusic/CloudMusicFragment.kt`
- Modify: `pm/app/src/main/res/layout/fragment_cloud_music.xml`
- Modify: `pm/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: `CloudMusicSubmissionActivity.start(context, initialSection)` 和 Activity result。
- Produces: 云盘首页“搜索云盘 / 我要投稿 / 投稿记录”三个清晰入口。

- [x] **Step 1: 扩展统一功能专区**

保留当前两个功能卡，新增同视觉的“投稿记录”卡；手机宽度下采用“搜索云盘、我要投稿”双列 + “投稿记录”下一行全宽，避免三列文字拥挤。描述文案使用“查看审核进度”。

- [x] **Step 2: 增加初始 section 参数**

```kotlin
fun start(context: Context, initialSection: CloudMusicSubmissionSection = CloudMusicSubmissionSection.SUBMIT)
```

“我要投稿”传 SUBMIT，“投稿记录”传 HISTORY；Activity 旋转重建时优先使用 ViewModel 已恢复状态，不重复覆盖 section。

- [x] **Step 3: 返回后刷新云盘概览**

Fragment 使用 `StartActivityForResult` 启动投稿中心；收到 `RESULT_OK` 后调用现有 `viewModel.refresh()`，更新“我的贡献”和最近歌曲。只浏览历史且没有提交/重审时不触发无意义刷新。

---

### Task 7: 同步项目说明并执行轻量验证

**Files:**
- Modify: `pm/AGENTS.md`
- Modify: `pm/components.md`

**Interfaces:**
- Consumes: Tasks 1-6 的最终实现。
- Produces: 与实际代码一致的项目上下文和组件索引。

- [x] **Step 1: 更新 Android 项目说明**

把“投稿页是占位页”的旧说明改为：Android 已复用 server 投稿接口，支持 URI 流式上传、投稿历史和 `rejected/pending_review` 重审；临时上传凭证和签名 URL 不落库。

- [x] **Step 2: 更新组件索引**

将 `components.md` 的“投稿占位页”改为“云盘投稿中心”，登记统一页面、历史 Adapter、投稿记录卡和共享元数据编辑布局；云盘首页功能专区更新为三个入口。

- [x] **Step 3: 执行轻量验证**

```powershell
git diff --check
cd pm
.\gradlew.bat :app:compileDebugKotlin
```

Expected: `git diff --check` 无输出，Gradle 输出 `BUILD SUCCESSFUL`。

- [x] **Step 4: 检查最终改动范围**

```powershell
git status --short
git diff --stat
```

Expected: 只有本计划列出的 `pm/` 文件和计划文档；不包含 `server/`、`yixi/`、构建产物或用户无关改动。

---

## 手工验收清单

- 云盘首页出现“搜索云盘、我要投稿、投稿记录”三个入口，布局在浅色/深色模式下无拥挤或错位。
- 未登录打开投稿或记录时展示登录引导；登录返回后无需重新进入页面。
- 可从系统文件选择器选择音频、封面和歌词，上传大音频时内存稳定且进度持续更新。
- 音频解析后自动带出服务端识别的歌名、歌手、专辑、时长和内嵌封面；用户可修改后提交。
- 投稿成功后状态为待审核，并能立即在“投稿记录”中看到。
- 历史列表准确展示 `temp/pending_review/active/disabled/rejected/deleted`，驳回原因和销毁说明清楚。
- `rejected` 显示“修改重提”，`pending_review` 显示“完善信息”；active、disabled、deleted 不显示重提按钮。
- 重审可修改元数据、更换/补充封面和歌词；成功后列表状态更新为待审核。
- 投稿/重审返回云盘首页后，“我的贡献”和最近更新能刷新。
- 网络失败、七牛失败、服务端校验失败均保留当前可恢复状态并展示服务端原因，不崩溃、不重复提交。

## 不在本期范围

- 不修改 server 接口、数据库、审核后台或 PC 端实现。
- 不增加投稿草稿的本地持久化、断点续传或后台上传 Service。
- 不增加用户主动删除投稿记录/撤回审核；当前后端没有对应用户接口。
- 不允许更换已上传的主音频文件；需要换音频时重新发起一条投稿，与 PC 当前行为一致。
- 不运行完整测试、APK 安装、模拟器或真机自动化。

