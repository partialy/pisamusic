# 独立数据库部署、首次安装与双向复制

## 部署

- `DB_TYPE=SQLITE|MYSQL`（默认 SQLITE）唯一决定当前运行库，连接失败不回退。
- SQLite 使用 `PISA_APP_DB_PATH`，缺省为服务工作目录下 `data/pm.db`。
- MySQL 5.7 使用 `MYSQL_URL`；预先创建专用数据库和账号，首次空库由服务端建表。
- 独立部署只配置使用的引擎。使用双向复制时才需同时配置两种数据库；MySQL → SQLite 必须明确填写 `PISA_APP_DB_PATH`。
- 启动不依赖本机迁移完成记录、旧 `activatedMysql` 或连接串指纹。调整同库端口无需更新任务。
- 库内 `schema_migrations` 只维护结构版本（当前 v3）；`app_installation` 维护安装身份与完整性，两者分开。
- 完整库可复制到新部署目录后启动，不要求携带旧 `data/operations`。

## 首次安装

Admin 首屏读取 `GET /api/setup/status`，未安装进入 `/#/setup`，设置首个管理员后转登录。安装状态查询失败显示错误，不当作空库。

- 安装凭据使用 `SETUP_TOKEN`；未配置时生成仅当前进程有效的随机令牌并打印到服务端日志。
- 管理员、默认运行配置、默认听歌等级与完成标记事务提交，禁止并发重复安装。
- 现有库有管理员时自动补安装标记，保留账号配置；无管理员但有业务数据时走受令牌保护的补全，不清业务表。
- 未安装或复制未完成时，业务 HTTP、文件资源、Socket.IO 受门禁限制；健康检查、安装状态与 Admin 静态页面可访问。
- 管理员和用户 JWT 绑定 `installationId`；升级前不带该字段的旧 token 需要重新登录。独立安装的库互相隔离，完整副本保留源系统身份。

接口详情见 [首次安装](../system/setup.md)。

## 数据复制

路由前缀 `/api/admin/database-migration`，需要管理员 JWT。普通 JSON 沿用 AES-GCM，上传请求带 JWT 和 `x-pm-random`，下载为二进制。

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `/status` | 当前引擎、脱敏目标、维护状态、连接信息及备份 |
| POST | `/preflight` | `{sourceType,sourceId?}`，检查来源结构和目标可用性 |
| POST | `/snapshots` | `{sourceType,sourceId?}`，生成完整便携 `.db` |
| GET | `/snapshots/:id/download` | 下载备份二进制 |
| POST | `/uploads` | 上传完整 SQLite `.db`，检查完整性及外键 |
| POST | `/tasks` | `{sourceType,sourceId?,confirm:true,confirmOverwrite:true,mode:'sync'|'switch'}`，202返回任务 |
| GET | `/tasks` | 最近30个任务 |
| GET | `/tasks/:id` | 阶段、逐表结果、源备份及目标备份ID、错误与日志 |
| GET | `/tasks/:id/report` | JSON报告 |
| POST | `/maintenance/exit` | `{confirm:true}`，无活动任务且源库完整时恢复源库 |

当前运行库为源，另一引擎为目标：SQLite → MySQL 或 MySQL → SQLite。SQLite运行模式还保留上传/快照来源；MySQL运行模式只使用当前库，避免覆盖当前运行库。

目标已有记录会完整替换，包括删除目标多余记录。**先停止使用目标库的其他进程写入**，页面须明确确认覆盖。源库维护窗口内排空请求并断开实时连接，生成一致性源备份及目标覆盖前备份；备份失败不执行覆盖。

复制管理员、配置、全部受控业务表与安装标记，保留主键、删除标记及同步游标；Schema账本按目标引擎维护，不直接拷贝。历史SQLite表转为归档容器，往返保留，不恢复旧业务职责。未知非空源表/字段或未知目标表拒绝静默丢弃。

- `mode=sync`：完成并逐表校验后为 `COMPLETED`，源库恢复服务。源库新增写入后副本可能过时。
- `mode=switch`：完成后为 `READY_TO_SWITCH`，源库继续维护。手动改 `DB_TYPE` 并重启；切库前不要恢复源库写入。
- 阶段：`PRECHECKING → QUIESCING → SNAPSHOTTING → INITIALIZING → IMPORTING → VERIFYING`。
- 目标写入前持久化 `incomplete`，替换及字段摘要校验在事务内完成，全部成功后设为 `ready`。失败或中断不得当作新安装或正常库使用。
- 失败保留源库、覆盖前目标备份与报告；确认任务停止后可恢复源库。重试从头复制，不做增量合并或断点续传。
- 本机任务/备份位于 `data/operations`，维护状态按引擎与安装身份隔离。旧全局 `state.json` 不再决定选库或准入。

## 备份与恢复

SQLite Backup API 包含已提交WAL，不能用单独复制活跃主文件代替。MySQL通过一致性事务导出便携SQLite，内含原始表DDL元数据。备份登记SHA-256，恢复先校验摘要；失败任务引用的备份不会自动过期清理。

在服务端工作目录执行，**当前env的另一种数据库是恢复目标**，必须先停止目标服务：

```powershell
node scripts/restore-database-backup.cjs <目标备份ID> --confirm-target-offline
```

恢复工具完整替换受控业务数据并校验；恢复失败目标保持不可切换。首次建表中断时，仅显式复制/恢复路径可按受控DDL补建，校验旧账本、对象清单、已有字段索引与外键；普通启动不会自动修复后开放半成品。原始表DDL包含在备份中供审计/人工恢复，工具不自动执行上传文件中的DDL。

数据库复制只覆盖数据库记录。同机切库复用本地上传目录及七牛对象；跨机本地附件需另行搬迁。

## 旧数据清理

升级成功后可人工执行 [旧迁移元数据清理SQL](../../scripts/sql/cleanup-legacy-migration-metadata.sql)。脚本清理旧v1账本和已失效任务详情，不删除当前Schema版本及 `app_installation`；可选清空历史归档默认注释。执行前备份并停止服务，不得用SQL把失败目标的 `incomplete` 强行改为 `ready`。

## 验证

```powershell
pnpm verify:databases
pnpm verify:setup-http
```

脚本只创建随机命名的隔离MySQL库和项目内临时SQLite文件，覆盖独立安装、并发保护、旧库升级、两向往返、重复覆盖与失败防护；不写env指定的业务库。测试账号需有创建/删除隔离库权限。仅SQLite验收可执行 `node scripts/verify-independent-databases.cjs --sqlite-only`。

## 官网域名统计 v3

UV/下载 domain 与 `site_page_view_records` 随全量复制保留；旧 v2 源缺少 domain 时使用空串，不猜测历史域名。已有 MySQL v2 目标在复制前完成幂等增量升级；DDL 失败保留账本并禁止业务启动，同版本可续迁。生产升级流程见 [域名统计改造记录](../../agents/WEBSITE_DOMAIN_ANALYTICS_IMPLEMENTATION_PLAN.md)。
