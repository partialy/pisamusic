# Admin 管理后台规范

适用于 `server/admin/`。继承[根通用规范](../../AGENTS.md)，[Server 入口](../AGENTS.md)仅用于导航；后端实现细则不适用于纯前端页面任务。

## 技术栈与命令

- React 18 + TypeScript + Ant Design + React Router + Vite；图表使用 Recharts，优先复用项目现有组件、请求封装与交互模式。
- Admin `vite.config.ts` 固定 `base: "/partialy/"`，并通过同目录 `nginx.partialy.conf.example`（不进入 `web-admin/` 打包产物）隔离 `/`（返回 404）、`/partialy/`（Admin）与 `/h5/`（`web-h5/`）。
- 深色模式跟随浏览器 `prefers-color-scheme: dark` 自动切换：通过 `hooks/usePrefersDark.ts` 同步根元素 `dark` 类与 Ant Design `darkAlgorithm`（覆盖安装向导、登录页与主控制台），并在 `index.css` 统一映射常用浅色表面与文本色。
- **统一控件与弹窗规范**：`App.tsx` 与 `AdminLayout.tsx` 共用 `constants/theme.ts` 的 `getAdminThemeConfig`（`componentSize="middle"`、统一 `controlHeight` 与 `borderRadius`）；AntD `<Card>` 统一使用 `bordered={false}` + `adminCardClasses`（不叠加 `glassCardClasses` 的 `p-4`）；表单与设置卡片内统一使用 `middle` 尺寸 AntD 控件与 `<DatePicker showTime />`（不使用原生 `datetime-local`、`glassInputClasses` 或手写 `<label>` 上传假按钮）；主表格统一 `size="middle" bordered`、弹窗/二级子表统一 `size="small" bordered`，表格行内及高密度列表行内控件与 `Switch` 统一 `size="small"`，操作列统一纯图标 `<Button type="link" size="small" />` 配 `Tooltip`；弹窗统一使用 `MODAL_WIDTH`（`480/640/800/1000`）、`MODAL_BODY_SCROLL_CLASS` 与 `components/ui/ModalTitle.tsx`。
- 以下命令从仓库根目录执行：开发 `pnpm --dir server/admin dev`，构建 `pnpm --dir server/admin build`。
- 构建产物输出到 `server/web-admin/`，已忽略，不提交。不要恢复旧 `build:web`、`deploy:web` 或复制到 `server/web/` 的流程。
- 页面、业务组件、状态与请求按职责拆分；不在页面复制加密、鉴权或服务端业务规则。

## 管理功能约束

- 管理接口继续使用现有管理员 JWT 与加密请求链路；字段及规则以 [API 索引](../apidoc/index.md)及对应模块文档为准。
- **统一分页规范**：所有 Admin 分页列表统一传 `offset` / `limit`，响应 `data` 均已统一为 `{ list, total, offset, limit, hasMore }`（类型复用 `src/types/config.ts` 的 `PaginatedListData<T>`）。
- 仪表盘采用 Recharts 懒加载并作为默认主页；支持 7 / 30 / 90 天零填充趋势。“官网记录”固定放在左侧菜单第三项，列表显示摘要，详情再读取完整字段；仪表盘聚合响应不得暴露明细 IP、访客 hash 或 User-Agent。
- “接口文档”（路由 `/api-docs`，页面 `ApiDocsPage.tsx`）固定放在左侧菜单「仪表盘」下方、「用户中心」上方；通过 `vite.config.ts` 的 `server.fs.allow` 与 `src/utils/apidocRegistry.ts` 编译期打包 `server/apidoc/**/*.md` 为懒加载 chunk，解析 `index.md` 生成模块化目录树，支持全文检索、Method 筛选、代码复制、右侧 TOC 大纲与文档内相对链接跳转。
- “官网记录”保留每日域名 UV 访问列表、下载触发列表，支持域名（全部 / 未知 / 指定）和北京时间日期范围筛选；历史空域名展示“未知域名”。第三标签“域名统计”懒加载 `WebsiteDomainStats`，通过 `/api/admin/website-records/stats` 展示 7 / 30 / 90 天 UV/PV/Android 与 PC 下载触发、补零趋势、域名占比及页面 PV 排行。累计日 UV 与仪表盘口径一致，按各域名每日 UV 相加，同访客跨域/跨日可能重复；下载触发不代表安装完成。
- “运营与发布 → 分享记录”维护 App 推广记录，支持筛选、排序、详情事件分页、趋势、CSV 导出和单向失效；分享来源支持全部/Android/PC，列表与详情显示来源，来源筛选统一影响汇总/趋势/CSV；来源表示生成链接设备，与Android/Windows下载平台分开。筛选后UV为选中短码累计日UV之和；失效不删除、不恢复、不修改计数。推广隐私条款通过现有内容管理发布，不通过数据库迁移覆盖管理员内容。
- 歌曲 / 歌单分享记录使用独立 `/api/admin/shares`，支持类型、分享人关键词、有效性筛选和预览 / 复制扫码链接；只支持标记失效，保留历史。
- 网盘音乐管理支持批量上传与全局后台队列（`CloudMusicUploadQueueContext`，并发 3，关闭弹窗或切换菜单不中断，支持查看任务进度、失败重试与列表联动刷新）：第一步在浏览器本地通过 `music-metadata` 解析音频标签、时长、内嵌封面与内嵌歌词（支持同时选入同名外置歌词/封面图片自动配对）；第二步采用左右主从分栏逐项设置歌名、歌手、专辑、时长、状态、封面及在线编辑歌词文本（支持顶部一键批量填充歌手/专辑/状态）；第三步入队后自动执行会话创建、七牛直传、服务端 `stat` 轻量确认及正式状态落库。
- 网盘歌词转换集中于 `utils/cloudMusicLyrics.ts`：优先保留 native 原始 LRC（含 offset、多时间标签），其次使用 `timeStampFormat=milliseconds` 的 `syncText`，不将 `common.lyrics.text` 的去时间轴文本覆盖同步歌词；MPEG 帧时间戳不猜单位。文件扩展名按实际时间标签自动判定 LRC/TXT，无时间轴明确显示纯文本。编辑弹窗通过 `GET /api/admin/cloud-music/:uuid/lyrics` 懒加载当前已上传歌词原文，提供只读查看、复制和失败重试；不直接请求任意 URL。聚焦样本检查 `node server/admin/scripts/verify-cloud-music-lyrics.mjs`。
- 用户投稿的 KRC/YRC 在同一个歌词原文弹窗查看，二进制 KRC 由服务端解码，弹窗根据歌词内容识别逐字时间轴。
- 版本发布（Android / PC）统一采用单上传按钮多选自动匹配 + 全局后台发布队列（`ReleasePublishQueueContext`，关闭弹窗或切换菜单不中断，支持查看任务进度、失败重试与列表联动刷新）：新建打开自动读取当前平台最新版本号递增预填（统一保留 `v` 前缀）；Android 优先匹配第一个 `.apk`（无 `.apk` 时兜底 `.aab`）；PC 强制匹配并暂存 `latest.yml`、`.exe` 和 `.blockmap`（缺项报错并暂存已选文件，选入 `latest.yml` 时解析其 `version` 忽略前导 `v` 比对，不一致时以 `v` 前缀格式绝对覆盖并提示检查）；点击保存入队后再并发直传七牛并自动执行启用/发布。编辑模式支持通过 `GET /api/admin/desktop-updates/assets` 回显已有 PC 资产，仅重选对应槽位时覆盖替换。版本历史列表采用 `GET /api/admin/update-history` 分页与平台筛选，支持「导出记录」下载全部有效历史的 JSON 或 CSV。
- 文件管理增加用户歌单封面（playlist-cover）用途/标签/引用展示，pending可筛选；封面有引用或未满七天宽限期时禁止删除，不强制清引用。文件管理允许删除被版本引用的对象；界面应反映接口返回的删除状态与引用清理结果。完整删除发布历史仅允许非当前版本，当前版本须先发布替代版本。
- App 推广图标保存才切换引用，当前图标禁止删除；二维码地址仅允许本站 HTTPS `/app-share/`，不允许手填 code。
- 用户详情分类表格按 `/api/admin/users/:id/library` 分页，默认 30 条（支持 `favoriteSongs` / `favoritePlaylists` / `userPlaylists` / `playlistTracks` / `listeningHistory` 与 `active/deleted/all` 墓碑筛选），并通过 `UserSyncLogsPanel`（`/api/admin/users/:id/sync-logs`）只读排查同步变更日志与 `syncLogFloor`；不暴露密码 hash。系统 VIP 与第三方音乐账号分离，不支持永久 VIP；启用必须设置未来到期时间，关闭写入 `0 / NULL`。
- “验证码记录”位于用户管理下方，支持多维筛选、分页和删除；保留 email / phone、用途与发送 / 验证 / 过期 / 失败状态语义。
- 反馈与故障上报使用 `pending / processed` 两态；故障页支持 Android `play_url`、PC `desktop_network` 与崩溃 `app_crash` 筛选、详情、JSON / ZIP 导出和级联删除。
- 一起听后台支持在线 / 历史列表详情与在线房间安全解散，不影响普通用户接口契约。专属消息硬删除不提供客户端撤回语义；公告停用不删除历史及回执。
- 「系统公告」支持按手机端 / PC / 全部平台和 App 版本投放。当前版本在保存时锁定发布版本，常规编辑保留快照，可手动重新选择。新公告为 V2，V1 使用新增选项时先确认升级。列表与预览显示投放条件、等待时间与前往动作，正文编辑器支持文字颜色、斜体和高亮块 App 页面跳转。共享规则见[跨模块契约](../../agents/CROSS_MODULE.md)。
- 邮件 provider 默认含 `aliyun / 阿里云`、`resend / Resend`。端点批量替换只修改 hostname，保留协议、端口、路径，替换后仍须“保存端点”。
- 服务发现的 API / realtime 地址须为纯 origin，仅 HTTPS（开发 localhost 可用 HTTP），不带认证信息、路径、query 或 hash；更新 feed 可含路径，但必须是无认证信息、query、hash 的 HTTPS URL，后端保存时也须校验。
- 动态配置固定 `html / string / number / url`；运行时策略通过 `/api/admin/runtime-config` 维护。听歌等级配置按 `expectedVersion` 乐观并发整组提交，区间规则查阅[跨模块契约](../../agents/CROSS_MODULE.md)。
- 「曲库与资源 → 歌曲下载」（`/song-downloads`，页面 `SongDownloadsPage.tsx`）提供下载概览与 Recharts 趋势、Top 排行、用户/设备下载流水及四档配额策略（游客、大众+新注册赠送、动态 VIP 1..N 档、账号/设备独立覆盖与额外下载次数），支持多选 Modal 与列表多选批量配置。用户管理新增「批量赋予 VIP」弹窗（两步先查后赋，按邮箱/ID 批量叠加时间与升档）及编辑弹窗隐藏 VIP 档位选择；「运营与发布 → 兑换码管理」（`/redemption-codes`，页面 `RedemptionCodesPage.tsx` + `components/redemption/RedemptionCodeTable.tsx`）支持按批次命名与聚合管理（左栏批次列表、右栏批次内码分页与搜码定位）及「全部兑换码」直查切换、批量停用与删除（已使用码禁止删除、已核销完锁定状态），以及核销流水查询。
- 「运营与发布 → 侧栏菜单」（`/sidebar-menus`，页面 `SidebarMenuManagementPage.tsx`）维护手机端侧栏【内置入口控制】（`import_playlists`、`link_import`、`sleep_timer`、`theme` 的显隐、名称覆盖与图标）、【横栏区块】（有序多区块 `listSections`，支持标题或自动分割线）、【四宫格入口】（4 列网格、顶部/底部位置），支持七牛图片直传 `usageType='sidebar-menu-icon'` / HTTPS 图片 / SVG 源码 / 预置图标、文字/一次性红点/常驻红点及版本号重置，以及 `web` / `fullscreen_web` / `app_action`（13 项 App 原生页面或功能跳转）；右侧 `SidebarMenuPreview.tsx` 对齐最新客户端样式（底部「设置/扫码/反馈」吸底栏、无阴影列表与 4 列四宫格）实时预览。

## 契约维护与验证

- 涉及账号、分享、消息、发布、云盘等公共行为时，按需阅读[跨模块契约](../../agents/CROSS_MODULE.md)对应章节。
- API 新增、字段 / 规则变更或删除时，同步 `server/apidoc/` 对应文档与 `index.md`；需要修改后端时读取 [Server 后端规范](../agents/SERVER.md)。
- 前端改动运行对应构建；视觉或交互改动检查浏览器页面。纯文档调整只检查路径、链接、内容归属与差异，不运行完整测试。

## 数据库迁移管理页

- Admin外层 `InstallationGuard` 在鉴权前查询 `/api/setup/status`；未安装进入 `/#/setup`，失败显示重试，不完整传输目标禁止初始化。首管通过安装令牌创建，完成后登录；同站点切换独立数据库时按 `installationId` 清理旧会话。

- 「系统设置 → 数据迁移」路由 `/database-migration`，页面 `src/pages/DatabaseMigrationPage.tsx`；对应 API 封装 `src/api/databaseMigration.ts`。
- 展示当前运行引擎及env指定的另一目标，支持SQLite↔MySQL 5.7全量覆盖、完整备份、源与目标备份下载、进度日志和报告。SQLite运行时保留上传/快照来源，MySQL运行时以当前库为源。
- 普通 JSON 请求使用现有 Admin JWT + AES-GCM `fetchWithAuth`；`multipart/form-data` 上传使用独立 XHR，带 JWT、`x-pm-random`，响应 JSON 仍通过 AES-GCM 解密；备份下载使用二进制响应，不经 JSON 解包。
- 迁移维护时业务503；覆盖确认须说明目标停写、删除多余记录、先备份及文件资产不复制。`sync/COMPLETED` 恢复源库，`switch/READY_TO_SWITCH` 保持维护；两种引擎均可在无活动任务后确认恢复源库。Admin不改env、不自动切库或重启。
- 详见 [迁移接口与安全流程](../apidoc/databaseMigration/overview.md)。实际 MySQL 5.7 数据迁移须独立验收，不能只依赖前端构建成功。
