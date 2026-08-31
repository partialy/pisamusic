# 七牛双空间迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PisaMusic 相关七牛资源收敛为一个公开空间和一个私有空间，并在不丢资源、不破坏线上链接的前提下逐步停用多余空间。

**Architecture:** 公开空间只放无需鉴权即可访问的头像和未来明确的公开静态资源；私有空间承载网盘音乐、歌词、内嵌封面、Android/PC 安装包和自动更新资源。对象 Key 使用稳定的业务前缀区分用途，前缀只负责组织，不承担权限控制；权限由空间类型和服务端签名下载决定。

**Tech Stack:** 七牛云 Kodo、七牛公开/私有空间、Node.js `qiniu` SDK、服务端 SQLite `file_records` / `cloud_music_assets` / `update_history`、`server/.env` 配置。

## Global Constraints

- `server` SQLite 的 `file_records` 是已登记七牛对象的唯一业务台账；迁移不得绕过台账直接改业务引用。
- 现有七牛安装包和 PC 自动更新资源继续通过服务端下载入口或临时签名 URL 对外提供，不把私有空间直链写入客户端持久数据。
- 网盘音乐音频、歌词、内嵌封面均保持私有，播放和歌词仍使用短时签名 URL。
- 公开空间只允许放公开资源；不能因为对象位于 `public/` 前缀就将私有数据放入公开空间。
- 迁移期间源空间必须保留，完成双重校验和观察期后才能关停或删除。
- `server/.env` 中的访问密钥不提交 Git；迁移操作使用最小权限账号并单独记录操作者和时间。
- 未登记对象不能直接删除；必须先建立“保留 / 待确认 / 可清理”清单并获得确认。

## Current Audit Snapshot

- 当前配置的主空间为 `oss-music-partialy`，公开图片空间为 `oss-avatar-public`。
- 主空间实际列出 20 个对象，约 438,818,529 字节；公开图片空间实际列出 5 个对象，约 2,871,263 字节。
- 主空间对象前缀为 `pisamusic/cloud-music/`、`pisamusic/desktop-updates/`、`pisamusic/releases/`，公开空间对象前缀为 `pisamusic/account-avatars/`。
- 数据库当前仅有 3 个有效登记对象，约 16,554,265 字节；主空间另有 10 条已逻辑删除的登记记录。
- 对象清单与 `file_records` 对账后，主空间有 17 个未登记对象，公开空间有 5 个未登记对象。主空间未登记对象包含旧网盘音乐资产、Android 安装包和 PC 发布/更新文件，不能仅凭数据库状态判定为垃圾。
- 当前项目代码已经把网盘音乐和发布/更新资源指向主空间，把账号自定义头像指向公开图片空间；因此若这两个空间就是最终保留空间，迁移重点是对账和规范化，而不是再次搬迁这两类现有对象。

## Target Layout

| 空间 | 访问策略 | 允许的对象前缀 | 典型资源 |
| --- | --- | --- | --- |
| `private`（可继续使用现有主空间） | 默认私有；由服务端签名或下载入口访问 | `pisamusic/cloud-music/`、`pisamusic/releases/`、`pisamusic/desktop-updates/` | 网盘音频、歌词、封面、APK、EXE、`latest.yml`、blockmap |
| `public`（可继续使用现有公开图片空间） | 公开读取 | `pisamusic/account-avatars/`、未来明确的公开静态资源前缀 | 账号自定义头像、确实无需保护的图片 |

建议保留现有对象 Key，不做无收益的重命名。这样可以降低数据库引用、缓存和旧客户端链接的变化范围；只有跨空间移动时才需要更新数据库中的 `bucket`，并同步更新服务端生成 URL 所依赖的配置。

### Task 1: 完成七牛账号级空间和域名盘点

**Files:**
- Read only: `server/.env`
- Read only: `server/.env.example`
- Read only: `server/src/services/qiniuReleaseFiles.ts`
- Read only: `server/src/db/appDb.ts`

**Interfaces:**
- Consumes: 七牛控制台的空间列表、绑定域名、空间类型、区域、访问控制和生命周期规则。
- Produces: 带时间戳的空间资产清单，以及最终保留的 `public` / `private` 空间名称、域名和区域。

- [ ] 核对七牛账号控制台中全部空间，而不仅是项目 `.env` 中出现的空间。
- [ ] 对每个空间记录：空间名、区域、公开/私有、绑定域名、HTTPS 状态、生命周期规则、镜像/回源、跨域规则、对象数量和总容量。
- [ ] 确认是否存在其他 App、旧项目或手工脚本仍在使用未出现在 `server/.env` 中的空间。
- [ ] 若不存在额外业务空间，直接将现有主空间定为私有目标、现有图片空间定为公开目标，避免做无必要的跨桶迁移。
- [ ] 若存在额外空间，先按对象前缀和域名归属归类，不允许在没有归属结论时关停空间。

### Task 2: 完成对象清单与业务台账对账

**Files:**
- Read only: `server/data/pm.db`
- Read only: `server/src/db/configStore.ts`
- Read only: `server/src/db/cloudMusicStore.ts`
- Read only: `server/src/db/userStore.ts`

**Interfaces:**
- Consumes: 七牛对象列表和对象元信息、SQLite 中的 `file_records`、`cloud_music_assets`、`cloud_music_tracks`、`update_history`、`release_info`、`current_update`、用户头像 Key。
- Produces: 每个对象的业务归属、当前引用、迁移目标、处置建议和校验依据。

- [ ] 以 `bucket + object_key` 对七牛对象和 `file_records` 做精确匹配，不能只按文件名或前缀匹配。
- [ ] 对 `pisamusic/cloud-music/` 对象回查曲目状态、资产状态和 `file_records.status`，区分当前可播放、历史保留和待清理资产。
- [ ] 对 `pisamusic/releases/`、`pisamusic/desktop-updates/` 对象回查 Android/PC 当前发布、历史发布、`latest.yml`、EXE 和 blockmap 引用。
- [ ] 对公开头像对象回查用户当前 `avatar_key`；未被当前用户引用的头像只标为候选清理，不在本阶段删除。
- [ ] 对 17 个未登记私有对象建立人工确认清单；特别检查旧 APK 和 PC 安装包是否仍被官网、旧客户端或外部文档直接引用。
- [ ] 输出迁移前基线：对象数量、总字节数、每个前缀数量、每个业务引用数量和校验失败数量。

### Task 3: 先做目标空间和权限准备

**Files:**
- Modify only after approval: `server/.env`
- Modify only after approval: `server/.env.example`
- Review when configuration semantics change: `AGENTS.md`

**Interfaces:**
- Consumes: Task 1 的目标空间、区域、域名和访问控制结论。
- Produces: 可回滚的生产配置备份，以及明确的两空间配置映射。

- [ ] 为目标公开空间配置独立的 HTTPS 公开域名；公开空间禁止写入访问密钥或私有签名参数。
- [ ] 为目标私有空间配置 HTTPS 下载域名；私有资源继续由服务端生成临时签名 URL。
- [ ] 核对上传区域与 `QINIU_UPLOAD_URL` 的匹配关系，避免迁移后上传成功率或延迟异常。
- [ ] 在变更前保存脱敏后的旧配置、变更后的配置和回滚配置；真实密钥不写入计划、日志或 Git。
- [ ] 如果变量命名从“主空间/公开图片空间”调整为“private/public”，先确保服务端、后台、Android、PC 和接口文档的语义同步，再切换生产配置。

### Task 4: 执行跨空间复制并进行对象级校验

**Files:**
- No source-code changes in the migration operation.
- Migration manifest: store outside Git or in an approved operations location; do not commit access keys.

**Interfaces:**
- Consumes: Task 2 的对象迁移清单、Task 3 的目标空间和最小权限凭据。
- Produces: 目标空间对象、源目标映射表、复制结果和失败重试清单。

- [ ] 先选 1 个头像、1 个网盘音频及其歌词/封面、1 个 APK、1 个 EXE、1 个 `latest.yml` 和 1 个 blockmap 做小批量试迁移。
- [ ] 复制时尽量保留原始 Key、文件大小、MIME、ETag/hash 和必要的元数据；不能用下载后重新上传导致内容变化而不记录差异。
- [ ] 目标空间逐对象执行 `stat` 或等价校验，至少确认对象存在、大小一致、hash 一致、MIME 可接受。
- [ ] 小批量通过后再复制剩余对象；失败对象单独重试，不以“整体任务成功”掩盖单对象失败。
- [ ] 源空间保持不变，迁移期间不执行删除、覆盖或生命周期清理。

### Task 5: 切换数据库引用和线上读取路径

**Files:**
- Modify only after migration approval: `server/src/db/configStore.ts`
- Modify only after migration approval: `server/src/db/cloudMusicStore.ts`
- Modify only after migration approval: `server/src/services/qiniuReleaseFiles.ts`
- Modify only after migration approval: `server/src/services/cloudMusicAssets.ts`
- Modify only after migration approval: `server/src/db/userStore.ts`
- Update if API behavior or fields change: `server/apidoc/` and `server/apidoc/index.md`

**Interfaces:**
- Consumes: 目标空间对象和对象级校验结果。
- Produces: 业务台账指向目标空间、服务端签名指向目标私有域名、公开头像指向目标公开域名。

- [ ] 先切换一小组非关键对象或测试记录，验证后台文件详情、网盘搜索/详情、播放、歌词、封面、头像、Android 更新下载和 PC 自动更新读取。
- [ ] 对已登记对象更新 `file_records.bucket`，确保 `cloud_music_assets` 和发布引用仍通过同一个 `file_record_id` 找到对象。
- [ ] 对跨桶移动的头像更新用户实际引用的 URL 生成来源；默认头像仍使用服务端静态文件，不上传到七牛。
- [ ] 保留安装包的服务端下载入口契约，不把目标私有域名直接返回给客户端持久化。
- [ ] 做服务端 TypeScript 构建和最小接口联调；不在迁移窗口启动不必要的全量重构。

### Task 6: 观察期、清理和旧空间关停

**Files:**
- Read only after cutover: `server/data/pm.db`
- Read only after cutover: `server/src/db/configStore.ts`
- Read only after cutover: `server/src/db/cloudMusicStore.ts`

**Interfaces:**
- Consumes: 切换后的访问日志、失败上报、七牛源/目标空间对象清单和业务回归结果。
- Produces: 关停决策、最终清理清单和可审计的迁移完成记录。

- [ ] 观察至少覆盖一个完整发布/更新周期和正常用户播放周期；期间保留源空间对象。
- [ ] 重跑对象数量、字节数、hash、MIME、数据库引用和关键接口检查，确认没有新写入错误空间。
- [ ] 先清理已确认废弃的未登记对象和历史残留，仍有争议的对象继续保留。
- [ ] 只有在零关键引用、零关键访问错误、目标空间校验通过且回滚备份可用时，才暂停旧空间写入。
- [ ] 再经过短期观察后才删除旧空间对象或注销空间；删除前保存最终清单，删除后保留七牛操作记录和服务端迁移记录。

## Acceptance Criteria

- 七牛账号中最终只保留一个公开业务空间和一个私有业务空间；其他空间已确认无业务依赖后才关停。
- 新上传资源不再出现第三个业务空间，且通过对象前缀能直接判断用途。
- 私有网盘音乐、歌词、内嵌封面、安装包和 PC 更新文件无法通过未签名 URL 直接读取；服务端签名读取正常。
- 公开头像在 Android、PC、分享页和后台用户详情中均能正常显示。
- `file_records` 与目标空间对象逐条对账通过；未登记旧对象均有明确的保留或清理结论。
- Android 下载、PC generic feed、网盘播放/歌词/封面、头像上传/展示均完成最小回归。
- 迁移过程可用源空间回滚，且没有通过物理删除数据库记录破坏历史台账。

## Rollback

出现目标对象缺失、签名 URL 失败、头像批量失效、安装包下载失败或 PC 更新 feed 异常时，立即恢复旧的空间域名/配置和数据库引用，源空间对象保持不动；确认线上恢复后，再单独处理失败对象。未完成对账前不得删除源空间对象，也不得删除 `file_records` 历史记录。

## Self-review

- 已覆盖账号级空间盘点、数据库与对象对账、权限准备、试迁移、全量复制、引用切换、观察、清理和回滚。
- 未把任何未登记对象默认视为垃圾；当前 17 个未登记私有对象和 5 个公开头像对象均要求先确认归属。
- 方案优先复用现有两个已配置空间，避免为了“命名统一”产生无收益的二次搬迁。
- 本计划阶段不修改业务代码、不修改线上配置、不删除七牛对象；后续执行必须在单独批准后按任务推进。
