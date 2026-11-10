# PisaMusic SQLite → MySQL 5.7 双数据库适配与 Admin 迁移实施计划

> 状态：设计完成，待开始编码；本文件仅为实施计划，不代表已实现。
>
> 日期：2026-11-10。Grilling Q1–Q47 已全部确认；Q28 与 Q35 按用户补充调整。
>
> 工作范围：E:\Projects\Project\pisamusic\server（src + admin + apidoc），以及必要的项目规范文档。不修改 pm/ Android、yixi/ 桌面端现有公共协议。禁止修改或删除原有数据库、用户上传文件、七牛对象和现有构建产物。

## 1. 目标和确定的决策

1. 正式支持 **MySQL 5.7/InnoDB**，保留 SQLite 正常运行模式与迁移源读取能力。业务路由和响应字段保持兼容。
2. Server 仅从环境变量读取数据库：**DB_TYPE=SQLITE 或 MYSQL**；未设置默认 SQLITE，非法值启动失败。MYSQL 必须提供 MYSQL_URL；连接失败不自动回退 SQLite。
3. SQLite 继续使用 PISA_APP_DB_PATH（默认 server/data/pm.db）；MySQL URL 用 mysql://user:password@host:3306/database 表达，必须支持 URL 编码的用户名/密码。
4. Admin → 系统设置 → 数据迁移：来源为“服务器原数据库”或上传单个完整 .db；可预检查、生成/下载完整 SQLite 快照、一键导入空 MySQL、检查进度/报告；支持迁移历史。
5. 迁移覆盖全部业务与历史记录、系统配置，不只导入用户/收藏。排除 sqlite_% 系统内表；历史遗留非空表不得静默跳过。
6. 仅允许导入**无业务表数据的独立目标库**；不做覆盖、合并、自动修复/跳过错误数据。不允许在 DB_TYPE=MYSQL 正式生产运行时再次向当前库导入 SQLite。
7. 开始迁移时开启持久化维护，普通 HTTP API 走**统一拦截器直接 503**；保留 Admin 登录、数据迁移管理、必要健康检查。进入维护时断开 Socket.IO、拒绝新连接并阻止后台任务写库。
8. 数据快照优先检查并尝试 checkpoint WAL，再使用 Node SQLite Backup API 创建**独立的、自包含的单文件 .db**；允许仅导出和下载，不必执行 MySQL 迁移。
9. 直接使用服务器 SQLite 迁移时自动生成完整快照；上传的单个 .db 必须已经是完整快照，拒绝不完整/损坏文件。
10. Admin 只生成迁移报告和切换指引，不写 .env、不自行重启服务、不运行时热切换。校验通过后修改 DB_TYPE=MYSQL 并由外部部署方式重启；MySQL 启动检查成功后解除维护。
11. MySQL 和 SQLite Schema 使用受控、版本化升级，禁止在 MySQL 正常启动时沿用含 DROP TABLE 的原初始化过程。
12. 失败保留原 SQLite、快照和日志；重新迁移采用清理本任务创建的 MySQL 迁移表后**从头重建**；不能悄悄切库或自动清理原库。
13. 单实例 Server 为第一版范围；多实例必须统一停写后再迁移，暂不实现分布式锁和双写。
14. 上传上限默认 2GB 可通过服务端配置调整；迁移任务日志最近 30 条；备份快照默认 7 天，上传临时文件任务完成 24 小时后清理；原 SQLite 永不自动清理。
15. 验收优先 TypeScript 编译、关键数据库测试、完整性校验与核心业务烟测，不跑全量历史测试；不涉及客户端升级。

## 2. 实际项目核查基线（实施前复核）

- monorepo 根目录：E:\Projects\Project\pisamusic；Server：server/；Admin：server/admin/（React + Ant Design）。
- server/src/db/appDb.ts 通过 node:sqlite 的 DatabaseSync 单例访问 server/data/pm.db，启动时 PRAGMA WAL/foreign_keys、CREATE_SQL、字段修补、数据修复及多处历史 DROP TABLE。
- server/src/db/deviceInfoDb.ts 返回 getAppDb()；业务存取集中在 server/src/db/*Store.ts；server/src/config/configManager.ts 持有同步内存 Map 和同步事务写库。
- server/src/index.ts 在监听 HTTP 前同步初始化 configManager、回收一起听旧房间、加载加密白名单；这些入口也必须转换为异步启动链路。
- 当前源码扫描：约 103 个非测试 TS 文件；getAppDb() 约 132 次、prepare() 约 328 次、ON CONFLICT 约 19 次、BEGIN IMMEDIATE 约 10 次；这些是代码扫描量级，不是实施任务已完成量。
- 源码定义约 **49 个业务表**；本机 SQLite 实际共 **51 个非 sqlite_% 表**，多出历史遗留 json_imports（本机 5 行）和 listen_together_user_records（本机 0 行）。迁移必须识别这类版本漂移，保留非空历史数据或明确阻止，而非仅凭最新版 CREATE_SQL 复制。
- 本地 server/data/pm.db、pm.db-wal、pm.db-shm 均存在（检查时主库约 1.78 MB、WAL 约 4.13 MB）；不能直接复制主库后称为完整快照。
- 源码部分索引使用 WHERE（局部唯一），SQL 还包含 strftime()、|| 拼接、WITH CTE、INSERT OR IGNORE、ON CONFLICT ... excluded、PRAGMA、BEGIN IMMEDIATE。
- API 已启用管理员 JWT 和自定义 AES-GCM JSON 请求/响应封装（admin/src/api/crypto.ts、src/middleware/encryption.ts）；文件上传不能直接通过当前只接受 JSON 字符串请求体的 encryptedFetch()。
- Admin 现有注册点：server/admin/src/App.tsx、src/layouts/AdminLayout.tsx、src/router/adminRoutes.tsx；Server Admin 路由在 server/src/routes/admin.ts 挂载 requireAdminJwt 后子路由。
- 实施前必须再次检查 Git 工作树状态；本次读到的本地数据库/源码只是设计快照，不代表线上数据库规模。

## 3. 数据库模式与启动流程

环境变量示例（添加到 server/.env.example，绝不提交密码）：

~~~dotenv
DB_TYPE=SQLITE
PISA_APP_DB_PATH=./data/pm.db
MYSQL_URL=mysql://pisa:your-encoded-password@127.0.0.1:3306/pisa_music
MYSQL_CONNECTION_LIMIT=10
DB_MIGRATION_UPLOAD_MAX_BYTES=2147483648
~~~

- 读取 DB_TYPE 后归一化为 SQLITE / MYSQL；空值按 SQLITE；非法值直接退出并显示具体配置问题。
- DB_TYPE=SQLITE：使用 SQLiteAdapter；兼容现有 SQLite 启动升级流程，但先审计破坏性迁移并迁出到有版本控制的升级脚本；保留原库所有数据。
- DB_TYPE=MYSQL：解析 MYSQL_URL，初始化 mysql2/promise Pool，验证 MySQL 主版本为 5.7（或明确拒绝未验证版本）、库存在、账号权限、Schema 版本与迁移成功标记；失败拒绝启动，不自动切回 SQLite。
- MYSQL_URL 只供服务端读取，不回传完整 URL；Admin 状态 API 只返回已脱敏 host、port、database、数据库类型、版本和连接状态。
- 初始化顺序必须从当前同步代码重构为：读取环境/持久化运维状态 → 初始化 DB → 检查 Schema 版本/执行安全升级 → 初始化 configManager 内存快照 → 恢复一起听历史状态（维护时跳过任何写库回收）→ 注册 HTTP/Socket.IO/维护拦截 → 监听端口。
- 所有启动过程等待 DB Ready；不要先对外开放监听再初始化数据库。对 MYSQL 首次正式切换成功还需核对迁移任务成功记录及目标 Schema 指纹，然后才能解除维护。
- MySQL 5.7 生命周期已结束；部署时限制 3306 监听范围、使用低权限账号、定期备份、准备未来升级计划。

## 4. MySQL 5.7 Schema 与兼容清单

采用 InnoDB、utf8mb4、尽可能 ROW_FORMAT=DYNAMIC。预检查 innodb_page_size、innodb_large_prefix 等与组合索引上限有关的配置，按实际实例约束设计索引；不可机械地将所有 TEXT 主键改成 VARCHAR(255)。

| SQLite 语义 | MySQL 5.7 对应策略 |
| --- | --- |
| TEXT 主键/业务短码 | 明确长度 VARCHAR；严格区分大小写的 key 使用 utf8mb4_bin 或二进制列规则 |
| INTEGER 毫秒时间戳/序号 | BIGINT；状态位 TINYINT(1)；普通整数 INT/BIGINT 根据范围选择 |
| REAL | DOUBLE；必要时检查浮点比较和范围 |
| TEXT 默认 '{}' / '' | MySQL 5.7 TEXT 不允许非 NULL 默认值；短字符串改 VARCHAR，大 JSON 改 TEXT/LONGTEXT 并在业务代码显式写入默认值 |
| AUTOINCREMENT | AUTO_INCREMENT；导入反馈图片等旧 ID 时保留原数值并重置 auto increment |
| INSERT OR IGNORE | 仅针对确认为允许的唯一键冲突跳过；不要盲用 INSERT IGNORE 隐藏非唯一键的数据错误 |
| ON CONFLICT ... DO UPDATE | 指定业务冲突的 MySQL upsert；逐表确认其他唯一键不会错误触发更新 |
| SQLite 的 excluded.col | 使用 MySQL 5.7 VALUES(col) 或显式入参 |
| BEGIN / BEGIN IMMEDIATE / COMMIT | mysql2 同一连接 beginTransaction/commit/rollback；异步事务不可跨 Pool 连接 |
| strftime('%Y-%m-%d', ms/1000, 'unixepoch','+8 hours') | 用显式时区和 FROM_UNIXTIME/DATE_FORMAT 或 JS 统一生成北京时间日键；不依赖服务器时区 |
| SQLite || 字符串拼接 | CONCAT()；不可保留 || 运算符 |
| WITH CTE | MySQL 5.7 无 CTE，改为子查询/派生表/多次查询并在 Node 聚合 |
| CREATE INDEX ... DESC | MySQL 5.7 不支持真正降序索引；重排复合索引/倒序扫描/EXPLAIN 验证 |
| CHECK (...) | MySQL 5.7 忽略 CHECK，业务 Service/Store 显式验证关键枚举/范围及唯一性 |
| 部分唯一索引 WHERE ... | 使用生成列（业务有效时生成业务 Key，否则 NULL）+ UNIQUE；NULL 可多条；逐条确认约束语义 |
| PRAGMA / sqlite_master | MySQL INFORMATION_SCHEMA/SHOW 与版本化 schema_migrations |
| 列名 key、特殊关键字 | MySQL SQL 必要时加反引号，避免保留字歧义 |

重点索引：ux_share_records_active_subject、ux_app_share_identity、ux_cloud_music_current_asset、ux_listen_room_active_room_id、ux_listen_room_member_open、ux_users_phone；逐项列出原字段、条件、生成列、索引及大小写/NULL 语义。MySQL 5.7 支持生成列二级索引；对部分唯一约束，先在真实 5.7 实例执行建表与冲突用例后采用。

另外检查：InnoDB 外键依赖与删除行为；联合主键最长字节数；用户同步主键 (user_id,item_type,item_key)；基于 TEXT 的长字段索引；SELECT COUNT 返回数值类型；mysql2 的 BIGINT/DECIMAL 安全整数与结果映射；逻辑删除和空字符串与 NULL 的差异。


## 5. 分层改造与具体文件清单

### 5.1 新增底层基础设施（建议落点）

| 路径（均相对 server/） | 职责 |
| --- | --- |
| src/db/core/types.ts | DbClient、QueryResult、DbTransaction、SQL 参数、错误类型约定 |
| src/db/core/createDatabase.ts | 根据 DB_TYPE 创建 SQLite 或 MySQL 实例，不处理业务 SQL |
| src/db/core/sqliteClient.ts | SQLite 同步驱动的 Promise 适配，保留现有行为；单实例串行化事务，避免异步事务期间其他请求复用同连接 |
| src/db/core/mysqlClient.ts | mysql2/promise Pool 封装、参数绑定、结果归一化、事务绑定连接、连接释放 |
| src/db/core/sqlDialect.ts | 两种 SQL 版本/方言能力接口；仅封装确定可复用的片段，不对任意 SQL 做正则转换 |
| src/db/schema/sqlite/ | 旧 SQLite Schema/升级规则抽离与版本记录，不允许无条件破坏已有数据 |
| src/db/schema/mysql/ | 全量 5.7 DDL 与后续编号版本化 migration SQL |
| src/db/schema/runner.ts | schema_migrations 版本管理、先检查再升级、失败标记与退出 |
| src/db/appDb.ts | 作为兼容入口逐步替换为异步 DbClient 获取接口；最终删除业务层对 DatabaseSync 类型的依赖 |
| src/db/deviceInfoDb.ts | 改为异步数据接口/别名，禁止导出同步 SQLite 连接到业务层 |

接口形态示意（具体 TS 签名在实现时按当前调用方微调）：

~~~ts
interface DbClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: readonly unknown[]): Promise<T | null>;
  execute(sql: string, params?: readonly unknown[]): Promise<{ affectedRows: number; insertId?: number }>;
  transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>;
}
~~~

- 禁止将异步 mysql2 包装成虚假的同步 DatabaseSync；现有 Store、Service、Route 全链路显式 async/await。
- SQLite 不能在同一连接持有异步事务时让其他请求进入同连接事务：可采用连接/任务串行队列，或把事务体改为明确独占的原子操作；不允许 BEGIN 后 await 期间被其他请求复用。
- MySQL 事务统一 acquire connection → begin → callback(tx) → commit/rollback → release；同一次事务内的所有查询必须使用 tx。
- 每个 Store 保持 SQL 语义可审计；对于少数复杂差异分别维护 sqlite/mysql 查询，不允许通用 SQL 文本替换器。
- 保持现有 JSON DTO、Unix 毫秒时间与客户端接口结构不变。

### 5.2 按业务优先级改造 Store

先统一持久化依赖接口，再逐步推进以下文件。每组提交前检查调用链，不应只改编译类型而漏掉 await。

1. 基础/管理：db/configStore.ts、db/adminUserStore.ts、db/dynamicConfigStore.ts、db/verificationCodeStore.ts、config/configManager.ts。
2. 账号与同步：db/userStore.ts、db/syncStore.ts、db/deviceInfoDb.ts。
3. 设备与运营：db/announcementReadStore.ts、db/feedbackStore.ts、db/faultReportStore.ts、db/analyticsStore.ts、db/dashboardStore.ts、db/websiteRecordStore.ts。
4. 内容与分享：db/shareStore.ts、db/appShareStore.ts、db/appShareTrackingStore.ts、db/appShareTrackingAdminStore.ts、db/cloudMusicStore.ts。
5. 实时与听歌：db/listenTogetherStore.ts、db/listenTogetherHistoryStore.ts、db/listeningStore.ts、db/directMessageStore.ts。
6. 对应上层 src/services/*、src/routes/*、src/realtime/*、src/index.ts：把同步 DB 结果改为 await，所有 Express 5 async 错误进入统一处理通道。
7. 配置读性能：configManager.initialize() 改异步加载一次，内存 get()/snapshot() 保持无 DB IO；setMany() 提交 MySQL 事务成功之后再刷新 Map 与通知订阅者，不能先广播后回滚。
8. 一起听：启动 closeStaleActiveRoomRecords 只在非维护运行模式下操作当前 DB；改为异步并考虑 Socket.IO 建连门禁。
9. 统计：db/dashboardStore.ts 的 3 处 strftime、活跃设备 CONCAT 和 WITH CTE 必须用 MySQL 5.7 等价查询替代；验证 7/30/90 天聚合结果一致，尤其北京时间零点边界。
10. 合约维持：公开下载/分享请求中可能存在 GET 引起的统计写入，迁移维护时也必须拦截；Admin、Android、yixi 原 JSON 和 AES-GCM 协议均不得改变。

### 5.3 特殊存储和历史结构

- SQLite 真实的 49 个现行表 + json_imports + listen_together_user_records，应生成明确映射清单（源表名/目标表名/主键/依赖/字段类型/迁移校验/是否已废弃）。
- json_imports 是历史导入记录；不恢复历史自动 JSON 导入逻辑。对旧表采用只读归档导入或历史映射表保留原记录，不丢弃其 5 行；listen_together_user_records 旧表也先识别列结构，再决定兼容归档表；没有显式映射就中止执行。
- 旧版 DB 缺字段：先在临时源快照上执行版本受控的兼容变换，或在取数阶段做非破坏性字段映射；原 .db 绝不直接 ALTER/DROP。
- appDb.ts 中历史 DROP TABLE、migrateAnnouncements 的删表重建、migrateListenTogether 的删表分支等，必须分清**旧版本规则**与**新 MySQL Schema**；不得照搬到正式 MySQL 启动链路。
- 七牛云对象和本地 uploads/static 文件不参与 .db 内容转换，但迁移后引用路径、对象 key、下载 URL、附件数量须校验。禁止任何自动七牛资源删除。

## 6. SQLite 完整快照 / WAL checkpoint / 下载

### 6.1 用户可见功能

Admin 数据迁移页提供独立卡片“SQLite 完整备份”：

- 来源：服务器配置的原数据库；若有已上传 .db，也允许对上传文件生成规范化快照。
- 操作：“检查数据库”“生成完整 .db”“下载已生成快照”。
- 状态：数据库路径（脱敏）、主库大小、WAL 是否存在、checkpoint 尝试结果（成功/忙/失败）、快照大小、表数、记录数、SHA-256、生成时间、完整性检查结果。
- 默认文件名为 pm-backup-YYYYMMDD-HHmmss.db，响应为 attachment，禁止任意路径参数；下载只接受签发的快照 ID。
- 单独导出无须切换为维护模式或连接 MySQL；可供普通在线 SQLite 使用，但需要一致性 Backup API 保障。

### 6.2 生成算法和状态机

1. Admin 验证 JWT；只允许从已配置的 PISA_APP_DB_PATH 或上传 ID 解析源，不提供任意服务器文件路径。
2. 校验文件 SQLite header 和大小，打开独立 SQLite 连接；正在运行的 SQLite 模式优先复用安全协调的原连接，不要让第三方程序无锁并发改写库。
3. 非维护导出时尝试非阻塞 checkpoint；如有读者占锁导致 busy，记入告警，不强制 TRUNCATE/删除 .db-wal；迁移模式在写入冻结、在途请求排空之后可使用 FULL/TRUNCATE checkpoint（仅对原服务端数据库、允许安全执行时）。checkpoint 失败不等于快照失败。
4. 无论 checkpoint 结果如何，都以 Node 的 sqlite.backup(sourceDb, 临时快照路径) 读取**包含已提交 WAL 页**的一致性逻辑视图。绝不使用 fs.copyFile(pm.db) 冒充完整备份，也不把 .db-shm 当作必要恢复产物。
5. 对快照运行 PRAGMA integrity_check，检查基本 Schema/重要表清单，读取每表记录数；再计算 SHA-256，成功后原子移动到备份目录并登记 ID。
6. 若备份/校验失败，删除本任务尚未发布的临时文件，保留原源库；展示可诊断错误，不显示完整敏感数据。
7. 快照下载支持流式传输、鉴权与范围/超时管理，浏览器端显示下载状态；不把完整数据库上传到七牛或公开静态目录。
8. 服务器 SQLite 迁移必须**每次在维护后的新快照上**进行；前期预检查缓存不作为最终来源权威数据。上传源必须是单文件完整 DB，若 WAL 缺失导致校验不通过则拒绝（技术上无法仅凭独立主文件判断是否遗漏原 WAL 的已提交事务，上传说明必须明确要求先导出一致性备份）。
9. Node 最低版本调整到 >=22.16.0（Backup API 所需），本机检查使用 Node 22.16.0；实现时确认服务器实际 Node 版本，版本不足拒绝快照操作。

## 7. 维护模式（按 Q35 简化）

- 使用 server/src/middleware/maintenanceMode.ts 统一判断服务端本地运维状态；正常业务 API 直接 503，错误体遵循原 fail()/成功字段协议。**将拦截放在 AES-GCM 响应包装之后、业务路由之前**，使加密客户端仍能正确解包维护响应；明文 API 继续返回明文 503。
- 放行列表尽量小：/api/health、/api/admin/login、/api/admin/database-migration/*；对 Admin 其他读写接口同样 503，避免隐式数据库写入。
- Socket.IO：维护开始时拒绝新连接并主动断开旧连接；先完成必要的断开/房间历史清理，再标记安静状态；维护期间禁用连接事件里的历史写库操作。
- 后台写入：针对配置刷新、统计留存清理、定时任务、在线房间记录等异步任务增加早退/停止调度。当前服务其他的 DB 写入也必须落入阻断范围。
- 为避免进入维护之前的在途请求继续写库，先设置“正在进入维护”门禁阻止新请求，再等待在途写入结束/超时后再生成快照；不引入全面分布式锁体系。
- 运维状态独立持久化到 server/data/operations/maintenance.json，采用临时文件 + 原子 rename 写入；包括状态、时间、taskId、源/目标 DB 类型、快照 ID、最后成功阶段。
- 状态：NORMAL → DRAINING → MAINTENANCE → SNAPSHOT_READY → IMPORTING → VERIFYING → READY_TO_SWITCH → SWITCHED → NORMAL；异常为 FAILED/INTERRUPTED。中断或重启不能擅自解除维护。
- 在 DB_TYPE=SQLITE 重启但存在未完成迁移状态时，只允许必要管理及恢复操作，不执行会修改源 SQLite 的启动修复/房间回收。
- 切成 DB_TYPE=MYSQL 重启后，检查目标库 Schema 版本、迁移完成 receipt、关键业务读写前置检查，成功后安全解除迁移维护状态；失败保持 503/启动失败，不回落 SQLite。
- 维护时 Admin 可执行“安全退出维护”：只在尚未切入 MySQL 或确认无 MySQL 新增业务数据时允许，二次确认；不会触发数据覆盖。


## 8. 数据迁移引擎设计

### 8.1 新增文件与职责

| 文件（server/ 相对路径） | 作用 |
| --- | --- |
| src/db/migration/types.ts | 迁移状态、表结构映射、校验结果、报告 DTO |
| src/db/migration/sqliteSnapshot.ts | server 路径快照、WAL checkpoint、完整性校验、SHA-256、下载信息 |
| src/db/migration/sqliteSource.ts | 对完整 .db 执行只读分页读取、PRAGMA 元信息、旧版本映射 |
| src/db/migration/mysqlTarget.ts | MySQL 5.7 连接检查、空库校验、受控 Schema 初始化、清理目标 |
| src/db/migration/schemaMapping.ts | 49 个现行表和历史遗留表的白名单、字段映射、依赖顺序 |
| src/db/migration/importer.ts | 按表分页拉取、500 行/批插入、批次事务、进度回报 |
| src/db/migration/verifier.ts | 双边记录数、PK 集合/有序摘要、关键字段、外键与业务关联检查 |
| src/db/migration/taskStore.ts | 独立本地迁移任务元数据、日志、历史记录和状态恢复 |
| src/db/migration/taskRunner.ts | 任务锁、预检查、冻结、快照、导入、校验、清理和异常恢复 |
| src/services/databaseMigrationService.ts | 连接 API、权限、业务状态规则，不在 Route 内堆 SQL |
| src/routes/adminDatabaseMigration.ts | /api/admin/database-migration 路由 |
| src/middleware/maintenanceMode.ts | HTTP 503 简化拦截/维护放行判断 |
| src/realtime/*（现有入口） | Socket.IO 维护时断开、拒连和持久化停写 |
| src/index.ts | 初始化顺序、管理路由注册、维护拦截与启动验证 |

### 8.2 迁移状态机

任务阶段：

- CREATED → PREFLIGHTING：源 SQLite 能打开且完整；解析 schema/表及记录数、源类型、快照文件大小、目标 MySQL 版本/连通性；检查目标无业务数据/无非本任务创建的表。
- PREFLIGHT_OK → DRAINING：进入维护门禁、Socket.IO 断开、在途写入排空、后台写任务暂停；预检查超时/失败不得生成不可信快照。
- SNAPSHOTTING：尝试 checkpoint + sqlite.backup 创建**本次专属**快照；记录 snapshotId、SHA-256。
- INITIALIZING_TARGET：只在确认目标无用户业务表/数据时运行 MySQL 5.7 受控 schema_migrations；记录本次创建的表/索引清单及迁移任务 ID。
- IMPORTING：按外键有向依赖顺序读取（避免先导入子表）；单表使用稳定主键 seek 分页，不用大 OFFSET 扫描；每批默认 500 条并按行大小调整（大 JSON/日志防 max_allowed_packet）；事务写入并 checkpoint 进度。
- VERIFYING：逐表完整校验；不允许以“成功插入条数”等同“数据等价”。
- READY_TO_SWITCH：记录所有表校验通过、Schema 指纹及源 snapshot SHA-256；生成不含秘密的 receipt，维持维护状态直到切换。
- FAILED/INTERRUPTED：保留源、任务记录、快照、可诊断日志；禁止继续切换。
- SWITCHED：外部修改 DB_TYPE=MYSQL 并重启；服务验证 receipt 与实际 DB 一致后才放行。

实现迁移时按“一次仅一个任务”加单进程独占锁和落盘任务锁。浏览器离开不取消任务。进程崩溃后保留 INTERRUPTED，不在后台自动重试或自动删除目标。任务开始后不得切换源文件 ID。

### 8.3 预检查与安全限制

- SQLite：文件头 SQLite format 3、PRAGMA integrity_check、表/列/主键/索引清单、sqlite_schema/版本漂移、行数、单表体量、时间戳值范围、NULL 与空串、UTF-8 可转换性、BLOB 和潜在超大 JSON。
- MySQL：版本必须符合选定 5.7；已创建的 DB 可访问；支持 utf8mb4、InnoDB；检查 sql_mode、innodb_page_size、索引能力、连接账号最小权限、schema_migrations/业务表状态。
- 空库定义：允许预先创建的空 DB，允许迁移器自己的无数据元信息表；发现任何非本任务创建的业务表或业务记录则拒绝，不覆盖、不合并。
- 旧 SQLite 若缺新字段，使用声明式旧版映射补默认；未知非空表/不能识别的字段/唯一冲突一律阻止并报告详细表名；允许已知空遗留表归档但必须明确。
- 迁移账本不包含密码或敏感明文；迁移日志不输出 password_hash、验证码、用户实际内容等。
- 对 MySQL TEXT 不支持默认值、VARCHAR 上限、索引长度、大小写冲突、特殊字符/Emoji 和保留字进行专门预检查。

### 8.4 迁移写入与完整性策略

- 建表与普通 DDL **不是可跨多表 rollback 的事务**，不要声称一次 SQL 事务可以完全回滚整个数据库；失败时保留任务所有权清单，允许管理员确认后清理本任务创建的对象并重新初始化。
- 数据批次走单连接短事务。若存在无法直接排序的外键依赖，先进入受控 staging 表，再做完整关联检查后按顺序迁入正式表；不默认全局关闭外键检查或跳过孤儿记录。
- 旧有 UUID、用户 ID、同步变更游标、文件记录 ID、版本号、下载记录 ID、统计日期、原始 JSON 字符串均保持原值；不重新生成或更改业务身份。
- 自增主键 feedback_images 等显式插入原 ID，迁移结束校正 AUTO_INCREMENT；生成列不从 SQLite 读取或写入。
- 禁止把所有 TEXT 转成 JSON 类型：原始 JSON 文本可能包含特殊格式、超长内容，按原串保存；必要时验证格式，禁止自动重新序列化改变存储内容。
- 针对布尔、NULL、字符串排序大小写和 MySQL BIGINT，明确转换规则并实现 round-trip 对照。
- 校验至少包括：源/目标逐表 COUNT；主键集合的分页有序哈希；经规范化后的每行关键字段摘要（流式校验，避免全部载入内存）；父子关联完整性；唯一约束；已迁移数据的空值、Unicode、长文本；file_records 与 cloud_music_assets、update_history 的引用；users.sync_version 与 user_sync_* 的版本/操作记录；一起听房间、成员关系；分享短码唯一性；日统计聚合结果。
- 特别对照当前本机非空表：user_sync_change_log/user_sync_applied_ops 各 890、user_sync_items 268、listening_fragments 106、listening_play_sessions 77、runtime_configs 52（仅供本机测试基线，不能写成线上预期）。
- 预检查、迁移及校验所有异常均生成 report，任何不一致使 task.status=FAILED，不能显示“迁移成功”。

### 8.5 失败恢复与清理

- 来源无损原则：永不自动删除、覆盖、ALTER 原始 SQLite；生成快照与 WAL checkpoint 互不影响源数据正确性。
- SQLite 维护中任务失败：维持维护状态，Admin 显示“取消迁移并安全恢复 SQLite”或“重新执行”，不能自动解除而产生新的差异。
- MySQL 失败任务：只清理**该任务且经所有权核验**创建的目标对象，非空、未知表或已有正式生产标记时禁止清理；重跑必须再次确认。
- 无自动跳过坏行、无自动增量合并、无自动继续上次表尾；断点信息仅用于诊断和展示。
- 发生 mysql2 连接断开、字段大小/唯一冲突、导入批次超时、客户端断线、服务进程崩溃：报告清晰错误与可执行的后续动作。
- 迁移期间禁止对同一目标库运行第二个任务；版本/schema 指纹变化、快照 SHA-256 变化、DB_TYPE 已切换时拒绝重试。

## 9. Admin 页面与 API 设计

### 9.1 页面

- 路径 /database-migration；菜单归入“系统设置 → 数据迁移”；标题、面包屑、响应式排版延续现有 Ant Design、Tailwind 样式；页面禁用通用“导出 JSON 配置”标题栏按钮，改成专用动作。
- 页内分为「数据库状态」「SQLite 备份与数据来源」「迁移预检查」「迁移进度/逐表结果」「历史任务/报告」。
- 来源选择：服务端当前 SQLite 路径（只读、按配置识别）或上传 .db（支持进度、校验、失败提示；不允许任意路径输入）。
- 提供“检查源库”“生成完整 .db”“下载备份”；未连接 MySQL 时仍可导出 SQLite。
- 迁移预检查显示当前 DB_TYPE、MySQL 5.7 版本、源表/数据量、目标空库状态、旧表/字段兼容报告。全部通过后“开始迁移”可用；操作前再次确认维护和目标空库规则。
- 任务页：阶段进度、总记录数、当前表、已成功/失败表、耗时、详细错误、日志、刷新重连；默认每 1 秒轮询；后端任务不依赖浏览器。
- 成功页：显示验证通过、源快照和数据库标识、切换提示（修改 DB_TYPE=MYSQL、MYSQL_URL 并通过既有部署方式重启）、不可点击的自动切换按钮不出现。
- 历史：最近 30 条，展示时间、来源、状态、耗时、大小、表数、摘要和导出 JSON 迁移报告；不会展示完整连接密码或密码哈希。
- MYSQL 正式运行模式：仅连接状态、历史及验证报告可看；导入到当前正式库的按钮一律禁用，避免二次覆盖。

### 9.2 建议 API 草案（均受 JWT，除 health 外）

| 方法 | 路由前缀 /api/admin/database-migration | 说明 |
| --- | --- | --- |
| GET | /status | 当前模式、脱敏连接状态、维护状态、进行中的 taskId |
| POST | /preflight | 检查选定 sourceType/sourceId 与目标 MySQL，返回检查项 |
| POST | /uploads | 通过 multipart 上传完整 .db，写临时目录并返回 uploadId |
| POST | /snapshots | 生成原路径/已上传源的完整快照，返回 snapshotId 与校验信息 |
| GET | /snapshots/:id/download | 鉴权流式下载完整单文件 DB |
| POST | /tasks | 开始一键迁移，服务端再次校验检查条件并锁任务 |
| GET | /tasks | 查询最近 30 条任务及简要状态 |
| GET | /tasks/:id | 当前进度、逐表结果和日志摘要 |
| GET | /tasks/:id/report | 获取 JSON 完整报告（不含敏感明文） |
| POST | /maintenance/exit | 仅安全分支可取消维护，强制再次校验防止脏回退 |

输入只使用 server/upload/snapshot 已签发的资源 ID，服务端自行解析固定目录；不信任前端传入绝对路径。服务端限制上传总量、同一用户活跃任务、content-type、文件扩展名、SQLite header、流读超时和资源清理。任务状态码：可用 400 参数错误、401/403 权限、409 并发/非空目标库、422 版本/文件不兼容、503 维护/目标库暂不可用等；成功响应遵循现有 {success,code,msg,data}。

### 9.3 Admin 加密链路的特殊处理

- 通常 GET/JSON POST 继续使用现有 admin/src/api/client.ts → encryptedFetch()（AES-GCM）；不能为方便上传而将 /api/admin/* 整体加入明文白名单。
- multipart FormData 不可直接交给只支持字符串 JSON body 的 encryptedFetch()。新增专门 upload helper：携带现有管理员 JWT、x-pm-random/x-pm-enc-ver 与 HTTPS 请求，明确不对大文件原始二进制做 JSON 包装；后端在 multer 解析 multipart 前完成原有加密中间件握手与响应封装；仅此上传路径允许原始文件体。注意原请求 body 不在 JSON 加密层之内，必须依靠 HTTPS、服务端鉴权和严格上传校验。
- 文件下载接口使用带 JWT 与必要加密握手头的原生 fetch/受控流式下载，直接传二进制 attachment，不通过 JSON 解包器；后台文件下载和错误响应的差异须独立处理。
- 禁止将备份 DB 挂载到 /uploads 或 /static 公共静态目录。完整库可能包含管理员账号哈希、验证码、用户数据等，必须鉴权下载并设置 Cache-Control: no-store。
- admin/src/api/databaseMigration.ts 新增 DTO 与方法；admin/src/pages/DatabaseMigrationPage.tsx 实现布局；复杂的上传/快照/进度表拆分到 components/databaseMigration/*；App.tsx、AdminLayout.tsx、router/adminRoutes.tsx 做最小注册变更。


## 10. 切换、重启、回滚与部署说明

### 10.1 首次迁移的推荐操作顺序

1. 前置准备：保留 SQLite 正式运行、完成代码升级；运维创建空的 pisa_music MySQL 5.7 数据库和最低权限账号，并配置 MYSQL_URL；DB_TYPE 仍为 SQLITE。
2. 登录 Admin → 数据迁移，执行 MySQL 连接检查、SQLite 源检查；可先在线生成并下载完整 SQLite 备份验证 WAL 逻辑。
3. 点击“一键迁移”；Server 自动进入维护状态、拒绝业务请求 503、断开一起听 Socket、排空写入，然后创建本次一致性 SQLite 快照。
4. 在已确认空业务库的 MySQL 上初始化 schema_migrations 和全量 5.7 DDL；导入 49 个当前业务表及已声明兼容的历史表数据；执行完整校验。
5. 校验全部通过，Admin 显示 READY_TO_SWITCH 和来源 SHA-256、目标 Schema 指纹；服务器保持维护状态，源 SQLite 不再承接任何新写入。
6. 运维修改 server/.env：DB_TYPE=MYSQL，MYSQL_URL 指向已迁移的 MySQL 5.7 数据库；通过现有启动/进程管理方式重启 Server。
7. 新进程检查 MySQL 连接、schema_migrations、迁移完成标记与关键表，启动 configManager、HTTP 和 Socket.IO；确认成功后解除维护并对外服务。
8. 核对 /api/health、Admin 登录、用户登录、同步读写、发布配置、云音乐、一起听、统计；保存报告，保留原 SQLite 及快照以备回滚。

### 10.2 失败与回滚边界

| 时点 | 处理 |
| --- | --- |
| 预检查或快照失败 | SQLite 原业务库不变；安全退出维护后继续使用 SQLite |
| MySQL 建表/导入/校验失败 | 保留 SQLite；MySQL 残留对象受任务所有权控制清理，确认后可以从头重跑 |
| READY_TO_SWITCH 尚未改 DB_TYPE | 仍处维护；可取消切换并安全恢复 SQLite，前提是此期间没有新写入 |
| 切到 MYSQL 但启动检查失败 | 不放行业务；修正 MySQL 配置或确认无新数据后回到 SQLITE |
| MYSQL 成功恢复服务、已产生新写入 | **禁止**直接切回旧 SQLite；先比对增量并制定单独逆向迁移/数据补齐方案，避免用户收藏/同步版本倒退 |

MySQL 正常启动后不得自动引用旧 SQLite；原 SQLite 和 .db 快照始终作为历史备份保留。不得通过“重启即回滚”掩盖已写入 MySQL 的新数据。

### 10.3 运行文件与过期清理

- 任务元数据与运维状态统一落到 server/data/operations/（例如 migrations/tasks/<id>.json、snapshots/<id>.db、uploads/<id>.db），完全独立于目标 MySQL；路径以 Server 可写目录为根。
- taskStore 落盘使用临时写 + fsync/rename 或等效原子保存，避免重启出现半写 JSON；阶段转换先落状态，再执行外部副作用，幂等恢复。
- 原始 SQLite（含用户指定 PISA_APP_DB_PATH）**绝不自动删除**；备份快照默认保留 7 天；上传原文件任务结束 24 小时后自动清理；迁移报告保留最近 30 条任务并允许下载保存。
- 正在使用、失败调查中、已被回滚策略引用的快照不得按普通过期规则立即删除；删除任何快照前核对任务引用和文件归属，不允许清理其他项目目录。
- 备份/上传文件不纳入 Git、不暴露于静态路由；文件大小/配额由服务端 .env 控制，浏览器不得决定服务器目标路径。

## 11. 验收标准与测试矩阵（最小必要范围）

### 11.1 编译与数据库

- server 和 admin TypeScript 构建通过；SQLite 模式原有核心业务 API 仍按原 JSON 返回。
- MySQL 5.7 空库 DDL 可执行，所有目标业务表/索引/外键/生成列与 schema_migrations 生效；无法支持的 CHECK 在业务层有对应验证。
- DB_TYPE=SQLITE、未设置、MYSQL、非法字符串分别符合约定；MYSQL_URL 缺失/连接失败明确报错且不回退 SQLite。
- MySQL 事务回滚、唯一约束、同步的并发版本更新能正确执行；不能有因异步未 await 导致返回成功却没有写入的问题。
- MySQL 5.7 下完全没有 8.0 专属 SQL（WITH CTE、窗口函数、表达式索引等）；GROUP BY、排序、空值和 date/time 行为与 SQLite 对照。

### 11.2 完整 .db 导出

- 正在使用 WAL 的 SQLite 数据库，生成独立 .db 后断开原源环境仍可打开，integrity_check=ok，已提交事务全部可见，SHA-256 与文件下载一致。
- checkpoint 成功、忙（busy）、失败均有明确状态；busy 不致损坏原库、不强制清 WAL；快照仍可通过 Backup API 创建。
- 在 SQLite 正常运行（未迁移）可以单独“生成并下载”；连续创建的快照彼此独立，不覆盖历史。
- 上传不完整/损坏/超过限制/不是 SQLite 文件时拒绝；没有 WAL 的独立旧主文件无法证明与曾经活跃的 WAL 数据一致，页面明确告警。
- 备份不能通过公共 URL 下载，未登录不能请求；文件名不允许路径穿越和覆盖其他目录文件。

### 11.3 数据迁移一致性

- 当前本机约 51 张非系统表：49 个现行表 + json_imports、listen_together_user_records 两个历史表。必须明确迁移映射与报告；未知非空表必须报错而非跳过。
- 每张表导入数量与源相同；主键、JSON、毫秒时间戳、账号 hash、同步游标、共享短码、文件关联与子表外键一致；原 SQLite 所有内容原封不动。
- 高风险表同步连续性：用户/多设备操作幂等、user_sync_change_log/user_sync_applied_ops 不丢版本；多端重新拉取不会出现历史变更重复或倒退。
- MySQL 5.7 partial unique 的生成列方案在真实实例上通过冲突插入/更新/逻辑失效/重新有效的业务测试。
- 使用有 Emoji、大小写不同 ID、空字符串、NULL、超长 JSON、失败记录、软删除记录的样例验证双库一致。
- 目标库已有数据直接禁止；导入失败可重试且只清理本任务生成的表；未出现跳行、重复业务记录或未核验的成功状态。
- 完整导入后执行 user_login/auth、Admin、同步、云音乐、文件发布、官网统计、一起听、配置保存的针对性烟测。

### 11.4 维护和恢复

- 维护模式下普通 HTTP 接口，包括可能产生统计写入的 GET，请求返回 503；加密接口的 503 响应仍可被客户端正确解密解析。
- Admin 登录、迁移状态/下载/报告和必要 health 可用，其他管理接口返回 503；普通 Socket.IO 不能再建连，旧连接及时断开。
- 在途请求排空后再进行快照；维护期间后台统计、定时清理和一起听持久化不会继续写入。
- 浏览器刷新可恢复迁移进度；Server 进程中途崩溃后任务显示 INTERRUPTED 并保持维护，不自动忽略失败或继续迁移。
- 首次 MYSQL 启动完成检查才能解除维护；MYSQL 生产写入后不能直接由 Admin 发起向当前库导入旧 .db。
- 不升级 pm/ Android 和 yixi/ 前提下，业务 API 字段、协议和响应结构兼容现有客户端。

### 11.5 项目规定的验证命令

在仓库根目录执行（仅当进入编码阶段时）：

~~~sh
pnpm --dir server build
pnpm --dir server/admin build
~~~

在隔离的测试 SQLite、MySQL 5.7 实例执行针对性迁移/数据库测试。遵守项目约定：除非用户额外要求，不跑全量历史测试；不以编译通过取代实际 MySQL 5.7 方言与业务数据验收。

## 12. 建议实施顺序与 Git 分步提交

| 提交阶段 | 交付范围 | 建议 Git 提交消息 |
| --- | --- | --- |
| 1. 基础与 Schema | DB_TYPE/MYSQL_URL、异步 DbClient、mysql2/promise、SQLite/MySQL 双实现、schema_migrations 和 5.7 DDL | feat(server): 新增 SQLite MySQL 双数据库适配基础 |
| 2. 核心业务 Store | 账号、同步、设备、配置及各 Store 依赖异步化；保证 SQLite 模式不退化 | refactor(server): 统一数据库访问与核心存储事务 |
| 3. 其余 Store/SQL 兼容 | 分享、听歌、一起听、官网统计、云音乐、Dashboard 的 MySQL 5.7 方言及异常处理 | refactor(server): 完成 MySQL 5.7 业务 SQL 兼容 |
| 4. 维护与 SQLite 快照 | 503 维护拦截、Socket.IO 门禁、sqlite.backup、WAL checkpoint、完整 DB 下载 | feat(server): 新增维护模式与 SQLite 完整备份 |
| 5. MySQL 导入引擎 | 任务状态机、表映射、预检查、批量导入、校验、报告、失败安全清理 | feat(server): 实现 SQLite 到 MySQL 数据迁移引擎 |
| 6. Admin 前端 | 数据迁移菜单、独立页面、源上传、备份下载、进度和历史 | feat(admin): 新增数据库迁移与完整备份管理 |
| 7. 验证和文档 | 双库针对性验证、异常恢复、API 文档、环境示例、Server/Admin AGENTS.md | docs(server): 完善数据库切换和迁移部署说明 |

每步先只暂存本阶段涉及文件并查看 diff；不合并 master、不触碰无关模块、不自动部署或启动生产迁移；按项目已有中文提交风格拆分。数据库切换属于部署动作，代码提交后不得自动把用户现有 DB_TYPE 改为 MYSQL。

## 13. 文档、配置与工程边界

需要新增/同步：
- server/.env.example：新增 DB_TYPE、MYSQL_URL、MySQL 连接池和上传限制示例（不含真实密码）。
- server/package.json：增加 mysql2；将 Node 最低版本提升至 sqlite.backup 可用的 >=22.16.0。
- server/apidoc/databaseMigration/overview.md：维护状态、备份、上传、迁移任务/校验、失败恢复、错误码与加密/二进制下载规则。
- server/apidoc/index.md：新增迁移管理 API 文档入口。
- server/agents/SERVER.md、server/admin/AGENTS.md：实现阶段将“SQLite 存储”的描述更新为双数据库适配及管理迁移模块，不改业务协议描述。
- server/docs/（或 docs/ 下的配套部署说明）：配置切换前置条件、最小权限 MySQL 账号创建、空库要求、启动失败回滚、安全运维步骤。
- 与跨端 DTO 或服务端兼容性发生实际变化时，检查 agents/CROSS_MODULE.md，并同步相关协议文档；本计划要求不改变对外业务契约。

## 14. 风险优先级和阶段完成条件

P0（编码先解决）：
1. 同步 DatabaseSync → 异步 Promise 事务及 configManager 启动依赖，避免单例事务串线。
2. MySQL 5.7 的 TEXT 默认值、CTE（WITH）、strftime、||、CHECK 不生效、部分唯一索引和大小写语义。
3. 源 SQLite WAL 完整快照与正在运行的任务写入冻结。
4. MySQL 迁移任务状态不依赖目标库；非空目标保护、任务所有权清理与报告可信性。
5. 首次 MYSQL 切换与维护状态恢复的正确性。

P1：
1. 2GB 流式上传/下载及 AES-GCM JSON API 兼容。
2. 旧版/遗留表兼容映射、50+ 表全量校验与任务失败恢复。
3. Admin 响应式 UI、任务历史、报告与短期保留策略。

最终完成条件：所有 Grilling 决策得到代码体现；SQLite 仍可正常运行，MySQL 5.7 正常业务可用；完整 .db 可独立导出并下载；服务器原路径与上传源均可迁移到空 MySQL 5.7 库；全表无损校验通过；管理员可查看结果后按 DB_TYPE 切换；失败时原 SQLite 可用且不存在自动覆盖/误删。**本文件为计划，尚未实现这些功能。**

## 15. 参考资料

- Node.js SQLite Backup API：https://nodejs.org/api/sqlite.html
- MySQL 5.7 数据类型默认值限制：https://docs.oracle.com/cd/E17952_01/mysql-5.7-en/data-type-defaults.html
- MySQL 5.7 InnoDB 行格式与索引：https://docs.oracle.com/cd/E17952_01/mysql-5.7-en/innodb-row-format.html
- MySQL 5.7 生成列与索引：https://dev.mysql.com/doc/refman/5.7/en/create-table-generated-columns.html
- 本机 Grilling 技能：C:\Users\Partial\.codex\skills\grilling\SKILL.md
