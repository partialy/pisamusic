# Pisa Music App 分享追踪与运营统计 — 最终实施计划

> 状态：实施中；确认及开始日期：2026-11-02；分支：dev。用户已明确要求开始按最新计划实施；文中“暂不编码/提交”等限制为设计阶段历史记录，由本次实施指令替代。按第11节分步提交，不推送、不合并。
> 基础：现有 docs/app-share/plan.md 已实现分享配置、Android 分享 Sheet、Admin「系统设置 → App分享」；本计划在其上增量改造，绝不混入音乐/歌单分享记录。
> 决策来源：grilling Q1–Q53 全部确认；特别覆盖 Q34（唯一访问入口 /app-share/）、Q41（**不新增获取链接接口**，扩展现有 GET /api/config/app-share）。

## 1. 范围、目标与不可变约束

- 以服务端验证的设备 ID + 当前账号 ID（或独立 guest 身份）确定一个**有效**推广身份，重复分享复用六位短码；同账号不同设备、同设备不同账号、同设备游客与登录态产生不同码。
- 短码采用大小写敏感 Base62 的 6 位 CSPRNG 随机字符串，唯一索引和冲突重试；用户、设备 ID 和认证令牌**永不进入分享 URL**。
- Admin 仅允许配置本站的 https://pisamusic.partialy.cn/app-share/；服务端为登录用户或游客自动拼接 code 参数，复制文案与二维码使用同一最终链接。
- **推广 PV/UV 只在浏览器实际打开 /app-share/ 并成功上报时产生。** /download/、官网首页、扫码跳转及下载接口均不得额外计算推广访问。
- 用户成功触发安装包下载跳转才记为「推广下载触发」；分别统计 Android 和 Windows，**不表示文件下载完成、安装、注册或成功邀请**。
- 7 天有效的最后一次有效推广访问归因；显式有效 code 优先，签名第一方归因 Cookie 次之；无效显式 code 不回退到旧 Cookie。
- 原有网站访问/下载分析、歌曲/歌单分享、一起听分享、Android 普通更新、PC 自动更新逻辑保持兼容；不清理现有 SQLite、运行时文件及未提交变更。
- 主记录及每日聚合长期保存，详细访问/下载事件默认保留 180 天；支持 Admin 失效但不物理删除，失效后同一身份再次分享产生新有效码。
- 先完成文档及设计验收，**本轮不得开始编码、执行生产部署、提交 Git、推送或合并 master**。

## 2. 已核实的当前实现

| 现有位置 | 当前行为 | 改造点 |
| --- | --- | --- |
| server/src/db/appShareStore.ts、services/appShareService.ts | 单行 app_share_config；配置决定二维码 URL、copyText；默认 /download/ | 保留配置表；加入身份解析和安全的 URL + code 构建 |
| server/src/routes/config.ts | GET /api/config/app-share；GET /api/config/download/:platform 在成功转发时调用 recordDownload | 原 GET 兼容扩展；下载归因接入现有统计点 |
| server/src/middleware/deviceMessageToken.ts、requireUserJwt.ts | x-pm-device-token 校验后得到真实 deviceId；可选 Bearer JWT | 完全复用，不接受客户端提交的 userId/deviceId 作为权威身份 |
| server/src/db/appDb.ts、analyticsStore.ts | Node SQLite、WAL、CREATE_SQL、官网事件保留 180 天 | 增加四张表、索引、事务和清理逻辑 |
| pm/app/.../appshare/AppShareRepository.kt、AppShareModels.kt | GET 配置、单键 SharedPreferences 缓存、默认 URL | 增加专属字段，按身份隔离缓存，强制刷新/校验 |
| pm/app/.../ui/dialog/AppShareBottomSheet.kt | 打开先展示缓存/默认，然后异步刷新 | 新身份加载态、错误重试、禁止复制无归属通用链接 |
| pm/app/.../utils/ServerDevicePrefs.kt 与 network/auth/AccountSessionStore.kt | 保存服务端设备 ID/30 天设备 Token 和用户会话 | 从这两处组合捕获身份快照 |
| server/frontend/public/download/index.html、src/Home/components/DownloadSection.tsx | /download/ 导向首页 #download；按钮走 /api/config/download/:platform | /download/ 仅历史通用；改造参数透传、Cookie 归因 |
| server/admin/src/pages/AppSharePage.tsx、router/adminRoutes.tsx、layouts/AdminLayout.tsx | 系统设置 App分享；运营与发布已有官网下载/版本发布 | 配置固定新路径；新增独立运营「分享记录」 |
| server/apidoc/、根/pm AGENTS.md、pm/components.md | 已有开发契约 | 更新接口、行为、隐私与组件规范 |

当前工作树存在未提交文件：pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml、ic_qq_24.xml、ic_wechat_24.xml；实施全程原样保留，**禁止误暂存或回退**。

## 3. 分享身份、生命周期及状态机

### 3.1 身份主键

- device_kind 固定 android（为未来 desktop 预留枚举扩展），device_id 必须来自已通过 JWT 和数据库校验的 x-pm-device-token。
- identity_key：登录态为 user:<服务端账号UUID>；游客为 guest。用户退出登录后再次使用 guest，复用其已有游客码；游客登录后新建用户专属码，不合并历史。
- 身份查找键 (device_kind, device_id, identity_key, valid=1) 必须有**部分唯一索引**；旧的 valid=0 行不占据此唯一约束。
- 账号 Token 存在但无效，返回 401；设备 Token 存在但失效，返回 401。**不得自动降级成游客身份**。先走现有设备重新上报或账号刷新流程。
- 设备重新上报仍得到相同 device_id 时复用原短码；识别为新设备则新建，不通过 IP/型号合并。
- 用户注销或设备删除：保留历史分享人与设备快照、访问、下载统计；显示历史信息并标记源信息缺失，不级联删除。
- 分享主记录产生于 Android 首次打开 Sheet 请求 GET 配置；重复打开只读取既有有效记录，可更新时间 last_requested_at，但不产生一次「访问」。
- Admin 失效时原 code 永久废止、历史可查，官网可进入普通下载但不再归因；下一次该身份 GET 生成另一条有效记录，新码不复用旧码。

### 3.2 安全生成和幂等性

- CSPRNG 生成 Base62 码，SQLite BINARY 大小写敏感唯一索引；冲突重新采样，不使用 Math.random、时间戳或截断 UUID 作为随机码。
- 使用 BEGIN IMMEDIATE/事务保护「按身份查询有效码 → 未找到则 INSERT」；处理两类唯一冲突：同身份并发归并为已有有效码，code 碰撞改采样。
- 限制重试次数并返回可诊断的错误；任何请求都不能由客户端指定 code/user_id/device_id。
- code 一旦生成永久保留，变更 Admin 文案、图标、发布版本不导致短码变化。

## 4. 服务端 API 契约（兼容优先）

### 4.1 现有 GET /api/config/app-share（**唯一获取链接入口**）

- **不新增 POST /api/app-share/link**。继续返回原 success/code/msg/data 信封及原字段 appName、version、iconUrl、description、qrCodeText、copyText、updatedAt。
- 旧版请求不带 x-pm-device-token：保持通用分享配置，增加可忽略字段 trackingEnabled=false；不创建分享记录。旧版客户端依旧可以解析全部原字段。
- 新版携带 x-pm-device-token：必须验证设备；显式 Authorization: Bearer token 存在则严格验证账号；据此查找或创建专属码。
- 新版 data 增加 shareCode（仅有效身份时存在）、trackingEnabled=true；**直接替换原字段** qrCodeText 和 copyText 为带 code 的完整地址与模板渲染结果，避免 Android 再拼一次参数。
- 示例：qrCodeText=https://pisamusic.partialy.cn/app-share/?code=k7Mx2P；copyText 仍由服务端模板替换所有 {url}，没有占位符则末尾附加地址。
- 所有响应 Cache-Control: private, no-store；对身份相关响应加 Vary: Authorization, x-pm-device-token，且代理/CDN 不缓存。必要时兼容旧无凭证访问配置的缓存约束。
- 原 Retrofit AuthInterceptor 在存在 x-pm-device-token 时**不会自动注入 Authorization**：新版 Retrofit 方法须明确传入两个 Header；登录态不能因为漏传 Authorization 变成 guest。
- 原有 iconUrl 的绝对地址、版本优先级、空版本用本机版本兜底，以及旧端字段类型不变。
- Admin 保存时规范化/校验 qrCodeText，仅接受本站 HTTPS + /app-share/（规范尾斜线），拒绝手填 code、重复 code、错误 host、其他路径和不支持的参数；保留其他合法非追踪查询参数。

### 4.2 公开归因接口（独立于分享配置）

- GET /api/app-share/public/:code：校验 Base62 和有效状态；仅返回展示/校验需要的非敏感字段，不返回账号、设备原始身份、访问者详情；无效/失效码使用一致的失败形态。
- POST /api/app-share/visits：eventId(UUID)、code、visitorId(UUID)、openedAt/客户端顺序辅助字段；仅允许有效短码，验证参数后幂等写入 PV/UV 并写入签名归因 Cookie。重复 eventId 只返回已有结果，不增加计数。
- 原 GET /api/config/download/:platform 保留路径与重定向契约；在成功提供可用安装包跳转的环节，根据显式 code 或有效归因 Cookie 追加推广下载，原 recordDownload 仍仅记录一次官网全站下载。
- GET /api/admin/app-share-records：筛选、排序、分页与汇总；GET /api/admin/app-share-records/:id：详情/趋势/事件分页；PATCH /api/admin/app-share-records/:id/invalid：单向失效；GET /api/admin/app-share-records/export：CSV 导出。均沿用管理员 JWT 和原有加密接口体系。
- 公开查询及 POST /visits 走强制明文白名单、独立合理限流；**不**把管理员接口或整个 /api/app-share/* 全量开放明文。

## 5. SQLite 数据模型（恰好四张新增业务表）

### 5.1 app_share_records — 身份对应的短码主记录

建议字段：id(UUID PK)、code(TEXT UNIQUE COLLATE BINARY NOT NULL)、device_kind(android)、device_id、user_id(NULL for guest)、identity_key(TEXT NOT NULL)、user_snapshot_json、device_snapshot_json、created_at（首次分享）、last_requested_at、last_visit_at、last_download_at、visit_count、download_count、android_download_count、desktop_download_count、valid(0/1)、invalidated_at。所有时间为 UTC 毫秒，展示为北京时间。

索引：
- UNIQUE(code COLLATE BINARY)（跨失效记录永久唯一，不回收）。
- UNIQUE(device_kind,device_id,identity_key) WHERE valid=1（仅一条有效分享）。
- (created_at DESC,id)、(valid,created_at)、(user_id,created_at)、(device_id,created_at)、(last_visit_at)、(last_download_at) 用于 Admin 筛选。
- 历史记录的账号/设备删除不可级联删除推广记录；仅持有展示快照，禁止保存令牌或原始指纹。

### 5.2 app_share_visits — 访问事件明细

字段建议：event_id(UUID PK，用于重试幂等)、share_record_id、code 快照、visit_day(Asia/Shanghai)、visitor_hash（基于现有分析 salt 的服务端 HMAC/hash）、opened_at（经范围校验的页面打开时间）、received_at、referrer_path（只保留安全域名/路径）、user_agent（截断）、browser_device_type、is_unique_for_share_day、is_unique_global_day。必要索引 (share_record_id,visit_day,visitor_hash)、(visit_day,visitor_hash)、(share_record_id,received_at DESC)、(received_at)。

- 客户端事件 ID 每次页面实际进入生成，重试复用；每次真实刷新生成新事件，PV +1。
- 同一 visitor_hash、分享记录、上海自然日首次有效访问才将分享 UV +1；全站同 visitor_hash/自然日仅加一次全站 UV。
- 社交预览不会执行真实浏览器访问上报；明显爬虫和预取请求拒绝计数。不能保证 100% 识别脚本访问。

### 5.3 app_share_downloads — 下载触发明细

字段建议：id(UUID PK)、share_record_id、download_record_id（可关联原官网 download_records；原始日志过期后允许为空或失联）、visitor_hash(可空)、download_day、platform(android/desktop)、version、file_record_id(可空)、attribution_source(explicit_code/cookie)、triggered_at、safe_referrer_path、safe_user_agent。索引 (share_record_id,triggered_at DESC)、(download_day,platform)、(visitor_hash,triggered_at)。

- 此表仅表示安装包下载跳转**触发**，并非下载完成。重复真实点击可重复计数，失败/限流/无可用下载包不计数。
- 上游已有 download_records 由 recordDownload 写入；优先重构为单事务的下载日志 + 归因记录，保持全站日志数量只增一次。
- 统计不能影响正常 302：若持久化失败需报警/日志，明确标记该次统计不可用，不得伪称已成功记录。

### 5.4 app_share_daily_stats — 长期日报（含全站与单链接口径）

按 (day, scope, share_record_key, platform_bucket) 做复合唯一键；scope=global/record，global 时 share_record_key 约定固定值，platform_bucket=all/android/desktop。列包含 visit_pv、visit_uv、download_triggers、created_at、updated_at。

- PV/UV 仅在 all 桶计数；总下载更新 all，分平台下载更新对应 android/desktop 桶；不重复汇总两个平台到 PV/UV。
- 全站 UV 是同一自然日所有短码去重的独立访客，**不能简单相加各个短码的 UV**；跨天求和只能叫「累计日 UV」，不能叫永久独立访客。
- 主记录和每日汇总长期保存；详细事件按 ANALYTICS_RETENTION_DAYS 默认 180 天清理（允许 90–730 天，与官网现有配置口径保持一致）。清理后仍能查历史日报；Admin 明细应注明仅在保留期内可见。
- 对可选查询范围内访问量为 0 的转化率显示「—」而非除零；转化率明确定义为下载触发次数 / PV，可大于 100%，不等于安装转化率。

### 5.5 事务、异常与迁移

- 增量 CREATE TABLE IF NOT EXISTS + 索引 + 必要的幂等迁移，加入 server/src/db/appDb.ts；不破坏旧表，不在启动时丢弃旧推广数据。
- 访问处理在一个 BEGIN IMMEDIATE 事务内依次：校验短码有效 → 检查 event_id → 判断 UV 去重 → INSERT 事件 → 原子更新主表累计与末次访问时间 → UPSERT 单链接/全站日报 → COMMIT。重复 event_id 不修改任何计数。
- 下载处理在一个事务内：确认目标发布版本和跳转可用 → 写官网 download_records → 解析当前有效归因并写 app_share_downloads → 更新主表及日报 → COMMIT；统计写入失败回退非阻断下载，并记录不一致诊断，避免简单重试带来双写。
- 每日清理的批次、时间、锁与聚合完整性需要测试；不要在读请求中执行耗时全表扫描。日报按需要建立合适查询索引。
- 若发生失效与访问/下载并发，事务内二次判断 valid；失效提交后的新请求不能再计入失效短码。

## 6. Web 路由、Cookie 与归因逻辑

### 6.1 唯一推广入口

- 新增 server/frontend/public/app-share/index.html，静态页沿用网站品牌、色彩、图标与语义文案，提供载入态、「立即前往下载」和 JS 禁用时的普通下载链接。
- URL：/app-share/?code=ABC123。页面校验 6 位码 → GET /api/app-share/public/:code → POST /api/app-share/visits 成功确认一次 PV → 跳转 /?code=ABC123#download。
- 无 code、错误/无效/已失效 code、统计异常：展示简短说明并进入普通官网下载，不创建推广访问；不能因统计失败阻断用户获取安装包。
- /app-share（无末尾斜线）规范到 /app-share/；Vite public 静态产物确保被输出到 server/web-user/app-share/，反代/Nginx 部署检查不得把静态页误当作 SPA 首页。
- 页面添加 noindex、适当的 Referrer-Policy、Open Graph 基础预览元数据；社交预览不执行 JS 上报，因此不增加访问。
- /download/ 维持历史普通跳转与一起听/音乐分享参数传递；**绝不在这里记录推广 PV**。首页、/scan/、普通 API 获取同样不增加推广访问。

### 6.2 归因身份与七天有效期

- Web 复用当前官网 localStorage 键 pm_site_visitor_id，以浏览器 UUID 作为统计身份；本地存储不可用时用本次页面的临时匿名 UUID，不用固定值假装全部访客是同一人。
- 有效访问 POST 时服务端设置 7 天的签名第一方归因 Cookie（建议专用密钥 APP_SHARE_ATTRIBUTION_SECRET），生产属性 HttpOnly、Secure、SameSite=Lax、Path=/；开发 HTTP 仅去掉 Secure 便于本地验证。密钥不能硬编码生产默认值。
- Cookie 代表受签名保护的**浏览器访问归因身份/会话**，而不表示被分享用户/设备的真实身份；绝不包含账号、设备 ID 或 Token。可仅包含不可反查个人的匿名会话标识，服务端依据最近 7 天的有效访问事件选择最新触点。
- 对不同标签页打开 A 后 B 的情况：页面加载即生成 openedAt 和本地单调序列，限范围校验并记录；客户端只允许较新导航覆盖本地最新状态，服务端按可信范围内的导航顺序选最后有效触点，拒绝旧请求的迟到覆盖。访客 Cookie 身份一致，不能因响应乱序改变最后触点。
- 下载归因优先级：URL 中存在 code → 仅当此码有效时归因；**显式无效 code 不回退 Cookie**；URL 不包含 code → 从签名 Cookie 查找 7 天窗口内最新有效触点；Cookie 失效、过期或删除则普通下载。
- 因 Cookie 是 HttpOnly，浏览器端不要依赖读取它来判断归因；当前跳转链继续显式透传 code 以覆盖禁用 Cookie 的情况。
- GET /api/config/download/:platform 的 302 Location 指向现有七牛签名地址或配置直链，**不将 code 附加给外部目标 URL**；Referrer-Policy 防止把内部推广码传给外站。

### 6.3 网站按钮与兼容参数

- 更新 server/frontend/src/Home/components/DownloadSection.tsx 和 src/api/update.ts：从页面 query 提取并严格校验当前 code，将其带入 /api/config/download/android?code=... 或 /desktop?code=...；没有显式 code 时由服务器 Cookie 归因。
- 其他使用 /api/config/download 的网站按钮（如 Hero、试听下载 Modal）不必为了归因复制参数逻辑；确认是否需要统一用公共 URL 构造器，Cookie 兜底保持一致。
- 保持 /download/ 原有 downloadPlatform、listen-together-join、music-share 的参数兼容；防止循环跳转及丢失 roomId/uuid；合法未知参数不误拼到第三方安装包 URL。
- 允许手动直达 /app-share/?code=... ；/download/ 不再作为新分享入口。安装包不可用时维持原有「即将开放」状态，并拒绝新增推广下载计数。

## 7. Android App 改造

### 7.1 DTO、Repository 与网络 Header

- 扩展 pm/app/src/main/java/cn/partialy/pm/appshare/AppShareModels.kt：在既有 AppShareConfig 原字段不变前提下，新增 shareCode: String?、trackingEnabled: Boolean（默认 false，兼容旧服务端 JSON）。
- 修改 AppShareRepository：调用**原有** GET /api/config/app-share 时显式提供 x-pm-device-token 和 Authorization Header（登录带 Bearer；未登录无 Bearer）；从 ServerDevicePrefs 和 AccountSessionStore 获取当次身份快照。旧无凭证请求仅做配置展示，不作为新版推广成功。
- 设备 Token 不存在或校验失败时先调用已有设备上报流程刷新；账号 Token 失效走现有续期/重新登录；禁止把登录失败隐式转游客。
- 保存整份 JSON 缓存，但缓存键从单一 config 调整为不可串用的 (deviceId, identityKey)；可另保留一份不含专属码的通用配置快照以显示 App 图标/名称/描述。升级旧的单键缓存时**不得**作为任何身份的有效专属链接。
- 当前身份从未成功取得短码时二维码/复制/系统分享暂不可用，展示占位和加载态；成功后原子更新完整快照。网络失败可以显示已核验属于当前身份的缓存专属链接，但需明确离线状态。
- 同一身份连续打开、关闭、账号切换、设备凭证更新时，使用当前身份键 + 请求序号在主线程完成最终核对；旧响应不能覆盖新身份或在已销毁宿主上渲染。
- 服务端始终负责拼接二维码 URL 和模板文案，Android 不重复修改 code 或拼接 copyText；ShareQrBitmapFactory 继续生成黑白二维码和白边。

### 7.2 AppShareBottomSheet 交互

- 沿用现有 icon/标题/描述/二维码/复制/更多按钮、Coil 图标回退、ACTION_SEND 和 PmMessage，不引入分享 SDK。
- 未获取有效身份链接前显示加载态，复制/更多禁用；失败后显示可操作的「重试获取链接」，不悄悄复制管理员的通用 URL。
- 已有当前身份缓存：立即显示完整二维码和文案，后台刷新配置；如果服务端发现短码已失效，需停用旧缓存并获取新码，避免继续散播已失效链接。
- 一次渲染中同时更新 snapshot、二维码与按钮状态，防止不同账号的二维码和文案交叉；窗口销毁/退出时取消异步任务。
- 当前用户在 Sheet 打开期间退出或切换登录账号，立即重新判定身份并禁用旧分享动作；UI 主线程、Lifecycle 和对话框引用均保证空安全。
- 保留原入口、主题语义 Token、字体适配与系统分享权限边界；新增公共 UI 组件才更新 pm/components.md。

## 8. Admin「运营与发布 → 分享记录」

### 8.1 路由、数据与视图

- 新菜单名称「分享记录」，所属「运营与发布」；推荐前端路径 /app-share-records，保留「系统设置 → App分享」原管理页；后端归档路径 /api/admin/app-share-records。
- server/admin/src/router/adminRoutes.tsx 注册 route key、分组；server/admin/src/layouts/AdminLayout.tsx 增加菜单；server/admin/src/App.tsx 懒加载对应页面。
- 建议新增 pages/AppShareRecordsPage.tsx、components/tabs/AppShareRecordsTab.tsx（或对应可复用组件）、api/appShareRecords.ts、types/appShareRecords.ts；沿用 AntD Table、Modal、RangePicker、Tag、Pagination 与现有主题。
- 列表字段：分享人（用户名/账号 ID/游客）、设备类型及设备 ID 摘要、六位 code、首次分享时间、最近访问/下载时间、有效状态、PV、日 UV（口径明确）、Android 下载、Windows 下载、总下载、查看详情/复制链接/失效操作。
- 汇总：分享链接总量（区分有效/失效）、累计 PV、累计下载触发次数、下载触发/PV 比率；提供全站日 UV、日趋势及平台分布，明确时间区间和数据口径。禁止把它命名为「成功安装数」。
- 搜索：code、用户名、账号 ID、设备 ID；过滤有效状态，时间维度（创建/最后访问/最后下载）及日期范围；默认创建时间倒序，每页 20 条，可按 PV/下载/最近活跃排序；筛选改变时重置到第一页。
- 详情 Modal 展示身份快照、原链接、创建/失效时间、汇总、按天趋势、访问明细与下载明细独立分页，并明确旧事件按 180 天保留而累计不丢失。
- 失效操作使用 AntD Modal 二次确认，说明旧码停止归因且不可恢复、再次分享发新码；不可删除、恢复、手填短码或修改统计值。成功后刷新保留当前筛选和分页。
- 手动刷新始终可用；可选「自动刷新」开关默认关闭，开启后每 30 秒刷新当前视图，页面隐藏或路由卸载即停止，不清除详情/筛选状态。
- CSV 导出遵守当前筛选与排序，UTF-8 BOM 供中文 Excel 查看，日期使用明确时区；仅非敏感展示字段，不包含原始 IP、指纹、认证 Token。文本值做 CSV 正确转义以及防公式注入（以 =、+、-、@ 等字符开头的内容以安全方式转义）。
- Admin「App分享」配置表单实时预览通用 URL（无 code），提示实际二维码由服务端按账号/设备填入 code；默认/恢复默认 URL 改为 https://pisamusic.partialy.cn/app-share/，配置修改不影响已存在码的身份绑定。

## 9. 安全、隐私与运行边界

- 公开接口：严格 Base62 正则、输入长度限制、访客 UUID/事件 UUID 校验、速率限制（IP + 设备身份业务约束）、适度反爬（预取/头部/User-Agent）；错误信息不泄露账户、设备信息或数据库结构。
- 访问上报的 visitorId 不是认证凭据，不能用它查询真实用户；只在服务端存储其带盐哈希。机器人识别仅是近似，统计页面应提示不可作为奖励结算证据。
- 不将账号 ID、设备 ID、设备指纹、Token、IP 原文传入外链，亦不将 URL 的 code 拼入第三方七牛/手填下载直链；对 Cookie 签名校验失败直接忽略，不允许客户端伪造账号归因。
- Cookie 密钥通过服务端环境配置，生产强制非空且足够强；同步 server/.env.example，不提交任何生产密钥。反向代理实际 HTTPS、trust proxy、CDN no-store、Referrer-Policy 需部署验收。
- 查询接口不得按 user_id/device_id 暴露公开搜索；所有 Admin 列表/详情/导出必须经过 requireAdminJwt。
- 旧全站 download_records 依然由官网正常写入；推广侧不能破坏限流、防机器人拦截和直链有效性。统计服务出错时遵守 Q18：允许普通下载，写诊断日志，不捏造成功的统计事件。
- 隐私政策在现有 SQLite content_pages 的 privacy 内容由 Admin 发布。实施前核实当前真实文本并合并新增「推广短链、账号/设备关联、匿名访问标识、7 天 Cookie、明细保留 180 天、汇总长期保存、用途/撤销」条款；保留管理员已有正文与版本递增机制，不在迁移时粗暴覆盖线上政策。
- 上线前完成隐私告知；若生产政策不能在本次部署自动发布，则明确列为发布阻断项，交付可直接粘贴的增补文案并让管理员通过现有「内容与协议」发布。

## 10. 文件级实施清单

**Server：**
- 修改 server/src/db/appDb.ts：四张表、索引及增量迁移；server/src/db/analyticsStore.ts：接入/抽取可组合的下载写入事务及按期清理。
- 新增 server/src/db/appShareTrackingStore.ts、server/src/services/appShareTrackingService.ts、server/src/routes/appShare.ts、server/src/routes/adminAppShareRecords.ts。
- 修改 server/src/services/appShareService.ts、server/src/routes/config.ts（复用现有 GET 与下载路由），server/src/routes/admin.ts、server/src/index.ts（路由、强制明文、限流、预取过滤）；server/src/db/appShareStore.ts 更新默认分享 URL/验证（需要时）；server/.env.example 添加独立 Cookie 签名密钥说明。
- server/apidoc/config/appShare 相关文档（按现有实际目录命名）、server/apidoc/config/downloadPlatformRelease.md、server/apidoc/admin/ 分享记录文档及 server/apidoc/index.md 同步更新。

**Web：**
- 新增 server/frontend/public/app-share/index.html；修改 server/frontend/public/download/index.html 仅为旧路径兼容（不计 PV）。
- 修改 server/frontend/src/Home/components/DownloadSection.tsx、server/frontend/src/api/update.ts，必要时抽取公共 download URL 构建器；server/frontend/src/App.tsx 处理无斜线兼容（若静态站路由需要）。
- 检查 server/frontend/src/api/analytics.ts 对 pm_site_visitor_id 的复用逻辑，不破坏普通官网每日访问分析；新增分享访问页面所需独立 JS，避免通用主页访问误计推广 PV。
- 核查构建 server/web-user/app-share/index.html 与代理路由部署。

**Android：**
- 修改 pm/app/src/main/java/cn/partialy/pm/appshare/AppShareModels.kt、AppShareRepository.kt；pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt；pm/app/src/main/java/cn/partialy/pm/ui/dialog/AppShareBottomSheet.kt。
- 复用 pm/app/src/main/java/cn/partialy/pm/utils/ServerDevicePrefs.kt、network/auth/AccountSessionStore.kt 及现有设备上报/Token 续期逻辑；仅必要时新增小型身份快照/缓存辅助类。
- 修改所需布局、字符串与操作状态资源；先查 pm/components.md，保持 PmMessage、Material3、主题与二维码共用组件。

**Admin：**
- 修改 server/admin/src/router/adminRoutes.tsx、src/layouts/AdminLayout.tsx、src/App.tsx、src/pages/AppSharePage.tsx 及其 API 类型与默认值。
- 新增独立分享记录页面、表格/详情、API 类型和 CSV 工具；避免重复堆入旧的歌曲分享管理页面。

**文档/约束：**
- 更新根 AGENTS.md、pm/AGENTS.md、pm/components.md（仅新组件需要时）、server/apidoc/index.md、相关 server/apidoc 及隐私政策发布说明。
- docs/app-share/tracking-plan.md 作为本功能实施与验收记录；旧 docs/app-share/plan.md 原样保留，标注两者关系而不回写旧的审查结论。

## 11. 分阶段实施与 Git 提交顺序（仅计划，暂不执行）

1. **Server 数据层**：确认正式 schema、建表/幂等迁移、唯一约束、随机码、身份解析、失效与四张表聚合；测试游客、账号、并发与碰撞。建议提交「feat(server): 新增App推广身份与统计存储」。
2. **Server API 与下载归因**：扩展原 GET /api/config/app-share、公开校验/访问上报、管理员记录接口、下载事务与安全/白名单；补齐 API 文档与聚焦测试。建议提交「feat(server): 接入App分享归因与管理接口」。
3. **Web**：新增 /app-share/ 静态页、单一访问上报和归因跳转、首页下载按钮透传，确认旧 /download/、音乐/一起听邀请仍可用。建议提交「feat(web): 新增App分享追踪入口」。
4. **Android**：改造 GET Header、身份隔离缓存、二维码加载/复制状态及登录切换安全；确保原有设置入口与 UI 无退化。建议提交「feat(android): 分享App支持设备账号专属链接」。
5. **Admin**：分享记录列表/筛选/明细/失效/导出/自动刷新；配置默认 URL 更新。建议提交「feat(admin): 增加App推广分享记录」。
6. **文档、隐私与联调**：隐私政策发布或交付、接口索引和 AGENTS 同步，跨端测试、数据验证与必要修复。按模块分别提交小修，最后建议提交「docs: 更新App分享追踪与验收说明」。

每个阶段先执行 git status，精确 git add 指定文件；不暂存用户原有无关变更，不强行切分支、不合并 master、不推送，除非另获明确要求。**已确认根 .gitignore 第 24 行忽略整个 docs/，本计划虽然已保存到磁盘，但不会自动出现在 git status。若实施阶段要将此文档纳入版本控制，需仅针对目标文件使用 git add -f docs/app-share/tracking-plan.md（获得开始实施指令后），不得为此解除整个 docs/ 的忽略规则。**

## 12. 测试矩阵与验收标准

### 12.1 Server 身份、并发、缓存
- 游客设备 D1 重复 GET 返回同码；用户 A+D1 同码、A+D2 不同码、B+D1 不同码、guest+D1 不等于 A+D1。
- 旧端 GET 不带设备 Token 返回完整原字段且 trackingEnabled=false，不产生新纪录；携带有效设备 Token 首次 GET 新建；同身份并发请求只一条有效行。
- Base62 长度/大小写、随机碰撞重试、SQLite 部分唯一索引、失效后重发新码；原已失效码无法复活。
- 登录态仅携带设备 Token、遗漏 Authorization 的问题通过接口层显式 Header 予以防范；无效设备 Token、过期用户 JWT、刷新失败均不得生成错误身份的链接。
- GET 新身份响应 no-store/Vary，Admin 改文案后同一 code 复用并返回新 copyText，旧客户端字段兼容；不依赖代理缓存。

### 12.2 访问归因与下载
- 扫描 /app-share/?code=... 真实进入页面才计一次 PV；刷新 +1，重试同 eventId 不重复；相同访客同日同码日 UV 仅 +1。
- 同一访客同日访问 A/B：两者 PV 及单码 UV 分别计入，全站日 UV 只 +1；按上海自然日跨天可新增日 UV。
- 社交平台预览、静态资源读取、直接打开首页、/download/、其他 API 均不增加推广 PV；无 code 和非法/失效码不计 PV。
- 先访问 A 再 B，B 为最后触点；A 迟到响应不能覆盖 B；有效 Cookie 七天内可在普通下载页归因，超期不归因。
- 显式有效 code 覆盖旧 Cookie；显式非法/失效 code **不**回退旧 Cookie；禁 Cookie 但显式 code 可完成当前跳转下载。
- Android、Windows 各点下载一次，官网原 download_records 每次 +1，推广 downloads 分别 +1；连点多次均按成功跳转触发计数。
- 已下架/不可下载、下载接口被限流、错误 platform、重定向失败不记推广下载；正常重定向不向七牛/外链泄漏 code。
- 新旧数据一致性：主表合计、事件明细、全站/单码日报可相互校验；事务失败没有「已上报但只更新一部分」；明细过期清理后累计日报及主表不变。
- 分享人自己点击可计 PV/下载触发，但**不能宣称邀请成功或奖励合格**。

### 12.3 Android、Admin 与官网回归
- Android 已登录、未登录、登录 A→B→游客、账户注销、设备 Token 过期及重新上报、App 离线打开缓存、首次网络失败/重试均没有串码或错误二维码。
- 分享 Sheet 关闭/切后台、Activity Destroy、迟到响应、二维码生成失败、大字体/深浅色均安全；复制和系统分享始终使用同一份经身份核对的 copyText。
- Admin 按短码、账号、设备、时间、状态筛选；各排序、20 条分页、刷新、30 秒轮询关闭/隐藏；详情趋势、平台拆分、历史事件和 CSV 中文/公式防注入正常。
- Admin 标记失效需确认，历史保留、无法恢复、原身份新码正常；统计用词明确区分 PV/日UV/下载触发、无访问时转化率显示「—」。
- 官网构建含 /app-share/，/app-share 无斜杠兼容，/download/ 旧通用入口、一起听 roomId、音乐分享 uuid 不受影响，Windows/Android 推荐逻辑不变。
- 隐私条款已可读取且发布版本正确，敏感字段未被公开接口、日志、外链、CSV 或二维码泄漏。

### 12.4 构建、检查与交付

- Server：pnpm --dir server build；针对建表、接口、Cookie、归因、限流、事务及历史兼容新增 .spec.ts 测试，隔离临时 SQLite（不能污染 server/data/pm.db）。
- Web：执行 frontend 的 tsc/Vite 构建，并用浏览器验证真实 /app-share/ 路由、地址栏 code、Cookie/禁 Cookie 与 302，不以静态代码阅读代替。
- Admin：TypeScript + Vite 构建，1440px 桌面和约 390px 手机布局检查；测试 CSV、Modal、无记录及错误态。
- Android：在 pm/ 执行 gradlew.bat assembleDebug（必要时 testDebugUnitTest），运行真机/模拟器验证用户切换、复制、二维码和消息反馈。
- 联调使用 Mock/测试实例与临时库，覆盖「Android 获取码 → 浏览器访问 → 官网下载 → Admin 显示 → 管理员失效 → Android 新码」全链路。
- 运行时数据库、.env、上传文件、Node/Gradle 构建产物不纳入 Git；最终汇报每阶段文件、构建结果、测试边界、Git 提交及生产待手工验收事项。

## 13. 口径说明与非目标

- 「分享时间」为首次创建该专属码的时间，不代表已经有人点击或传播；可展示 last_requested_at 但不要冒充访问时间。
- 「访问量」为有效 /app-share/ 页面上报次数（PV）；UV 为每分享码/自然日去重访客，累计日 UV 和跨整个历史全局唯一人数是不同指标。
- 「下载量」为成功发起安装包下载重定向的**次数**，不是下载完成、安装、激活或注册数；本期不实现安装回传、归因奖励、邀请排行榜或反作弊计费。
- 不实现跨不同浏览器/不同设备的匿名用户追踪，不引入 Redis、第三方分享 SDK、复杂验证码、跨端桌面 App 主动生成推广码、生产环境的自动数据库重建。
- 若上线后需要真正「邀请安装/注册数」，必须额外设计激活回执与防自邀请逻辑，不得复用下载触发数直接当作安装转化数。

## 14. 最终确认检查表

- [x] Q1–Q8：设备身份、缓存、生成时机、6位码、双平台、PV/UV/下载统计。
- [x] Q9–Q18：游客与登录隔离、账号注销、失效重建、最后触点、Admin、保留周期、统计降级。
- [x] Q19–Q29：四表、独立归因 API、7天 Cookie、事务、域名限制、静态页、Android、测试。
- [x] Q30–Q40：防刷、防预览、自身份认证、并发计数、仅 /app-share/ 记访问、URL 安全、失效 Modal。
- [x] Q41–Q49：原接口兼容、配置与隐私、CSV、轮询、计划存档。
- [x] Q50–Q53：**GET /api/config/app-share 原接口扩展而非新增申请接口**；旧版无凭证通用响应、新版设备凭证绑定、GET 幂等创建、码与文案解耦。
- [x] 无剩余业务决策阻断；编码仍需用户单独发起「开始实施」。

**设计状态：完整，等待实施指令。**
