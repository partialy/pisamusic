# AGENTS.md

## 播放界面控制面板显隐规则补充

- 播放界面控制面板的鼠标位置与空闲判断由 main 侧 `PlayerControlsActivityTracker` 统一负责。
- main 使用 `screen.getCursorScreenPoint()` 与主窗口 `getBounds()` 按 100ms 采样；移出窗口隐藏，窗口内 3000ms 无移动隐藏，重新移动显示。
- renderer 只订阅 `player-controls:visibility`，不得恢复 `document.mousemove` / `clientX` / `clientY` 的并行计时器。
- 顶部 `-webkit-app-region: drag` 会屏蔽 pointer 事件，不能再把 renderer DOM 鼠标事件作为唯一活动来源。

## 一起听模块规则补充

- 一起听用于与 `pm/` Android 端进入同一房间、共享房主权威队列并同步播放状态；协议基线以 `server/src/realtime/listenTogether/` 与 `pm/app/.../listen/` 实际代码为准。
- 一起听二维码与邀请文案统一生成官网加入链接 `https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=<房间号>`；链接构造、官网链接和 `pisamusic://scan` Scheme 解析统一走 `src/listenTogether/listenTogetherShareLink.ts`，只接受 `listen-together-join` 与 4-8 位数字房间号。
- 桌面端深链由 Electron main 申请单实例锁并处理冷启动参数、`second-instance` 和 macOS `open-url`；renderer 未就绪或首次用户协议未确认时保留最新有效邀请，主窗口初始化完成后通过只读 `listen-together:invite` 事件投递，不允许 renderer 自行读取 `process.argv`。
- 外部邀请只由播放器栏默认 `ListenTogetherEntry` 消费：未登录时保留房间号并打开现有登录卡，登录后自动续接；同房只打开房间面板；异房必须二次确认，并按“查询目标房间 → 等待旧房间离开 ACK → 断开旧连接 → 加入目标房间”执行，离开失败不得清空当前房间。
- 模块目录与职责：
  - `electron/listenTogether/`：HTTP 客户端（config 明文、创建/查询房间走账号加密请求）、Socket.IO 客户端（单例、websocket-only、ACK 10s 超时、真实 RTT）、service（连接事件与广播经 `listen-together:connection/broadcast` 推送主窗口）；HTTP 与 Socket 连接只允许在 main，renderer 不持有服务端地址与 token。
  - `electron/ipc/listenTogetherIpc.ts`：`listen-together:*` IPC，emit 命令经联合类型白名单校验。
  - `src/types/listenTogether.ts`：两端共享协议类型（main 与 renderer 共同引用，禁止引入 Vue/Electron/Node 依赖）。
  - `src/listenTogether/`：纯规则（`listenTogetherRules/Queue/Song`，vitest 覆盖）、队列引擎（`listenTogetherQueueEngine`）、房间动作（`listenTogetherRoomActions`）与统一播放命令层（`playbackCommands`）。
  - `src/store/listenTogether.ts`：renderer 状态机（房间生命周期、广播/ACK 版本过滤、远端同步竞态保护、450ms 切歌防抖、6s 房主心跳、账号联动清理）。
  - `src/components/listenTogether/`：入口（双形态 chip）、未入房面板、房间面板。
- 房间队列为房主权威：服务端只转发 `QUEUE_EVENT`（SNAPSHOT_REQUEST/SNAPSHOT_CHUNK/QUEUE_COMMAND/QUEUE_DELTA），不持久化队列；快照 200 项/块、块间 50ms；纯指针移动（NEXT/PREVIOUS/PLAY_ITEM）不 bump queueVersion、不发 DELTA，指针靠 `CHANGE_SONG` 的 `queueItemId` 对齐。
- 协议硬约束：`PLAY/PAUSE/SEEK/ENDED` 必须携带 `songRef`；`CHANGE_SONG` 携带 `transitionId` 与 `queueItemId`；只有匹配 pending 的 CHANGE_SONG 才能结束切歌防抖；ACK `applied=false` 不得当成功处理；广播不回发起方，发起方用 ACK 中的 room 更新状态；`QUEUE_EVENT.version` 恒为 0，队列排序只看 `queueVersion`。
- 本地歌曲（`source: "local"`）不支持一起听：不能创建房间、不能点播进房间、协议歌曲不携带 `filePath` 与真实播放 URL（`url` 发空串，接收端自行取链）。
- 一起听成员头像由 main 侧 `electron/listenTogether/listenTogetherAvatar.ts` 统一把服务端相对地址转为绝对地址，空值使用服务端默认账号头像；renderer 只展示图片并使用本地默认头像作为加载失败兜底，不要回退成姓名文字。
- 所有新增播放入口（按钮、托盘、快捷键、MediaSession、歌词点击、右键菜单、列表/队列操作、自动续播与失败跳过）必须经过 `src/listenTogether/playbackCommands.ts` 统一命令层，禁止直接调用 `useAudioStore` 的 play/next/prev/seek/switchPlayList/setPlaylist/nextPlay/removeFromPlaylist/reset；一起听权限守卫在命令层与 store，不允许只靠 disabled UI。
- 首页歌曲网格和“查看更多”歌曲页的右键、更多按钮统一复用 `src/components/common/ContextMenu.vue`；菜单至少包含播放、下一曲播放、分享、收藏、添加到歌单、添加到播放队列和详情，详情统一进入 `/media/detail`，不得在列表组件复制一套操作逻辑。
- 一起听 Socket 命令可能包含 Pinia/Vue 响应式队列项，调用 preload API 前必须经过 `src/listenTogether/listenTogetherIpcPayload.ts` 转为纯 JSON DTO；不能只依赖 preload 内克隆，因为 `contextBridge` 会在进入 preload 函数前先克隆参数。
- 一起听中“仅添加到队列/下一首播放/清空队列/整列表播放”因 PM 协议无对应命令而禁用或降级为单曲点播，不要自创 PM 不认识的队列命令。
- 验证命令：`pnpm --dir yixi test:listen-together`（纯规则单测）与 `pnpm --dir yixi build:t`；涉及协议字段或队列行为改动时，必须与 PM 真机做跨端联调（双向房主/成员、重复歌曲 queueItemId、快速连续切歌、30 秒断线重连、权限关闭旁路审计）。

## 关于页、协议与反馈规则补充

- `src/components/setting/about/AboutSetting.vue` 负责桌面端关于内容，并嵌入设置页“关于”Tab；设置页 Tab 由 `/setting?tab=<name>` 驱动，右上角“设置 → 关于”和旧 `/about` 地址必须统一进入 `/setting?tab=about`，不得恢复独立关于页。当前版本通过 main 侧 `system:get-app-version` 读取 Electron `app.getVersion()`，服务端关于信息通过 `system:get-about-info` 请求 `/api/config/about`；renderer 不直接拼接或请求 server 地址。
- 开发环境的“模拟检查更新”走 `updater:simulate-check`，只用于未打包运行时触发有更新提示，不影响正式 `electron-updater` 下载和安装流程。
- 用户协议、隐私政策和意见反馈入口固定放在关于页内；协议/隐私通过 main 侧 system IPC 拉取 `/api/config/service-agreement`、`/api/config/privacy-policy` 后在弹窗展示，反馈表单通过 `system:submit-feedback` 提交 `/api/feedback`。
- 反馈图片由 renderer 读取为可序列化二进制后交给 main 侧组装 `FormData`，最多 3 张，格式限定 JPEG/PNG/WebP，单张不超过 5MB；不要让 renderer 直接持有反馈接口 URL。

## 歌曲/歌单详情与分享规则补充

- 桌面端歌曲/歌单详情统一使用主区域路由 `/media/detail`，菜单进入时只在 query 中携带经过白名单裁剪的 canonical payload；分享外链进入时使用 `kind=share&uuid=<uuid>` 后由 main 侧读取公开分享接口。
- 分享创建和公开读取只走 main/preload 暴露的 `share:*` IPC：`electron/system/systemClient.ts` 访问外层 `server` 的 `/api/shares` 和 `/api/shares/public/:uuid`，renderer 不直接拼接 server 地址、账号 token 或加密请求。
- 分享链接继续复用官网扫码入口 `https://pisamusic.partialy.cn/scan?type=music-share&uuid=<uuid>` 与 `pisamusic://scan?type=music-share&uuid=<uuid>`；解析规则集中在 `src/share/shareLink.ts`，不要新增 `pisamusic://share` 或顶层 `/share`。
- 分享 payload 必须通过 `src/share/shareModels.ts` 白名单裁剪；不得包含本地 `filePath`、播放 URL、歌词正文、内嵌封面二进制或 renderer 响应式对象。
- `/media/detail` 的分享态不展示或强调音源：歌曲展示歌手、歌名、专辑、时长和访问次数；歌单展示描述、分享人和访问次数。本地 payload 详情仍可保留来源及本地统计信息。
- `/media/detail` 同时承载本地歌曲/歌单详情和接收分享详情，页面内不再提供独立返回按钮，统一使用全局 Header 返回；详情入口不得另建重复页面。
- Electron 外部扫码动作由 main 侧协调器缓冲冷启动/二次启动参数：一起听继续投递 `listen-together:invite`，音乐分享投递 `share:invite`，renderer 只消费只读事件并跳转详情页。

## 服务端地址规则补充

- 正式包通过 `https://pisamusic.partialy.cn/pm-config/config-v1.json` 做第 0 层服务发现；`systemClient`、一起听 Socket、账号相对头像和 updater 只能读取 `serviceDiscovery` 快照。
- 远程失败按 cache → embedded 降级，业务探测失败才进入本地模式。
- 本地模式仍允许自动更新，避免 API 故障时失去客户端恢复通道。
- 开发环境变量 `PISA_SERVER_URL` / `PM_SERVER_URL` 仍可覆盖本地服务地址。
- API、realtime 与环境变量覆盖必须是纯 origin，不得包含路径、认证信息、query 或 hash；自动更新 feed 可包含路径，但必须是无认证信息、query、hash 的 HTTPS URL。
- renderer 不持有或拼接服务端 baseURL；不再暴露 `system:get-base-url` 或 `getSystemBaseUrl` 兼容接口。

## 本地与下载补充

- 本地/下载歌曲封面展示优先通过 `library:local:cover` 在 main 侧读取音频元数据图片并缓存；renderer 不直接读磁盘，元数据无封面时才使用默认封面。
- 本地/下载歌曲右键移除统一走 `library:local:songs:remove`：普通“移除”只删除 SQLite 可见记录，“彻底删除”才删除磁盘文件；本地扫描歌曲下次重建曲库可以重新出现。

## 播放音质与下载规则补充

- 播放/下载音质偏好统一写入 SQLite settings 的 `playback-quality-preference`，按来源保存 `kg:*`、`wy-br:*`、`wy-level:*`、`kw:*` 这类 qualityKey；不要再新增 localStorage 音质记忆。
- 音质权益只认 PisaMusic 系统账号（`vip` 且 `vipExpiresAt > Date.now()` 为有效 VIP），与 KG/WY 第三方登录 Cookie 完全分离；KW 保持全量开放不受系统账号影响。
- KG/WY 音质始终展示完整目录，并按可用项在前、不可用项在后稳定排序。三档权限矩阵：未登录（游客）WY 仅 128k/标准可用、KG 仅 128 可用，其余禁用并标记“需登录”；普通登录账号 WY 开放原 4 档、KG 开放原 3 档，其余禁用并标记“解锁”；有效 VIP 开放全部 12 / 6 档。普通账号点击“解锁”必须进入 `/setting?tab=about` 的意见反馈弹窗，预选“账号相关”并提示用户提交需求等待审核。
- PisaMusic VIP 只允许在桌面端 Header 昵称尾部显示金色斜体方块 `V`，并在 `/user/profile` 为有效 VIP 显示“特权到期时间”；不得扩展为等级名称、会员中心或其他 VIP 标识。有效性统一实时判断 `vip === true && vipExpiresAt > Date.now()`。
- renderer 与 main 统一共用 `src/musicQuality/musicQualityPolicy.ts` 纯策略模块；main 侧取链、媒体缓存建 key（`source + songId + qualityKey`）与下载任务落库前必须由 `electron/music/qualityAccess.ts` 强制归一化，防止 IPC 或旧参数越权。
- `music:resolve-playable-url` 支持 `qualityKey`，KG/WY 高品质取链在 main 端优先使用对应登录 Cookie 直连 `kgServer` / `wyServer`，失败后才回退普通取链；renderer 不直接持有 service URL 或 Cookie。
- 下载能力集中在 `electron/download/` 和 `download:*` IPC，renderer 只能传规范化歌曲、qualityKey 和下载目录；不要在页面组件里直接写文件或嵌入音频标签。
- 下载任务由 main 进程内存 Map 管理，`download:start` 只创建任务并返回快照；renderer 通过 `download:tasks` 轮询进度，不要在 renderer 自己维护真实下载 Promise。
- 下载记录写入 SQLite `download_records`，保存 source/songId/qualityKey、状态、字节数、最终文件、缓存文件、元数据 JSON、歌词、封面和源 song payload 的关联关系。
- `本地与下载` 页固定包含本地歌曲、下载歌曲、正在下载、下载记录四个 tab；本地歌曲需要合并扫描曲库与已下载歌曲，下载歌曲只显示 `download_records` 中完成的歌曲。
- 下载歌曲优先用 `@yortyrh/tagpilot-lib` 写入标题、歌手、专辑、封面等音频标签；歌词稳定保存为同名 `.lrc`，标签写入失败时保留缓存侧车文件并在下载记录中标记 `sidecar`。

## 登录 Cookie 模块规则补充

- KG / WY 登录 Cookie 能力统一放在 `electron/cookie/` 与 `electron/ipc/cookieIpc.ts`，IPC 前缀使用 `cookie:*`；不要把登录 Cookie 逻辑写回 `music:*`、`proxyAPI` 或页面组件。
- Cookie 持久化使用 `app.getPath("userData")/data` 下的 JSON 文件：`kugou_cookie_user.json`、`wy_cookie_user.json`，结构为 `{ "cookies": [{ "name", "value", "path", "expires" }] }`。
- WY Cookie JSON 只允许保存 `MUSIC_U`；登录窗口、接口响应或旧文件里出现的其它网易 Cookie 都要在 main 侧过滤掉。
- Cookie 存储采用内存优先：首次访问从 JSON 文件加载到 main 进程 Map，后续请求读取内存；只有登录、退出、Cookie 更新、过期/非法项清理时写盘。
- KG Cookie 刷新由 main 侧 `refreshKgCookieIfNeeded()` 统一处理，刷新时间戳写入 SQLite settings 的 `cookie-kg-refresh-state`；12 小时内不要重复请求 `/login/token`，启动时可静默检查一次。
- renderer 只能通过 preload 暴露的 typed API 和 `src/utils/api/cookieMusicAPI.ts` 访问登录、Cookie、账号资料与用户歌单；不要再用 localStorage 保存 KG/WY 登录态。
- 需要 Cookie 的 KG/WY 请求直接访问 runtime endpoints 中的 `kgServer` / `wyServer`，并在 main 端通过 `requestSignedGatewayWithCookie()` 追加 Cookie 与签名；不要走 `proxy-service`。
- 侧边栏 KG / WY 入口是登录态动态菜单：renderer 统一通过 `src/composables/useCookieAccountStatus.ts` 读取账号资料并共享状态；只有对应 Cookie 账号已登录时才显示 `/kg`、`/wy` 入口。
- `我的` 页使用类似收藏页的标题 + tab 结构，tab 固定为账号、KG云盘、WY云盘、KG歌单、WY歌单；账号页承载 KG / WY 登录卡片，云盘页先放 `SongList` 占位，歌单页通过 Cookie API 拉取用户歌单并复用 `PlaylistCollect` 排版。设置页不再展示账号设置 tab，只保留应用配置与调试能力。
- WY 云盘歌曲通过 `cookie:wy-cloud-songs` IPC 调用 `/user/cloud`，renderer 转成 `Song[]` 后复用 `SongList`；云盘歌曲本身不带播放 URL，播放时仍交给现有 WY 取链逻辑处理。

## Electron IPC 与桌面歌词规则补充

- main 侧 IPC 必须按职责模块化注册：窗口控制放在 `electron/ipc/windowIpc.ts`，日志放在 `electron/ipc/logIpc.ts`，音乐、持久化、system 继续使用各自 `ipc/*` 模块，不要再把新 IPC 堆回 `electron/main.ts`。
- preload 只暴露最小 typed API，不要恢复旧的 `store-get/store-set`、`get-request-url`、`open-kg-window`、cookie 读取等兼容入口；登录 Cookie 后续需要重新设计专用能力。
- 桌面歌词统一由 `electron/desktopLyricManager.ts` 管理，窗口必须是透明、置顶、`skipTaskbar: true` 的悬浮层；打开窗口时必须推送最近歌词快照，不能依赖切歌后才刷新。
- 桌面歌词状态用快照同步，包含当前歌曲、歌词、播放进度、播放状态、样式和锁定状态；renderer 更新歌词时即使窗口未打开，也要把最新歌词送到 main 缓存。
- 桌面歌词样式和锁定状态持久化统一使用 SQLite settings 的 `desktop-lyric-setting`；设置页、托盘和歌词窗口必须通过同一份 main 快照同步，不要新增独立 localStorage 或 electron-store 设置来源。
- renderer 捕获请求、收藏、播放、歌词等错误时，UI 只显示简洁提示，同时必须通过 `reportError()` / `electronAPI.reportError()` 写入 main 日志，便于查询堆栈和上下文。

## 收藏与侧栏规则补充

- 收藏歌曲、收藏歌单统一写入 SQLite 的 `favorite_songs` / `favorite_playlists`，renderer 通过 `library:favorites:*` IPC 和 `useCollectStore` 访问，不再新增文件式 `collect/*.json` 收藏持久化。
- 旧收藏 IPC（如 `collect-song`、`collected-songs`、`collect-list`）和旧 `/mine/collect*` 收藏页已经移除，不要恢复或新增兼容调用。
- 收藏键使用 `source:id`，组件判断收藏状态必须调用 `containsSong(song)` / `containsPlaylist(playlist)`，不要直接用裸 `id` 查询 `songMap` 或 `playlistMap`。
- 歌曲收藏只能传递规范化后的 `Song` 纯 DTO；进入 IPC / SQLite 前必须经过 `normalizeSong()`，避免 Vue Proxy、嵌套响应式对象或运行时 `url` 字段进入收藏持久化。
- 歌单收藏只能传递规范化后的 `CommonPlaylist` 纯 DTO；进入 IPC / SQLite 前必须经过 `normalizePlaylist()`，禁止把 Vue Proxy、原始接口对象、函数字段或裸 `id` 直接传入收藏链路。
- 左侧菜单保持扁平结构：首页、歌单、收藏、我的、本地与下载、设置；不要恢复旧的自建歌单/收藏歌单侧栏区或 Netease 分组入口。
- `我的`、`本地与下载` 当前是占位页，后续接登录、本地音乐或下载功能时再扩展对应页面。

## 请求与配置规则补充

- `electron/system/systemClient.ts` 是桌面端访问外层 `server/` 的统一入口：bootstrap/runtime endpoints 默认只做内存缓存，只有缓存为空时才拉取；需要强制刷新时才调用 `refreshBootstrap()` 或带 `fresh=true` 的 `system:get-runtime-endpoints`。
- `requestSystem()` 的账号鉴权统一使用 `RequestOptions.token` 或当前 `account-session` 自动注入；业务调用不得在 `headers` 中手写 `Authorization`。基础 Header 与调用方 Header 必须按名称大小写不敏感地合并，避免 Fetch 把 `authorization` / `Authorization` 拼成非法的逗号分隔 JWT。
- system API 请求需要对齐手机端 PM 的加解密规则：main 侧统一添加 `x-pm-random`、`x-pm-enc-ver`，JSON 请求体使用 `{ isEnc, encData }` 信封，响应如果返回加密信封必须在 main 侧解密后再交给 renderer。
- renderer 不要在页面、store 或 API 工具中直接向 `server` 获取 baseURL，也不要持有 AES 派生逻辑、网关签名密钥或真实音源端点；音源请求统一走 main 侧 `music:*` IPC。

## 当前补充规则

- 顶栏刷新按钮只允许由 `MainLayout` 重建当前子路由内容，不得调用 `window.location.reload()` 或 Electron 窗口重载；刷新过程中必须保留 App 级 PlayerBar、播放状态和一起听连接。
- `electron/music/` 封装 KG / WY / KW 三源歌曲搜索、搜索建议、播放地址解析、歌词获取，以及主页推荐、KG/WY 歌单搜索、列表、详情、歌曲列表、动态封面等基础接口，renderer 通过 `music:*` IPC 调用；验签、运行端点和后续加密逻辑保留在 main 侧。
- `music:playlist-tracks` 支持 `page/pageSize` 旧分页参数，也支持可选 `offset` 精确偏移；歌单详情页首屏固定快速加载 30 首，后台按最大 1000 首一批继续补齐，避免大量小分页请求。
- renderer 侧 `src/utils/api/musicAPI.ts` 是音乐搜索、取链、歌词获取、歌单基础接口和动态封面的过渡入口，旧 `directAPI` / `proxyAPI` 仅用于尚未迁移的登录、账号等模块或失败兜底。
- WY 歌词获取统一只调用 `/lyric/new`，该接口响应中的 `yrc.lyric` 和 `lrc.lyric` 分别作为逐字歌词与普通歌词来源；不要再为同一首歌额外请求 `/lyric`。
- Electron 主进程网络请求失败统一写入 SQLite `network_error_records`，当前覆盖 `systemClient.ts` 内的系统接口、反馈提交和签名网关请求；默认只保留最近 1000 条。`electron/faultReport/` 为正式故障上报边界，负责递归脱敏、DTO 映射、最多 300 条批次提交和按 `client_log_id` 精确回写；上报使用 `scene=desktop_network` 的加密 `/api/fault-reports`，不得上传完整应用日志、Cookie、本地文件或主机名，上报请求自身失败也不得再次写入错误记录。
- “高级设置”在开发和打包环境都显示，故障汇总与上报入口始终可用；Cookie 调试、原始网络错误列表、详情和导出只允许未打包环境展示。`debug:network-errors:*` 除 renderer 条件渲染外，还必须由 main IPC 检查 `app.isPackaged` 并拒绝正式版调用；正式 IPC 只允许 `fault-report:stats` 和 `fault-report:submit-pending`，不得向 renderer 暴露原始错误明细。

## 设置与目录选择规则补充

- “跟随歌曲自动换色”属于主题设置的一部分，统一写入 SQLite settings 的 `app-theme.followSongAccent`，默认关闭；renderer 监听当前歌曲时必须先判断该开关，再决定是否根据封面更新强调色。
- “本地设置”统一通过 `src/store/settingStore.ts` 管理，并写入 SQLite settings 的 `local-setting`；当前字段包含本地扫描目录、缓存目录、缓存大小上限、下载目录和歌曲命名方式。
- 目录选择能力统一走 `dialog:select-directory` IPC，由 `electron/ipc/dialogIpc.ts` 注册、preload 暴露 typed API；不要在 renderer 侧直接接触 Electron 原始 `dialog` 对象。
- 在线歌曲播放缓存统一由 main 侧 `electron/mediaCache/` 管理：`music:resolve-playable-url` 返回 `pisacache://media/<cacheKey>`，协议层负责 Range、本地分片命中和远端流式落盘；renderer 不得取得源站 URL、真实缓存文件路径或索引数据库。
- 播放缓存键固定使用 `source + songId + qualityKey`，索引独立存放在 `media-cache-index.db`，分片只允许写入缓存目录下的 `.pisamusic-cache/v1`；用户未配置目录时使用 `userData/data/media-cache` 默认目录。
- `cacheLimitGb=0` 表示关闭播放缓存；超限按 LRU 清理到上限的 90%。`media-cache:clear` 只允许清理受管播放缓存，不能删除下载歌曲、Chromium Cache、收藏、账号或主业务数据库。
- 播放缓存、下载中间文件和 Chromium `Cache` 是三套独立数据；不要复用 `download_records.cache_path` 或尝试通过移动 `userData/sessionData` 实现播放缓存。
- 媒体缓存验证命令为 `pnpm --dir yixi test:media-cache` 和 `pnpm --dir yixi build:t`；Range 拖动、断网完整命中、目录切换和 LRU 需要安装包手测。

## 主题规则补充

- 桌面端主题统一由 `src/store/theme.ts` 管理，持久化写入 SQLite settings 的 `app-theme`，不要在组件里直接读写 `localStorage("pisa-theme")` 或 `localStorage("theme")`。
- Naive UI 主题只通过 `NConfigProvider` 绑定 `useThemeStore().naiveTheme` 和 `naiveThemeOverrides`，不要在单个组件里硬编码 Naive UI 默认绿色或重复覆盖 primary token。
- 项目自有视觉变量集中写在 `src/base.css`，浅色/深色分别使用 `:root[data-theme="light"]` 与 `:root[data-theme="dark"]`；新增变量时写中文注释，方便后续调整颜色。
- 强调色通过 `--color-primary` 等运行时变量和 Naive UI overrides 同步，新增播放控件、选中态、进度条时优先使用这些变量。
- 主题背景渐变由 `src/store/theme.ts` 统一管理并写入 `--color-bg-track`；自动背景开启时根据主题色生成，关闭后才允许自定义渐变方向和最多 5 个颜色，不要在组件里直接硬编码应用轨道背景。

本文件用于指导 `yixi/` 桌面端 App 的开发。根目录规则仍然有效；本文件只补充桌面端自己的边界和约定。

## 项目定位

- `yixi/` 是 PisaMusic 当前 PC 桌面端 App 的主开发目录，旧 `pm-electron/` 不再继续作为桌面端实现目标。
- 项目源自早期一夕音乐代码，目前目标是整理结构、接入外层 `server/`、补齐 SQLite 本地数据、验签、加密和后端配置能力。
- 产品形态优先 Windows，后续兼容 macOS / Linux；打包使用 electron-builder。
- UI 可以保留已有设计资产和交互思路，但代码需要逐步工程化、模块化，避免把旧逻辑继续堆在单个大文件里。

## 技术栈

- 框架：Electron + Vue 3 + TypeScript + electron-vite。
- UI：Naive UI、Vue 组件、Pinia 状态管理；Tailwind CSS 已接入但关闭 preflight，并使用 `tw-` 前缀避免影响旧样式。
- 播放：howler 放在 renderer 播放层封装。
- 数据：SQLite 由 main 进程统一管理，renderer 通过 preload 暴露的安全 IPC 调用。
- 构建：electron-builder，优先保障 Windows 构建。

## 架构规则

- main 负责系统能力、SQLite、服务端配置拉取、验签、加密、音源请求、托盘、窗口管理。
- preload 只暴露稳定、最小化的 typed API，不暴露 Node、Electron 原始对象或内部密钥。
- renderer 负责 UI、交互状态和播放控制，不直接读取真实 baseURL、密钥、文件系统或数据库。
- shared 类型应抽离到明确目录，IPC 入参和返回值必须有统一类型。
- 旧代码里从 IPC 获取 baseURL、读取本地 `data/electronConfig.json` 或在 renderer 硬编码网关地址的逻辑，必须迁移为 main 侧读取 `serviceDiscovery` 快照；不得在调用方重新硬编码业务域名。
- 配置、公告、反馈复用外层 `server/` 接口；第 0 层发现文档按 `environment/development → remote → cache → embedded` 解析，SQLite 仅在 main-only `service_discovery_cache` 独立表缓存发现文档，不得使用 renderer 可访问的通用 settings key，也不把 bootstrap/runtime 作为持久化替代。
- system 能力通过最小化 `system:*` IPC 暴露，包括 bootstrap、runtime endpoints、公告、反馈；不得重新新增 renderer 可见的 baseURL 获取接口。
- 服务端加密、网关验签只允许在 main 侧封装，renderer 不直接持有 `gatewaySign.secret` 或 AES 派生逻辑。
- main 侧音源请求统一使用 `requestSignedGateway()`，它会从外层 `server` 每次拉取的 bootstrap 中读取 `gatewaySign`，并按 Android 端一致规则添加 `res-dec=1`、`t`、`n`、`s` 签名信息。
- renderer 启动后通过 `src/store/runtimeConfig.ts` 拉取 bootstrap/runtime endpoints，并统一应用到现有 `directAPI` / `proxyAPI` 实例；不要在页面里散落硬编码音源 URL。

## 数据规则

- SQLite 保存用户设置、主题设置、搜索历史、播放历史、队列快照等本地数据。
- 关键业务数据不要继续使用 localStorage 作为唯一持久化来源；迁移时可保留兼容读取，但写入目标应转向 SQLite。
- renderer 侧通用历史/队列读写统一经过 `src/store/library.ts`；本地扫描曲库读写统一经过 `src/store/localLibrary.ts` 和 `library:local:*` IPC。
- 搜索历史、播放历史、队列快照已经接入 SQLite；新增同类数据不要再新增散落的 localStorage key。
- 数据库、日志、运行目录、打包产物不纳入 Git。
- Electron 运行数据统一写入 `app.getPath("userData")/data`，不要依赖源码目录下被忽略的 `yixi/data/`。
- 迁移脚本必须幂等，重复启动不能重复建表或重复写入默认数据。

## 音乐与播放规则

- 音源优先保持 `kg`、`wy`、`kw` 三源分组搜索，不做跨源去重。
- 播放失败统一提示“播放失败，可尝试切换其他音源”；普通模式连续失败最多尝试 3 首，之后保持停止，只有成功播放后才重置失败熔断，避免无限切歌和重复提示；一起听模式不做本地自动切歌。
- 歌词可以先获取并进入 store，不要求首版展示歌词 UI。
- 需要保留 howler 作为播放引擎，避免后续再迁移。

## 代码整理规则

- 新增或重构代码优先按 `main / preload / renderer / shared` 边界拆分。
- 大型 Vue 组件要拆成页面、业务组件、基础组件和 hooks / store，不继续扩大单文件。
- 新增 Tailwind 样式类时使用 `tw-` 前缀，例如 `tw-flex`、`tw-gap-2`；不要改回无前缀或开启 preflight，避免冲突 Naive UI 和旧全局样式。
- 旧的无用代码、调试接口、废弃 API 和硬编码配置要在确认无依赖后清理。
- 涉及后端请求、加密、验签、音源解析的逻辑要集中封装，避免散落在组件里。
- 修改项目框架、持久化方案、IPC 契约或服务端契约时，必须同步更新本文件。

## 常用命令

- 安装依赖：`pnpm --dir yixi install`
- 开发：`pnpm --dir yixi dev`
- 构建：`pnpm --dir yixi build`
- 类型检查加构建：`pnpm --dir yixi build:t`
- Windows 打包：`pnpm --dir yixi build:win`
## 本地曲库与下载页规则补充

- “本地与下载”页面位于 `src/views/localDownload.vue`，首版包含“本地歌曲 / 下载歌曲”两个 tab；下载歌曲暂为空态，不要在没有下载落盘链路前伪造下载记录。
- 本地扫描目录统一存入 SQLite settings 的 `local-setting.scanDirectories`，最多 10 个；旧 `scanDirectory` 读取时只能作为兼容迁移来源，不要继续写入旧字段。
- 本地曲库扫描只允许在 main 侧实现，入口集中在 `electron/localLibrary/localLibraryService.ts` 和 `library:local:*` IPC；renderer 不直接访问文件系统或 SQLite。
- 本地歌曲写入 SQLite `local_songs`，扫描指纹写入 `local_library_scan_meta`；启动时智能扫描，设置变更和页面“立即刷新”强制重建。扫描失败必须保留旧库，不要先清空旧数据。
- 本地歌曲来源使用 `source: "local"`，播放时通过 `music:resolve-playable-url` 直接转换本地文件路径，不要走 KG/WY/KW 在线取链。

## 我的页、自建歌单与云盘缓存补充
- `我的` 页顶层入口固定为 `歌单`、`云盘`、`账号`：账号卡片保留，歌单与云盘内容分别拆到 `src/components/mine/MinePlaylistPanel.vue`、`MineCloudPanel.vue` 等组件内，不要再把大量业务逻辑堆回 `src/views/mine/index.vue`。
- 歌单分段为 `全部 / 自建 / KG / WY`，云盘分段为 `全部 / 私人 / KG / WY`；私人云盘和 KG 云盘当前只预留入口与空态，未接入真实拉取逻辑时不要伪造数据。
- 自建歌单使用 `source: "local"`，与 KG/WY 歌单缓存统一写入 SQLite `user_playlists`；自建歌单歌曲写入 `user_playlist_tracks`，云盘歌曲缓存写入 `user_cloud_songs`。
- `useMineLibraryStore` 负责我的页歌单与云盘缓存：启动时优先读取 SQLite，再在本次 App 生命周期内自动刷新一次网络数据；手动刷新失败时继续展示本地缓存。
- 自建歌单标签存入 `payload_json.tags`，最多 3 个，保存前需要过滤空标签并去重。
- 歌曲右键 `添加到歌单` 只允许添加到自建歌单；无自建歌单时从弹窗内引导新建，创建完成后继续执行添加。
- 自建歌单封面通过 `dialog:select-playlist-cover` 选择并缓存到 `app.getPath("userData")/data/covers/playlists`；renderer 不直接读写文件系统。
- 歌单播放全部/添加到播放列表统一走 `src/utils/playlistTracks.ts`：自建歌单从 SQLite 读取，KG/WY 从网络分页获取，QQ/KW 等未支持来源需要明确提示暂不支持。

## 启动页与首次协议规则补充

- 桌面端启动页由 `electron/startup/startupWindowManager.ts` 和 `web/startup-window.html` 管理，使用独立 Electron HTML 窗口，不要改回 Vue 页面内覆盖层。
- 首次用户协议状态统一写入 SQLite settings 的 `startup-user-agreement`，不要使用 localStorage 或 electron-store 另存一份协议状态。
- 主窗口默认隐藏加载；renderer 完成关键初始化后通过 preload 暴露的 `startup:renderer-ready` 通知 main，再由 main 关闭启动页并显示主窗口。
- main 进程启动阶段先完成第 0 层服务发现，再检查外层服务可用性、刷新 bootstrap 并上报 PC 设备；没网、服务不可用或 `appAvailable=false` 时才设置本地模式继续打开主窗口，renderer 只读取 `system:get-startup-service-state` 并用 `window.$notification` 提示。PC 设备封禁必须阻止进入。
- 本地模式下右上角设置下拉需要显示“重新链接”，点击后通过 main 进程重启整个 App，重新走启动检查流程；不要改成单纯刷新 renderer。
- PC 设备上报走 `/api/device/desktop/report`，服务端存储在 `desktop_device_info`，不要复用 Android 设备表。
- PC 在线升级走 `electron-updater`，main 进程只能从 `serviceDiscovery` 快照和 bootstrap 的 `updater.desktop.feedBaseUrl` 组合候选 feed；候选必须逐个校验，非法 bootstrap feed 不得阻断有效 discovery fallback；开发模式、未打包运行不检查更新，本地模式仍允许检查更新以保留恢复通道。

## 数据库模块拆分补充

- `electron/database/appDatabase.ts` 只保留 SQLite 连接生命周期与对外读写 API；公共类型放在 `types.ts`，建表与迁移放在 `schema.ts`，JSON / limit 工具放在 `json.ts`，DTO 归一化放在 `normalizers.ts`，数据库行到业务对象的映射放在 `mappers.ts`。
- 服务发现缓存只能通过 `AppDatabase.getServiceDiscoveryCache()` / `setServiceDiscoveryCache()` 在 main 进程访问；写入必须以 `configVersion` 条件更新，禁止通过 settings IPC 暴露。
- 后续新增 SQLite 表、字段或本地持久化能力时，按职责更新上述模块，不要把 schema、row type、mapper、normalizer 重新堆回 `appDatabase.ts`。

## 快捷键设置规则补充

- “快捷键设置”位于 `src/components/setting/shortcut/ShortcutSetting.vue`，由 `src/store/shortcut.ts` 统一管理配置、重复校验、App 内按键监听和动作分发，不要把快捷键业务逻辑直接堆到设置页组件里。
- 快捷键配置统一写入 SQLite settings 的 `app-shortcut-setting`，字段为 `enabled`、`global` 和各动作 `bindings`；不要新增 localStorage 或 electron-store 作为快捷键配置来源。
- 全局快捷键只在 main 进程 `electron/ipc/shortcutIpc.ts` 中通过 Electron `globalShortcut` 注册；renderer 只通过 preload 的 `applyShortcutSetting` 应用配置，通过 `onShortcutTrigger` 接收动作。
- 快捷键动作必须复用现有 store：播放控制走 `useAudioStore`，歌词锁定走 `useLyricStore().setDesktopLocked()`，收藏当前歌曲走 `useCollectStore().collectSong()`；不要新建并行的播放、歌词或收藏状态。

## 首页公告与热门歌曲规则补充

- 首页公告位于 `src/components/home/HomeAnnouncementCard.vue`，通过 preload 暴露的 `system:get-announcements` 读取外层 `server/` 公告，不要恢复旧的 `mainAPI.getHomeData()` 公告占位接口；`AppAnnouncementAutoPopup.vue` 在 `MainLayout` 级别负责每次 App 会话的最新公告自动弹窗，主界面加载后等待 2 秒再请求和展示。
- 公告使用 `content.schemaVersion=1` 的结构化内容；首页始终展示服务端最新 3 条文字摘要，图片以 `【图片】` 占位，完整正文通过 `HomeAnnouncementDetailModal.vue` 查看。详情弹窗使用不透明 `NModal/NCard`，无右上角关闭按钮，禁止遮罩和 ESC 关闭，底部只显示“我知道了”和条件性的“前往”，正文滚动条隐藏但滚动保留；显示状态必须复用一起听的 `NModal` 默认居中缩放与遮罩淡入淡出过渡：组件常驻挂载并从 `show=false` 切至 `true`，且显式传 `internal-appear=true` 以覆盖设置 Tab 的首次挂载时机，关闭时等 `after-leave` 后再清空公告数据，确保入场、离场和遮罩动画完整。
- 设置页 `/setting?tab=announcements` 提供全部公告列表和同一详情弹窗；右上角设置下拉菜单的“查看公告”必须进入该地址。普通查看列表不改变已读状态。
- 公告确认状态写入 SQLite settings 的 `home-announcement-confirmed-ids`；只有“我知道了”或成功“前往”执行确认，IPC 写入必须传普通字符串数组，不得把 Vue `ref`/Proxy 直接传给 preload；`showEveryTime=false` 的公告确认后不再自动弹出，`showEveryTime=true` 不写入长期已读，并在新的 App 会话再次自动弹出。
- 公告 HTTPS 链接和 `pisamusic://` 协议动作统一走 main 侧 preload IPC；HTTPS 的 `mode: "window"` 使用 Electron 新窗口、`mode: "external"` 使用系统外部浏览器，renderer 不直接使用 Electron `shell`。
- 首页热门歌曲通过 `music:top-songs` 调用 KG `/top/song`，由 main 侧读取 runtime `kgServer` 并使用 `requestSignedGateway()`；renderer 使用 `src/utils/api/musicAPI.ts` 的 `getTopSongs()`，不要直接持有服务端地址。
- 首页右侧热门歌曲卡片展示热门歌曲预览并提供“查看更多”进入 `/recommend/songs?type=kg-top`；底部“热门歌曲”节点复用推荐音乐的 `HomeSongGrid` / `KGRecommendSong` 模式，默认展示前 12 首。
- 首页 WY 内容包括“网友精选碟”(`/top/playlist`)、“WY推荐歌曲”(`/personalized/newsong`) 和 “WY推荐歌单”(`/personalized`)；统一在 main 侧读取 runtime `wyServer` 并通过 `music:*` IPC 暴露，renderer 不直接请求真实服务地址。
- 首页歌单类节点使用 `PlaylistCollect`，需要限制最多 4 行并在 `HomeSectionTitle` 右侧显示“查看更多>”；按钮进入 `/recommend/playlists`，通过 `type` 区分 `kg-top`、`wy-top`、`wy-personalized` 数据源。
- 首页歌曲类节点的“查看更多>”进入 `/recommend/songs`，通过 `type` 区分 `kg-daily`、`kg-top`、`wy-new` 数据源；推荐详情页标题优先使用入口 query `title`，否则使用内置映射。
- `/recommend/playlists` 和 `/recommend/songs` 属于推荐模块详情页，`MainLayout.routeToMenuKey()` 必须保持左侧菜单选中“推荐”；点击左侧“推荐”返回首页，现有 `/playlist/detail` 不改成推荐菜单选中。
- 推荐详情页数据源映射集中放在 `src/views/recommend/recommendSources.ts`，后续新增入口时优先扩展映射和页面内 fetch 分支，不要在首页散落硬编码接口逻辑。
- 首页向下滚动内容的进入动画统一使用 `HomeReveal`，通过 `IntersectionObserver` 做一次性轻微上浮淡入，并尊重 `prefers-reduced-motion`。
 
## 收藏与歌单同步

- 桌面端账号登录由 main 侧 `electron/system/systemClient.ts` 统一访问外层 `server/` 的 `/api/auth/*`，renderer 只能通过 preload 暴露的账号 IPC 发送验证码、注册、登录、刷新和退出；不要在页面、store 或旧 `mainAPI` 中直接持有 server baseURL、token 加密细节或 `/api/system/login/register` 旧接口。
- 账号登录状态持久化到 main 侧 SQLite settings 的 `account-session`，启动后由 `useUserStore().init()` 通过 IPC 刷新 7 天账号 token；刷新失败必须清理账号态但不阻塞本地播放。
- 用户资料页面固定为 `/user/profile` 和 `/user/editProfile`；资料读写走 main 侧账号 IPC，支持昵称、邮箱验证码换绑、上传自定义头像和恢复默认头像。自定义头像由 main 侧选择本地图片、请求 `/api/auth/avatar/upload-token`、直传七牛公开图片空间后再写入服务端资料；renderer 不直接拼 server baseURL、不持有七牛 token，也不要恢复旧的多张内置头像自选功能。
- 桌面端同步能力由 main 侧 `electron/sync/syncService.ts` 统一编排，使用账号 token 调用服务端 `/api/sync/changes`，按账号 `user_id` 隔离数据；renderer 只能通过 preload 暴露的 `sync:state`、`sync:now`、`sync:clear-state` typed IPC 查看状态、手动同步和清理本地同步状态，不再提供同步码创建、加入或重置流程；本地同步游标必须按账号隔离，账号切换时重新 seed 本地 outbox。
- `sync_outbox` 是本地待推送队列，账号切换重新 seed 前必须先清空旧队列；退出账号时由 main 侧账号退出 IPC 同步清理 `sync-state` 和 `sync_outbox`，不要只在 renderer store 里清理。
- 同步状态保存到 SQLite settings 的 `sync-state`，本地待推送变更保存到 SQLite `sync_outbox`；收藏歌曲、收藏歌单、自建歌单和自建歌单曲目变更后需要写入 outbox 并触发后台增量同步。
- 同步 payload 只使用 `Song` / `CommonPlaylist` canonical 字段；不推送 `source=local` 歌曲，不推送播放 URL、filePath、歌词正文、内嵌封面；自建歌单本地文件封面同步时置空。
- 远端 tombstone 应在 main 侧应用到 SQLite 后通知 renderer 刷新 `favorites:changed` / `mine-library:changed`，不要让页面组件直接写同步状态或数据库。

## 共享云盘模块规则补充

- 桌面端左侧导航在“收藏”与“我的”之间固定包含“云盘”Tab，主路由为 `/cloud`，投稿占位路由为 `/cloud/submit`。
- 云盘数据通信统一走 main 侧 `electron/cloudMusic/cloudMusicClient.ts` 和 `cloud-music:*` IPC（`cloud-music:summary`、`cloud-music:search`、`cloud-music:detail`）；renderer 不直接持有服务端地址或加密请求细节。
- 搜索与分页固定每页 20 条，支持最新优先（latest-wins）与 300ms 防抖；歌曲来源为独立 `source: "cloud"`，标签显示青绿色方块 `C`（`--color-source-cloud: #10b981` / `#34d399`），音质固定为唯一默认档 `cloud:default`。
- 播放取链与歌词获取由 main 侧 `musicService.ts` 直接请求 `/api/cloud-music/tracks/:uuid/play-url` 与 `/api/cloud-music/tracks/:uuid/lyrics-url` 签名 URL；每次播放与下载即时获取，不写入持久媒体缓存（`PlaybackMediaCache`），确保服务端禁用后立即不可播。
- 禁用歌曲（`playable: false`）允许搜索、收藏、加入歌单、分享与查看详情，但双击、播放按钮、下一首、加入队列与下载均被禁用并提示“已禁用/不可播”；批量“播放全部”与“添加到播放列表”自动过滤禁用项并提示跳过数量。
- 一起听当前不支持 `cloud` 音源，统一播放命令层与房间动作拦截并提示“云盘歌曲暂不支持一起听”。

## 开发环境与打包环境数据隔离补充

- 未打包的开发模式（`pnpm dev`，`!app.isPackaged`）由 `electron/core/appPaths.ts` 在主进程启动最早期自动将 `userData` 路径重定向至 `${appData}/PisaMusic-Dev`，并将 `appName` 设为 `PisaMusic-Dev`。
- 打包正式版继续使用默认 `%APPDATA%/PisaMusic`（或 macOS/Linux 对应路径）。
- 隔离内容包括：SQLite 数据库（`pisamusic.db`、`media-cache-index.db`）、KG/WY 登录 Cookie 文件（`kugou_cookie_user.json`、`wy_cookie_user.json`）、Token Session、本地歌单与日志；确保开发调试不会影响或覆盖打包软件中的登录态。

## 听歌时长与等级规则补充

- 桌面端听歌时长统计与等级遵循外层 `server` 不可变播放片段协议（`/api/listening/fragments/batch`、`/api/listening/summary`），通信走 main 侧 `electron/listening/listeningClient.ts` 和系统加密信封。
- 请求固定参数：`schemaVersion: 1`，`platform: "desktop"`，Header 携带持久化稳定 `x-pm-device-id`（SQLite settings 的 `desktop-device-client-id`）。
- 允许统计音源限定为 `kg`、`wy`、`kw`、`cloud`、`local`（`qq` 源忽略不上报）；本地歌曲（`local`）的 `songId` 仅使用规范化标识，严格禁止泄漏 `file:`、`content:`、`/` 或 `\` 等任何本地路径。
- 状态机机制：真实播放片段基于 `performance.now()` 精确计时，本地每 60 秒检查点暂存到 SQLite `listening_active_checkpoint`，单段超 15 分钟自动切片；时长 >= 1000ms 的片段写入 SQLite `listening_pending_fragments`；每 15 分钟或每次启动/登录 session ready 时触发最多 200 条批量补传，支持断网重试与崩溃恢复。
- 用户界面：用户头像下拉菜单前两项展示只读“等级：Lv N”与“累计听歌：n分钟”（按 `floor(totalMs / 60000)` 计算），在菜单展开与账号切换时即时刷新，账号未登录时保持重置。

## 专属消息规则补充

- 专属消息只允许通过 main 侧 `electron/directMessage/` 的 Client / Manager 访问 `/api/messages/unread` 与 `/api/messages/:id/read`；renderer 只能调用 typed `direct-message:*` preload IPC，不得接触 server baseURL、User Token、设备消息 token 或 AES 加密细节。
- `systemClient` 上报桌面设备后保存 30 天 `messageToken`，仅在专属消息请求中作为 `x-pm-device-token` 使用；设备 UUID 不能作为凭证，token 不得记录日志或暴露给 renderer。
- `DirectMessageManager` 仅在当前 App 进程维护 dismissed 消息集合。点击“我知道了”先由 renderer 立即推进队列，再 fire-and-forget IPC 回执；失败重试不能阻塞交互，服务端仍未读的消息下次启动必须再次可见。
- `AppDirectMessagePopup` 在启动及账号会话变化后读取队列，首条展示开始共享一个 3 秒 `performance.now()` 截止时间，后续消息不再等待。专属消息优先于系统公告，公告应等待 direct-message 弹窗流程 settled 后才可出现，避免 modal 重叠。
