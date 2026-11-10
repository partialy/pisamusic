# 数据库迁移与 SQLite 完整备份（管理端）

> 路由前缀：`/api/admin/database-migration`。所有接口必须先通过 Admin JWT；除数据库文件上传和二进制下载外，沿用服务端 AES-GCM JSON 通信封装及通用 `{success,code,msg,data}` 响应格式。MySQL 5.7 的真实生产环境部署尚需在目标实例上验证。

## 配置

```dotenv
DB_TYPE=SQLITE
PISA_APP_DB_PATH=./data/pm.db
MYSQL_URL=mysql://pisa:encoded-password@127.0.0.1:3306/pisa_music
MYSQL_POOL_SIZE=10
MYSQL_CONNECT_TIMEOUT_MS=10000
DB_MIGRATION_UPLOAD_MAX_BYTES=2147483648
DB_MIGRATION_STORAGE_MAX_BYTES=10737418240
```

- DB_TYPE 未设置默认 SQLITE；不接受其他枚举；MYSQL 必须有 MYSQL_URL。连接失败、Schema 不符合或未完成迁移，均拒绝启动，**不自动回退 SQLite**。
- MySQL 5.7 使用 InnoDB/utf8mb4_bin；数据库及低权限账号需事先创建。仅允许向空业务库迁入，不支持覆盖或合并。
- 修改数据库模式需**手动修改环境变量并重新启动 Server**。Admin 不改写 .env、不重启进程。
- 状态与备份存放在服务端 `data/operations`，不会暴露到 `/static` 或 `/uploads`；原始数据库和七牛资源不会被自动删除。

## API

| 方法 | 路径（相对前缀） | 请求 / 返回 |
|---|---|---|
| GET | `/status` | 当前 DB_TYPE、脱敏 MySQL 连接、维护状态、快照列表与活动任务 |
| POST | `/preflight` | `{sourceType,sourceId?,retryTaskId?}`；检查 SQLite 完整性、源表映射、MySQL 版本与空目标库 |
| POST | `/snapshots` | `{sourceType,sourceId?}`；生成完整一致性 .db，返回 SHA-256、大小、表数量、checkpoint 状态 |
| GET | `/snapshots/:id/download` | JWT + `x-pm-random`；返回二进制附件 `.db`，不走 JSON 响应解密 |
| POST | `/uploads` | `multipart/form-data`，字段名 `file`，只允许 .db；JWT + `x-pm-random`；返回加密 JSON |
| POST | `/tasks` | `{sourceType,sourceId?,retryTaskId?,confirm:true}`；202 创建后台迁移任务 |
| GET | `/tasks` | 最近 30 条迁移任务 |
| GET | `/tasks/:id` | 当前阶段、进度、逐表结果、日志与错误 |
| GET | `/tasks/:id/report` | 迁移报告 JSON（去敏） |
| POST | `/maintenance/exit` | `{confirm:true}`；仅允许 SQLite 模式、无运行中任务、未切换到 MySQL 时安全退出维护 |

`sourceType` 取 `server`、`upload`、`snapshot`；后二者必须通过服务端返回的 UUID `sourceId` 引用，不接受任意服务器绝对路径或外部 URL。

## 完整 .db 与 WAL

生成完整数据库时会尝试 `PRAGMA wal_checkpoint(PASSIVE)`，然后使用 Node.js `node:sqlite` Backup API 制作独立一致性快照；即使 checkpoint 因读锁忙碌，成功的 Backup 仍包含备份视图中的已提交 WAL 数据。快照必须通过 `integrity_check` 和外键检查并计算 SHA-256 后才能下载或迁移。**不要单独复制活跃 WAL 的主 .db 作为完整备份**。Node 最低版本为 22.16.0。

## 迁移状态与维护

- 开始任务后进入维护模式，普通 HTTP API 返回 503；允许健康检查、Admin 登录和迁移管理接口。维护期间 Socket.IO 禁止新连接并主动断开已有连接；后台写任务需停止。
- 状态从 PRECHECKING、QUIESCING、SNAPSHOTTING、INITIALIZING、IMPORTING、VERIFYING 到 READY_TO_SWITCH；出现 FAILED、INTERRUPTED 时保留原库与报告，不自动跳过数据或切换。
- MySQL 5.7 版本化 Schema 包含 49 张现行业务表和 2 张已识别的历史归档表；迁移器每批默认 500 条，按 FK 顺序提交。校验记录数、主键、有序行摘要及遗留数据。
- 只有 READY_TO_SWITCH 且全量验证成功后才允许修改 DB_TYPE=MYSQL 并重启；首次 MySQL 启动再次校验迁移账本、任务与 Schema 指纹，成功才解除维护。
- 已进入正式 MySQL 运行并产生新数据后，**不能直接切回旧 SQLite**，否则可能造成收藏、同步游标和统计数据丢失。任何回滚先核对增量数据。
- 迁移失败时再次执行需确认失败任务所有权；只清理该任务在空目标库内创建的对象并从头重建，不允许删除无关表。

## 状态码

- `400`：参数、确认标识不合法。
- `401/403`：管理员认证无效。
- `409`：已存在活动任务、目标业务库非空、操作冲突。
- `422`：SQLite 不完整、MySQL 5.7 检查不通过、Schema 不兼容、快照/迁移异常。
- `503`：业务维护模式或无法继续服务。

实际实现可能将预检查和文件错误统一包装为 422，客户端应优先展示返回的 `msg`，不要直接展示含密码或 SQL 数据的异常。

## 验证清单

1. `pnpm --dir server build` 和 `pnpm --dir server/admin build`。
2. `node server/scripts/verify-mysql57-schema.cjs`（先编译 Server）；这是静态检查，不能替代真实 5.7 DDL 测试。
3. 使用**隔离的** SQLite 测试库生成/下载单文件备份，并验证 SHA-256。
4. 在**独立空 MySQL 5.7** 目标库执行完整导入和校验；测试 DB_TYPE 切换、MySQL 重启和 rollback gate。
5. 核验账号登录、管理员登录、用户同步、云音乐、文件记录、公告、一起听与官网统计；生产部署前务必人工验收。

## MySQL 5.7.18 隔离验证记录（2026-11-10）

本次在实际 MySQL 5.7.18 实例上完成了**隔离验证**，不是生产切换：

- `pnpm check:mysql57`：连接、账号鉴权成功；用户指定的目标 `pm-db` 为 **0 张表的空库**。
- `pnpm test:mysql57:ddl`：在脚本创建的随机临时库中成功创建 **49 张业务表 + 2 张历史归档表、21 条外键**，随后自动删除临时库。修复了 `users` 原始手机号唯一索引与生成列索引同名导致的 `ER_DUP_KEYNAME`。
- `pnpm test:mysql57:migration`：先用 SQLite Backup API 只读备份源库，再在隔离测试库执行完整的预检查、导入、校验；**51 张表、2677 行全部完成，任务达到 READY_TO_SWITCH**。模拟 `DB_TYPE=MYSQL` 启动与迁移账本校验通过，`users=2`、`admin_users=1`、运行时配置成功初始化；脚本自动清理独立资源。
- 静态 Schema 检查会拒绝同名索引和超过 MySQL 5.7 InnoDB 16KB 页索引长度的定义；修复后共有 **130 个索引**。
- **整个实测过程没有更改正式 SQLite、生产维护状态或目标 `pm-db` 的业务表和记录**。请不要把隔离测试结果等同于已在正式 `pm-db` 执行迁移。

运行这两项集成测试要求 `server/.env` 中正确设置 `MYSQL_URL` 且该账号拥有创建与删除**脚本独有临时数据库**的权限；这些脚本不会直接操作 URL 对应数据库的业务表。正式 `DB_TYPE=MYSQL` 启动前仍需要先完成真实的迁移流程，否则空目标库会触发 Schema 校验失败。生产部署建议使用最小权限数据库账号，避免长期使用 root。
