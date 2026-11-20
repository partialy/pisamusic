# AGENTS.md

## 规范导航与服务发现文档维护

- 前端改动运行对应构建；视觉或交互改动检查 Electron 窗口。纯文档调整只检查链接、内容与差异。
- 本文件只维护 PC 桌面端实现规则；手机、Admin、Server 规范见[根模块索引](../AGENTS.md)。
- 修改跨端接口、账号、同步、分享、一起听、发布等公共行为时，按需阅读[跨模块契约](../agents/CROSS_MODULE.md)对应章节；后端修改另读 [Server 入口](../server/AGENTS.md)。
- 本文件中的 `yixi/`、`server/` 等源码路径以及 `pnpm --dir yixi ...` 命令均相对仓库根目录；主题详细规范见 [THEME.md](THEME.md)。
- 正式包先读取第 0 层服务发现文件 `https://pisamusic.partialy.cn/pm-config/config-v1.json`；维护该 JSON 时先修改地址，再递增 `configVersion`，最后更新 `publishedAt`，`configVersion` 只能单调递增，不能通过恢复旧数字回滚。
- 发现文档的 `serviceOrigins` 按 `priority` 从小到大选择，客户端按 `environment/development → remote → cache → embedded` 解析；缓存只存 main-only SQLite `service_discovery_cache` 表，不得放入 renderer 可通过 settings IPC 访问的通用 key，更低版本远程文档不得覆盖缓存或内存快照。
- `serviceOrigins[].apiBaseUrl`、`realtimeBaseUrl` 和开发环境变量覆盖必须是纯 origin：仅 HTTPS（开发 localhost 可用 HTTP），且不得包含认证信息、路径、query 或 hash；自动更新 feed 允许路径，但仍只允许不含认证信息、query、hash 的 HTTPS URL，后台保存时执行同样校验。
- 远程发现或业务 API 故障进入本地模式时，自动更新仍可使用发现快照中的更新 feed；`minimumSupportedVersion` 目前仅是发现元数据，不强制升级。

## 播放界面控制面板显隐规则补充

- 播放界面控制面板的鼠标位置与空闲判断由 main 侧 `PlayerControlsActivityTracker` 统一负责。
- main 使用 `screen.getCursorScreenPoint()` 与主窗口 `getBounds()` 按 100ms 采样；移出窗口隐藏，窗口内 3000ms 无移动隐藏，重新移动显示。
- renderer 只订阅 `player-controls:visibility`，不得恢复 `document.mousemove` / `clientX` / `clientY` 的并行计时器。
- 顶部 `-webkit-app-region: drag` 会屏蔽 pointer 事件，不能再把 renderer DOM 鼠标事件作为唯一活动来源。

## 主题架构与语义化 Token 规则补充

- 主题体系统一遵循“两个大类（背景模式）”与各自亮暗子类（共四个子类）：
  - 纯色大类（`data-bg-mode="color"`）：浅色子类（`color-light`，`data-theme="light"`）、深色子类（`color-dark`，`data-theme="dark"`）。
  - 图片大类（`data-bg-mode="image"`）：亮色图片子类（`image-light`，`data-image-tone="light"`）与暗色图片子类（`image-dark`，`data-image-tone="dark"`），两套中性通透毛玻璃风格，不使用壁纸主色混洗污染面板底色。
  - 状态轴正交分离：`data-theme` 纯粹承载用户设置的主题偏好（`light`/`dark`），图片样式选择完全由 `data-image-tone` 驱动，互不覆盖。
- 组件样式禁止使用 `.is-image-mode` 类或 `[data-bg-mode]` 选择器分支；组件样式一律仅依赖语义化 CSS 变量（`--surface-*`, `--border-*`, `--text-*`, `--shadow-*`, `--glass-*`, `--app-bg-*`）。
- 壁纸主色（accent）只用于文字高亮（`--text-accent`）、选中指示条与当前播放动画等点睛交互，严禁用于面板或行大面积底色。
- 主题详细契约、Token 规范与架构测试见 `yixi/THEME.md`。静态架构守护测试通过 `pnpm --dir yixi test:theme` 执行。


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
- 本地歌曲（`source: "local"`）不支持一起听；云盘歌曲（`source: "cloud"`）以共享 UUID 参与房间与权威队列，`urlParam=id`，各设备经现有 main 云盘接口独立获取播放签名 URL，禁用歌曲（`playable=false`）不可加入。协议歌曲不携带 `filePath` 与真实播放 URL（`url` 发空串），远端播放时取链接口再次判断 active 状态。播放器 localStorage 兼容快照与 SQLite 队列统一使用持久化歌曲 DTO，禁止把运行中的签名播放 URL 写入快照。
- 一起听成员头像由 main 侧 `electron/listenTogether/listenTogetherAvatar.ts` 统一把服务端相对地址转为绝对地址，空值使用服务端默认账号头像；renderer 只展示图片并使用本地默认头像作为加载失败兜底，不要回退成姓名文字。
- 所有新增播放入口（按钮、托盘、快捷键、MediaSession、歌词点击、右键菜单、列表/队列操作、自动续播与失败跳过）必须经过 `src/listenTogether/playbackCommands.ts` 统一命令层，禁止直接调用 `useAudioStore` 的 play/next/prev/seek/switchPlayList/setPlaylist/nextPlay/removeFromPlaylist/reset；一起听权限守卫在命令层与 store，不允许只靠 disabled UI。
- 首页歌曲网格和“查看更多”歌曲页的右键、更多按钮统一复用 `src/components/common/ContextMenu.vue`；菜单至少包含播放、下一曲播放、分享、收藏、添加到歌单、添加到播放队列和详情，详情统一调用 `share/mediaDetailRoute.ts` 打开全局 `MediaDetailDialog`，不得在列表组件复制一套操作逻辑。
- 一起听 Socket 命令可能包含 Pinia/Vue 响应式队列项，调用 preload API 前必须经过 `src/listenTogether/listenTogetherIpcPayload.ts` 转为纯 JSON DTO；不能只依赖 preload 内克隆，因为 `contextBridge` 会在进入 preload 函数前先克隆参数。
- 一起听中“仅添加到队列/下一首播放/清空队列/整列表播放”因 PM 协议无对应命令而禁用或降级为单曲点播，不要自创 PM 不认识的队列命令。
- 验证命令：`pnpm --dir yixi test:listen-together`（纯规则单测）与 `pnpm --dir yixi build:t`；涉及协议字段或队列行为改动时，必须与 PM 真机做跨端联调（双向房主/成员、重复歌曲 queueItemId、快速连续切歌、30 秒断线重连、权限关闭旁路审计）。

## 关于页、协议与反馈规则补充

- `src/components/setting/about/AboutSetting.vue` 负责桌面端关于内容，并嵌入设置页“关于”Tab；设置页 Tab 由 `/setting?tab=<name>` 驱动，右上角“设置 → 关于”和旧 `/about` 地址必须统一进入 `/setting?tab=about`，不得恢复独立关于页。当前版本通过 main 侧 `system:get-app-version` 读取 Electron `app.getVersion()`，服务端关于信息通过 `system:get-about-info` 请求 `/api/config/about`；renderer 不直接拼接或请求 server 地址。
- 开发环境的“模拟检查更新”走 `updater:simulate-check`，只用于未打包运行时触发有更新提示，不影响正式 `electron-updater` 下载和安装流程。
- 用户协议、隐私政策和意见反馈入口固定放在关于页内；协议/隐私通过 main 侧 system IPC 拉取 `/api/config/service-agreement`、`/api/config/privacy-policy` 后以纯文本（保留换行）在弹窗展示，反馈表单通过 `system:submit-feedback` 提交 `/api/feedback`。
- 反馈图片由 renderer 读取为可序列化二进制后交给 main 侧组装 `FormData`，最多 3 张，格式限定 JPEG/PNG/WebP，单张不超过 5MB；不要让 renderer 直接持有反馈接口 URL。

## 歌曲/歌单详情与分享规则补充

- App 推广与歌曲/歌单分享独立：Header 设置菜单和关于页通过 `useAppShareDialog` 共用 Header 持有的 `common/AppShareDialog.vue` / `AppModal`。二维码和复制文案只用 Server 最终返回值，不在 renderer 构造统计身份或分享链接。
- `system:get-app-share` typed IPC 经 main `system/appShareService.ts` 请求原 `/api/config/app-share`；设备消息 Token 与 JWT 留在 main。首次缺设备 Token 先重上报；401 最多一次设备重上报及已登录会话刷新后重试，始终携带捕获身份，失败不得去凭据降游客。账号刷新发布新身份世代后，旧弹窗结果作废，用户重新获取。
- 推广缓存仅 main 内存、按长期设备 ID + 账号 ID/guest 隔离，不存任何凭据；响应须校验设备和账号 revision，同键迟到请求不能覆盖更新缓存。每次打开/重新获取都联网校验；失败仅可展示当前同身份缓存并明确未校验，禁止复制且不展示可扫描二维码。未启用 tracking（含旧 Server）明确提示，不能当作 guest 授权或专属分享成功。
- 弹窗关闭、销毁、身份变化都会递增 renderer 请求代次并清空旧内容；身份变化后需重新获取，复制前再查 main 权威 revision。离线缓存随进程退出释放；本功能未新增持久化表或通用设置键。

- Header 设置菜单的“链接导入歌单”复用 `playList/PlaylistLinkImportDialog.vue`；`utils/playlistShareLinkParser.ts` 只解析 KG/WY 公开白名单 URL，不解析短链、不请求网页、不以酷狗 `src_cid` 替代分享副本。导入只打开在线详情，不自动创建自建歌单。
- 在线详情的“转为本地歌单”使用 `playlist/onlinePlaylistBatchLoader.ts` 固定页大小读取全集，核对身份、原始数量、首尾版本与可用曲目 ID，再调用 `onlinePlaylistConversion.ts` 单次组合事务。加载可取消、保存不可中断；每次转换产生新 UUID，携带加载开始的账号世代，禁止晚响应保存到新账号。歌曲去重，明确空歌单可保存，部分加载不能转存；转换只保存曲目信息。

- 桌面端歌曲/歌单详情统一使用 `common/MediaDetailDialog.vue` / `AppModal`，由 `MainLayout` 常驻挂载；`share/mediaDetailRoute.ts` 在 renderer 内存传递详情对象，不把本地路径与大对象写进路由。分享邀请只传 UUID，再由 main 读取公开分享接口。旧 `/media/detail` 仅消费历史 query 后回到来源页或首页，不再提供独立详情页面。
- 分享创建和公开读取只走 main/preload 暴露的 `share:*` IPC：`electron/system/systemClient.ts` 访问外层 `server` 的 `/api/shares` 和 `/api/shares/public/:uuid`，renderer 不直接拼接 server 地址、账号 token 或加密请求。
- 分享链接继续复用官网扫码入口 `https://pisamusic.partialy.cn/scan?type=music-share&uuid=<uuid>` 与 `pisamusic://scan?type=music-share&uuid=<uuid>`；解析规则集中在 `src/share/shareLink.ts`，不要新增 `pisamusic://share` 或顶层 `/share`。
- 分享 payload 必须通过 `src/share/shareModels.ts` 白名单裁剪；不得包含本地 `filePath`、播放 URL、歌词正文、内嵌封面二进制或 renderer 响应式对象。
- 详情弹窗的分享态不展示或强调音源：歌曲展示歌手、歌名、专辑、时长和访问次数；歌单展示描述、分享人和访问次数。本地 payload 详情仍可保留来源及本地统计信息。
- 详情弹窗同时承载本地歌曲/歌单与接收分享，保留播放、收藏、下载和分享操作；请求结果按打开代次隔离，关闭后不接受迟到响应。本地元信息可点击复制。歌单详情（含在线与自建）头部统一使用胶囊分段按钮组，默认显示文字：播放全部（主色背景）、多选（整组胶囊平滑变形为批量操作栏）、更多（下拉菜单统一容纳收藏/取消收藏、转换/编辑/删除、详情、分享，菜单项左侧配对应图标，收藏状态统一使用红心/灰心 `CollectIcon`）。
- 歌单歌曲分页拉取统一使用 `src/utils/playlistTracks.ts` 的 `resolveDynamicBatchSize(totalCount)` 动态计算单批大小（平摊约 3 批并限制在 `[50, 200]` 区间：`total <= 150` 取 50，`301` 取 101，`>= 600` 取 200）。歌单详情首屏以计算出的 `batchSize` 直接拉取第 1 页，无重复数据；流式后台加载与全量拉取全过程必须保持同一恒定 `pageSize`，尾页不缩小，规避酷狗服务端分页偏移错位。
- Electron 外部扫码动作由 main 侧协调器缓冲冷启动/二次启动参数：一起听继续投递 `listen-together:invite`，音乐分享投递 `share:invite`，renderer 只消费只读事件并打开详情弹窗。

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
- 文件操作统一由 `electron/download/downloadFileService.ts` 按可信 `fileId/taskId`（本地扫描按 main 索引 `localId`）执行；旧 renderer 路径只作索引查找提示，未知路径拒绝。下载删除先冻结 main 预览，默认只移除记录，实体删除必须 `deleteFiles=true` 且二次 `confirmed=true`；清除全部读取 main 全集合，processing 不可中断，未终结任务需先取消。成功同事务删除对应 legacy 原行，避免旧 read model 复活；不删除 LOCAL 稳定同步 UUID 映射。
- 真实删除/修复复用 canonical path + dev/ino 锁、逐段 symlink/junction 拒绝及最终身份核验；其他文件/扫描实体、未完成候选、播放或暂停引用保护物理文件。实体删除共享/占用/失败时保留可重试记录；只移除记录可保留物理文件。仅准确记录、同目录同 basename 且无其他引用的 lrc/krc/yrc 可清理；未知候选/目录/缓存不扫描、不清除。
- LOCAL 取链在 main 可信解析后预留共享锁，瞬时 file URL 携带 main 随机 token；renderer commit 后再加载、卸载旧播放器后发布当前曲目完成锁交接。准备取消/失败按 token 释放，未提交预留 60 秒过期；暂停不释放。token 不写持久化歌曲 DTO，renderer 任意路径不能生成播放引用。
- `downloadRepairService.ts` 采用入队开关快照补缺，现存有效标签/图片/歌词不覆盖；复用歌词解析与 1024 封面候选。同目录排它副本写后验证可读性与已有字段、硬链接备份后原子替换，DB 同事务更新真实大小/时长/候选 identity。失败恢复原音频；无法安全回滚时保留备份路径与错误，不覆盖外部新文件。修复不触发重新下载或修改公共设置。
- 删除预览只向 renderer 返回 ID，main 私下冻结每个音频的 canonical path、identity、size、缺失/不可核验状态；实体删除在同一锁内比对，缺失后出现或同大小替换也拒绝。legacy 首次查看文件详情建立候选身份基线，无基线不接受直接修复；修复同时核验原生标签逐项多重计数，未映射的 FLAC 私有多值被折叠也拒绝副本。
- `retryDownload` 对 cancelled 明确生成新 UUID 任务并保留原取消终态，原配置不变、零字节重新授权入队，同源同质活跃任务仍复用；普通 resume 不恢复 cancelled。暂停任务可通过 `selectDownloadTaskDirectory(taskId)` 系统选择器重选目录，取消返回 null；选定后只重置传输与路径检查点，保留配置、旧候选归档，仍暂停待手动继续，不接受 renderer 提交目录路径。

## 播放音质与下载规则补充

- 播放/下载音质偏好统一写入 SQLite settings 的 `playback-quality-preference`，按来源保存 `kg:*`、`wy-br:*`、`wy-level:*`、`kw:*` 这类 qualityKey；不要再新增 localStorage 音质记忆。
- 音质权益只认 PisaMusic 系统账号（`vip` 且 `vipExpiresAt > Date.now()` 为有效 VIP），与 KG/WY 第三方登录 Cookie 完全分离；KW 保持全量开放不受系统账号影响。
- KG/WY 音质始终展示完整目录，并按可用项在前、不可用项在后稳定排序。三档权限矩阵：未登录（游客）WY 仅 128k/标准可用、KG 仅 128 可用，其余禁用并标记“需登录”；普通登录账号 WY 开放原 4 档、KG 开放原 3 档，其余禁用并标记“解锁”；有效 VIP 开放全部 12 / 6 档。普通账号点击“解锁”必须进入 `/setting?tab=about` 的意见反馈弹窗，预选“账号相关”并提示用户提交需求等待审核。
- PisaMusic VIP 只允许在桌面端 Header 昵称尾部显示金色斜体方块 `V`，并在 `/user/profile` 为有效 VIP 显示“特权到期时间”；不得扩展为等级名称、会员中心或其他 VIP 标识。有效性统一实时判断 `vip === true && vipExpiresAt > Date.now()`。
- renderer 与 main 统一共用 `src/musicQuality/musicQualityPolicy.ts` 纯策略模块；main 侧取链、媒体缓存建 key（`source + songId + qualityKey`）与下载任务落库前必须由 `electron/music/qualityAccess.ts` 强制归一化，防止 IPC 或旧参数越权。
- `music:resolve-playable-url` 支持 `qualityKey`；KG/WY 播放取链统一使用对应 proxy 地址且不注入 Cookie（无论是否登录第三方账号）；renderer 不直接持有 service URL 或 Cookie。
- 下载能力集中在 `electron/download/` 和 `download:*` IPC，renderer 只能传规范化歌曲、qualityKey 和下载目录；不要在页面组件里直接写文件或嵌入音频标签。
- 下载任务由 main `electron/download/downloadService.ts` 和 AppDatabase 私有下载仓库持久化管理，单曲 `download:start` 也包装同一批量 `download:enqueue`；renderer 不另建执行器。FIFO 默认并发 2，`local-setting.downloadConcurrency` 支持 1–5；新任务锁定目录、命名及标签/封面/内嵌和外置歌词配置。
- 入队前由 `enqueueBatch` 先做本地查重与权限过滤，再对实际新增曲目调用 `electron/system/songDownloadQuotaClient.ts` 请求加密 `POST /api/song-downloads/acquire` 校验并扣减配额；联网失败或配额不足时阻断落库，由 `DownloadSongDialog.vue` / `BatchDownloadDialog.vue` 挂载 `DownloadQuotaExceededModal.vue`（基于 `AppModal.vue`）展示剩余配额。
- schema 10 新建 `download_tasks`（UUID 任务/完整检查点）与 `download_files`（独立 fileId 文件实体），保留 `download_records`，只按现存 legacy id 幂等导入；旧单键已覆盖的历史不扫描或臆造。启动不联网，未完成任务统一暂停；迁移记录的缺失文件保留失败原因，不改旧表或用户音频。
- `download:enqueue` 支持可选 main 权威 `identityRevision` 检查；`tasks/files/detail/pause/resume/pause-all/resume-all/cancel/retry` 通过 typed preload。暂停等待句柄关闭和实际字节检查点；PROCESSING 不接受暂停/取消；有限网络重试最多 2 次，迟到回调按 generation 丢弃。
- `downloadTransfer.ts` 的受管 `downloads/tasks/<taskId>.part` 与播放 mediaCache 完全分离；不持久播放 URL，每次恢复重新授权取链。仅实际 part 长度、严格 206/Content-Range/总长及强 ETag 或 Last-Modified 一致才追加；200/416/缺失或变化校验器从零重取。未知总长、错误内容、空文件或不可读音频不能完成。
- 完整音频排它复制后才后处理，所有音频/歌词/sidecar 不覆盖既有文件；candidate file identity 和资产 journal 记录恢复证据，未知同名文件保留并另取名字。既有下载歌词解析、元数据写入及高清封面降档由 `downloadAssets.ts` 复用。新文件实体纳入下载歌曲读取，旧 records 仅作兼容 read model，新增文件操作应使用 fileId。
- `downloadFileLocks.ts` 按 canonical realpath 与 dev/ino 提供 shared/exclusive lease，拒绝路径中的 symlink/junction；下载、修复、统一删除和 main 播放预留共用该锁。旧本地路径删除入口已改为可信索引查找，暂停播放仍保留引用；具体文件行为仍待用户运行验收。
- `before-quit` 先禁止入队、暂停网络、等待句柄/检查点和后处理，正常完成后才关闭数据库；重复退出有保护，30 秒异常超时直接结束进程且不提前显式关闭 DB，下次启动保守恢复。
- 原“本地与下载”已并入 `我的` 页（`/local-download` 重定向至 `/mine?tab=local`），拆分为 `本地歌曲`（`MineLocalSongsPanel.vue`）与 `下载`（`MineDownloadPanel.vue`，内含已下载歌曲、正在下载、下载记录三个二级切换）；`DownloadTaskList.vue` 采用紧凑双行 + 40px 封面 + 整行进度底色，行尾仅保留极简控制图标（进行中：暂停/继续 + 取消；终态可播：播放 + 更多），其余操作（修复信息、详情、定位文件、换目录、重试、删除等）收进右键/更多菜单，多选栏支持批量修复信息。本地歌曲合并扫描曲库与已下载歌曲，下载歌曲读取 `download_files` 完成实体及未映射的旧 `download_records` 兼容记录，不重复计数。
- 下载歌曲优先用 `@yortyrh/tagpilot-lib` 写入标题、歌手、专辑、封面等音频标签；外置歌词按下载模式保存真实 `.krc/.yrc/.lrc`，内嵌歌词使用标准 LRC，标签写入失败保留缓存资产并在文件实体标记 `sidecar`。

## 登录 Cookie 模块规则补充

- KG / WY 登录 Cookie 能力统一放在 `electron/cookie/` 与 `electron/ipc/cookieIpc.ts`，IPC 前缀使用 `cookie:*`；不要把登录 Cookie 逻辑写回 `music:*`、`proxyAPI` 或页面组件。
- Cookie 持久化使用 `app.getPath("userData")/data` 下的 JSON 文件：`kugou_cookie_user.json`、`wy_cookie_user.json`，结构为 `{ "cookies": [{ "name", "value", "path", "expires" }] }`。
- WY Cookie JSON 只允许保存 `MUSIC_U`；登录窗口、接口响应或旧文件里出现的其它网易 Cookie 都要在 main 侧过滤掉。
- Cookie 存储采用内存优先：首次访问从 JSON 文件加载到 main 进程 Map，后续请求读取内存；只有登录、退出、Cookie 更新、过期/非法项清理时写盘。
- KG Cookie 刷新由 main 侧 `refreshKgCookieIfNeeded()` 统一处理，刷新时间戳写入 SQLite settings 的 `cookie-kg-refresh-state`；12 小时内不要重复请求 `/login/token`，启动时可静默检查一次。
- renderer 只能通过 preload 暴露的 typed API 和 `src/utils/api/cookieMusicAPI.ts` 访问登录、Cookie、账号资料与用户歌单；不要再用 localStorage 保存 KG/WY 登录态。
- 需要 Cookie 的 KG/WY 请求直接访问 runtime endpoints 中的 `kgServer` / `wyServer`，并在 main 端通过 `requestSignedGatewayWithCookie()` 追加 Cookie 与签名；不要走 `proxy-service`。
- 侧边栏 KG / WY 入口是登录态动态菜单：renderer 统一通过 `src/composables/useCookieAccountStatus.ts` 读取账号资料并共享状态；只有对应 Cookie 账号已登录时才显示 `/kg`、`/wy` 入口。
- `我的` 页使用类似收藏页的标题 + tab 结构，顶层 tab 固定为 `本地歌曲`（默认）、`歌单`、`下载`、`云盘`（仅 WY 已登录时显示）、`账号`（支持 `/mine?tab=<key>` 同步）；`MineCloudPanel.vue` 仅保留已适配的 WY 云盘歌曲列表与刷新；`MinePlaylistPanel.vue` 复用 `PlaylistCollect`（`KGRecommendPlaylist` 在 `source === "local"` 时左下角显示 `n首`，自建歌单编辑/删除通过右键菜单及歌单详情更多菜单处理）。设置页不再展示账号设置 tab，只保留应用配置与调试能力。
- WY 云盘歌曲通过 `cookie:wy-cloud-songs` IPC 调用 `/user/cloud`，renderer 转成 `Song[]` 后复用 `SongList`；云盘歌曲本身不带播放 URL，播放时仍交给现有 WY 取链逻辑处理。

## Electron IPC 与桌面歌词规则补充

- main 侧 IPC 必须按职责模块化注册：窗口控制放在 `electron/ipc/windowIpc.ts`，日志放在 `electron/ipc/logIpc.ts`，音乐、持久化、system 继续使用各自 `ipc/*` 模块，不要再把新 IPC 堆回 `electron/main.ts`。
- preload 只暴露最小 typed API，不要恢复旧的 `store-get/store-set`、`get-request-url`、`open-kg-window`、cookie 读取等兼容入口；登录 Cookie 后续需要重新设计专用能力。
- 桌面歌词统一由 `electron/desktopLyric/desktopLyricManager.ts` 管理，窗口必须是透明、置顶、`skipTaskbar: true` 的悬浮层；打开窗口时必须推送最近歌词快照，不能依赖切歌后才刷新。
- 桌面歌词支持 `default`（现有 `web/desktopLyric/LyricCanvasRenderer.ts`）及 `web/desktopLyric/styles/` 下 7 个独立 Canvas 特效样式（`typewriter`、`ink`、`bounce`、`spotlight`、`neon`、`ocean`、`particle`）。设置页 `DesktopLyricSettings.vue` 按样式将专属参数收纳在手风琴内，窗口尺寸/锁定/覆盖任务栏/通用字体/自动描边与渲染帧率放于通用设置；切换 `style` 时若桌面歌词窗口已开启，由 `DesktopLyricManager` 自动重载窗口再下发完整快照。
- 桌面歌词状态用快照同步，包含当前歌曲、歌词、播放进度、播放状态、样式、锁定与低能耗状态；renderer 更新歌词时即使窗口未打开，也要把最新歌词送到 main 缓存。歌词跟随切歌拉取与进度同步通过 `src/desktopLyric/lyricPlaybackBridge.ts` 挂载于 `App.vue` 根级，不得放回 `PlayerBar.vue`，确保低能耗模式卸载主 UI 后切歌仍能正常更新桌面歌词。
- 桌面歌词渲染通过 `web/desktopLyric/frameScheduler.ts` 默认限制上限为 60FPS（通用设置支持切换 `30/60/90/120/0 无限制`）；`LyricCanvasRenderer` 在无歌词或前奏/句间静态留白期间自动停掉 `requestAnimationFrame` 并按需唤醒；低能耗模式下禁用桌面歌词控制条 `backdrop-filter`，并在悬浮栏提供返回主界面按钮。
- 低能耗模式由 main 侧 `electron/power/lowPowerManager.ts` + `electron/ipc/lowPowerIpc.ts` 统一管理，“自动低能耗”设置（`autoLowPowerOnMinimize`）写入 SQLite settings 的 `power-setting`。开启自动低能耗后，主窗口最小化或关闭到托盘 10 分钟无恢复则自动进入；托盘支持手动切换进入（隐藏窗口到托盘）/ 退出。进入低能耗不主动开关桌面歌词，保持进入前状态并支持托盘随时控制；`App.vue` 卸载背景层、路由视图、`PlayerBar`、`MainPlayer` 与弹窗宿主，同时暂停播放/空窗时清理 `audio.ts` 定时器（低能耗降频为 2500ms）、按需跳过非均衡器音频分析接入，并挂起 `PlayerControlsActivityTracker` 的 100ms 光标轮询。验证命令：`pnpm --dir yixi test:desktop-lyric`、`pnpm --dir yixi test:player-controls`、`pnpm --dir yixi test:power`。
- 桌面歌词样式和锁定状态持久化统一使用 SQLite settings 的 `desktop-lyric-setting`；设置页、托盘和歌词窗口必须通过同一份 main 快照同步，不要新增独立 localStorage 或 electron-store 设置来源。
- renderer 捕获请求、收藏、播放、歌词等错误时，UI 只显示简洁提示，同时必须通过 `reportError()` / `electronAPI.reportError()` 写入 main 日志，便于查询堆栈和上下文。

## 收藏与侧栏规则补充

- 收藏歌曲、收藏歌单统一写入 SQLite schema 9 的账号关系 `account_library_items`，renderer 通过 `library:favorites:*` IPC 和 `useCollectStore` 访问，不再新增文件式 `collect/*.json` 收藏持久化。
- 旧收藏 IPC（如 `collect-song`、`collected-songs`、`collect-list`）和旧 `/mine/collect*` 收藏页已经移除，不要恢复或新增兼容调用。
- 收藏键使用 `source:id`，组件判断收藏状态必须调用 `containsSong(song)` / `containsPlaylist(playlist)`，不要直接用裸 `id` 查询 `songMap` 或 `playlistMap`。
- 歌曲收藏只能传递规范化后的 `Song` 纯 DTO；进入 IPC / SQLite 前必须经过 `normalizeSong()`，避免 Vue Proxy、嵌套响应式对象或运行时 `url` 字段进入收藏持久化。
- 歌单收藏只能传递规范化后的 `CommonPlaylist` 纯 DTO；进入 IPC / SQLite 前必须经过 `normalizePlaylist()`，禁止把 Vue Proxy、原始接口对象、函数字段或裸 `id` 直接传入收藏链路。
- 左侧菜单保持扁平结构：推荐、歌单、收藏、云盘、我的、设置；不要恢复旧的自建歌单/收藏歌单侧栏区、独立的“本地与下载”侧栏入口或 Netease 分组入口。

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
- “彩色进度条”开关与三色流光色值写入 `app-theme.colorfulProgressBar`（默认关闭）与 `app-theme.colorfulProgressColors`（默认 `["#20b46b", "#38bdf8", "#a78bfa"]`），由 `applyThemeRuntime.ts` 同步到 `--progress-colorful-1..3`，开启后底栏 `PlayerBar.vue` 已走过进度条启用无缝三色流光与前沿高光锋。
- “启动动画”样式同样写入 `app-theme.startupAnimation`（默认 `default`，可选 `aurora-sweep`、`vinyl-wave`、`fluid-aurora`、`star-orbit`、`ripple-field`、`aurora-horizon`）。设置页手风琴预览（`StartupAnimationPreview.vue`）与独立启动窗口（`web/startup-window.html` / `web/startup-window.ts`）共用 `src/startup/startupAnimations.css`、`src/startup/startupAnimationOptions.ts` 与 `src/startup/startupAnimationTemplates.ts`，由 main `StartupWindowManager` 读取后在首帧下发渲染。
- “本地设置”统一通过 `src/store/settingStore.ts` 管理，并写入 SQLite settings 的 `local-setting`；当前字段包含本地扫描目录、缓存目录、缓存大小上限、下载目录和歌曲命名方式。
- 窗口关闭行为（“每次询问 / 隐藏到托盘 / 关闭App”，`ask` / `tray` / `quit`）同样通过 `src/store/settingStore.ts` 写入 SQLite settings 的 `basic-setting.closeAppAction`（首次初始化兼容迁移旧 `localStorage("closeType")`），由 `BasicSetting.vue` 与 `ElectronOperation.vue` 双向同步，不要再直接写入 `localStorage`。
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

- 本地与下载能力已合并至 `src/views/mine/index.vue`（`/local-download` 重定向至 `/mine?tab=local`），由 `src/composables/useLocalDownloadLibrary.ts` 管理共享状态、`MineLocalSongsPanel.vue` 承载本地曲库、`MineDownloadPanel.vue` 承载已下载歌曲/正在下载/下载记录三个子切换；下载通过 main 侧真实落盘与 `download_files` / `download_records` 展示，仅支持 KG/WY/KW，不扩展云盘下载。
- 本地扫描目录统一存入 SQLite settings 的 `local-setting.scanDirectories`，最多 10 个；旧 `scanDirectory` 读取时只能作为兼容迁移来源，不要继续写入旧字段。
- 本地曲库扫描只允许在 main 侧实现，入口集中在 `electron/localLibrary/localLibraryService.ts` 和 `library:local:*` IPC；renderer 不直接访问文件系统或 SQLite。
- 本地歌曲写入 SQLite `local_songs`，扫描指纹写入 `local_library_scan_meta`；启动时智能扫描，设置变更和页面“立即刷新”强制重建。扫描失败必须保留旧库，不要先清空旧数据。
- 本地歌曲来源使用 `source: "local"`，播放时通过 `music:resolve-playable-url` 直接转换本地文件路径，不要走 KG/WY/KW 在线取链。

## 我的页、自建歌单与云盘缓存补充
- `我的` 页顶层入口顺序为 `本地歌曲`（默认）、`歌单`、`下载`、`云盘`（仅 WY 已登录时显示）、`账号`：账号卡片保留，各子模块分别拆到 `src/components/mine/MineLocalSongsPanel.vue`、`MinePlaylistPanel.vue`、`MineDownloadPanel.vue`、`MineCloudPanel.vue`、`MineAccountCards.vue` 内，不要再把大量业务逻辑堆回 `src/views/mine/index.vue`。
- 歌单右侧下拉过滤包含 `全部 / 自建 / KG / WY`，左侧为 `添加 / 刷新 / 多选` 胶囊组；云盘页已收敛为 WY 单源。
- 自建歌单使用 `source: "local"`，与 KG/WY 歌单缓存统一写入 SQLite `user_playlists`；自建歌单歌曲写入 `user_playlist_tracks`，云盘歌曲缓存写入 `user_cloud_songs`。
- `useMineLibraryStore` 负责我的页歌单与云盘缓存：启动时优先读取 SQLite，再在本次 App 生命周期内自动刷新一次网络数据；手动刷新失败时继续展示本地缓存。
- 自建歌单标签存入 `payload_json.tags`，最多 3 个，保存前需要过滤空标签并去重。
- 歌曲右键 `添加到歌单` 只允许添加到自建歌单；无自建歌单时从弹窗内引导新建，创建完成后继续执行添加。
- 自建歌单封面通过 `dialog:select-playlist-cover` 选择并缓存到 `app.getPath("userData")/data/covers/playlists`；renderer 不直接读写文件系统。
- 歌单播放全部/添加到播放列表统一走 `src/utils/playlistTracks.ts`：自建歌单从 SQLite 读取，KG/WY 从网络分页获取，QQ/KW 等未支持来源需要明确提示暂不支持。

## 启动页与首次协议规则补充

- 桌面端启动页由 `electron/startup/startupWindowManager.ts` 和 `web/startup-window.html` 管理，使用独立 Electron HTML 窗口，不要改回 Vue 页面内覆盖层。
- 首次用户协议状态统一写入 SQLite settings 的 `startup-user-agreement`，记录当前服务协议 `version`，协议版本变化时重新展示；不要使用 localStorage 或 electron-store 另存一份协议状态。启动页协议正文按纯文本保留换行。
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
- 公告确认或成功前往后，renderer 通过 `system:mark-announcement-read` 请求 main 侧异步提交加密已读回执；main 侧只使用设备上报维护的 30 天 `messageToken` 作为 `x-pm-device-token`，未登录时保持匿名，回执失败不阻塞交互。公告列表、预览和关闭弹窗不改变服务端已读状态。
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
- `sync_outbox` 是本地待推送队列，SQLite Schema v11 新增 `sync_account_state`（取代 `settings` 的 `sync-state:<accountId>`）、`sync_entity_versions`（上行 `baseVersion`）与 `sync_op_history`（本地操作日志）；退出账号仅清理内存定时器和代次（`onAccountLogout()`），保留 SQLite 按账号隔离的 `sync_account_state` 与 `sync_outbox`，避免重登误 re-seed 复活云端删除；断网后通过指数退避及 `online` / `powerMonitor.resume` 触发补传。
- 同步状态保存到 SQLite `sync_account_state`，本地待推送变更保存到 SQLite `sync_outbox`，本地操作历史记录到 `sync_op_history`；收藏歌曲、收藏歌单、自建歌单和自建歌单曲目变更后需要同事务写入 outbox 与操作日志并触发后台增量同步。
- 同步 payload 只使用 `Song` / `CommonPlaylist` canonical 字段；不推送 `source=local` 歌曲，不推送播放 URL、filePath、歌词正文、内嵌封面；自建歌单本地文件封面同步时置空。
- 远端 tombstone 应在 main 侧应用到 SQLite 后通知 renderer 刷新 `favorites:changed` / `mine-library:changed`，不要让页面组件直接写同步状态或数据库。
- `favorite_song.payload.favoritedAt` 为正毫秒时间戳；本地收藏及 seed 从 SQLite `created_at` 取值，下行存在合法时间时覆盖该字段，缺失时保留已收藏时间，新记录回退当前时间；收藏查询按 `created_at DESC, favorite_key ASC` 排序。
- 拉取使用 `protocol=2&limit=1000`。`mode=snapshot` 按 `snapshotVersion/cursor` 收齐分页，409 最多重启 3 次；只在完整快照到达后于单次 SQLite 事务内对收藏歌曲、收藏歌单、自建歌单及曲目全量对账，空快照同样具有删除权威。同设备快照仍须应用；只有 delta 可过滤本设备回声。
- 快照/增量应用前读取全部 SQLite outbox key，保留未推送本地新增、删除与元数据；未推送歌单曲目同时保护父歌单免于级联删除。快照收集中途失败或账号/token 变化时不应用旧快照；退出/清理同步状态通过 generation 防止旧请求回写。
- 增量游标只推进至实际收到的最大 `change.version`，不使用服务端全局版本或推送返回版本；旧服务端没有分页标记时拉到空页。outbox 按 200 条连续排空，推送完成后从本轮原始游标重新拉取，恢复此前因 pending 保护而跳过的远端权威数据。
- 推送任何一批返回 `skipped > 0` 时，排空后改为 `since=0` 拉完整权威快照，恢复因 LWW 过期而被拒绝、且远端胜出版本已落在起始游标之前的本地状态。
- 同步聚焦检查：`pnpm --dir yixi exec vitest run --config vitest.sync.config.ts`；main 类型检查：`pnpm --dir yixi exec tsc -p tsconfig.node.json --noEmit`。

## 共享云盘模块规则补充

- 桌面端左侧导航在“收藏”与“我的”之间固定包含“云盘”Tab，主路由为 `/cloud`，投稿占位路由为 `/cloud/submit`。
- 云盘数据通信统一走 main 侧 `electron/cloudMusic/cloudMusicClient.ts` 和 `cloud-music:*` IPC（`cloud-music:summary`、`cloud-music:search`、`cloud-music:detail`）；renderer 不直接持有服务端地址或加密请求细节。
- 搜索与分页固定每页 20 条，支持最新优先（latest-wins）与 300ms 防抖；歌曲来源为独立 `source: "cloud"`，标签显示青绿色方块 `C`（`--color-source-cloud: #10b981` / `#34d399`），音质固定为唯一默认档 `cloud:default`。
- 播放取链与歌词获取由 main 侧 `musicService.ts` 直接请求 `/api/cloud-music/tracks/:uuid/play-url` 与 `/api/cloud-music/tracks/:uuid/lyrics-url` 签名 URL；每次播放与下载即时获取，不写入持久媒体缓存（`PlaybackMediaCache`），确保服务端禁用后立即不可播。
- 禁用歌曲（`playable: false`）允许搜索、收藏、加入歌单、分享与查看详情，但双击、播放按钮、下一首、加入队列与下载均被禁用并提示“已禁用/不可播”；批量“播放全部”与“添加到播放列表”自动过滤禁用项并提示跳过数量。
- 一起听支持 `cloud` 音源，以共享 UUID 为身份，各设备独立获取签名 URL，房间不传真实播放链接；禁用云盘歌曲和 LOCAL 均由统一播放命令层及房间动作守卫拦截。本轮 PC 下载仍仅开放 KG/WY/KW，不因云盘支持一起听而扩大下载来源。

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
- `systemClient` 上报桌面设备后保存 30 天 `messageToken`，仅在专属消息和公告已读回执请求中作为 `x-pm-device-token` 使用；设备 UUID 不能作为凭证，token 不得记录日志或暴露给 renderer。
- `DirectMessageManager` 仅在当前 App 进程维护 dismissed 消息集合。点击“我知道了”先由 renderer 立即推进队列，再 fire-and-forget IPC 回执；失败重试不能阻塞交互，服务端仍未读的消息下次启动必须再次可见。
- `AppDirectMessagePopup` 在启动及账号会话变化后读取队列，首条展示开始共享一个 3 秒 `performance.now()` 截止时间，后续消息不再等待。专属消息优先于系统公告，公告应等待 direct-message 弹窗流程 settled 后才可出现，避免 modal 重叠。

## 背景模式与主题自适应规则补充

- 桌面端支持“颜色”（默认色彩/渐变）与“图片”两种背景模式，持久化于 SQLite settings 的 `app-theme`。
- 图片模式下支持 App 预置图片与本地自定义图片上传；背景模糊程度支持 0-100 调节并映射为底层高斯模糊滤镜；背景亮度支持 0-100% 调节（`themeStore.backgroundBrightness`），映射为 `--app-bg-brightness` 并作用于 `App.vue` 全屏滤镜。
- 全屏背景层统一挂载在 `App.vue` 最外层容器（`position: fixed; inset: -24px;`），使得整个视口（包含底部 80px 的播放器 PlayerBar）共享底层唯一图片；图片模式下 PlayerBar 与主要页面层级背景保持透明（`background: transparent !important; backdrop-filter: none; box-shadow: none;`），消除割裂的独立色块。
- 图片模式下文字、图标与悬浮颜色根据背景图片自动派生：通过离屏 Canvas 采样整图平均感知亮度（ITU-R BT.709 权重公式）与色彩通道，以阈值 165 区分深色与浅色背景。深色背景派生高级软白文字（`rgba(255, 255, 255, 0.90)`，避免 100% 刺眼死白）与半透明微亮光晕悬浮（`color-mix(in srgb, var(--color-primary) 12%, rgba(255, 255, 255, 0.08))`，壁纸通透呈现，杜绝死板黑块）；浅色背景派生柔和深炭文字（`rgba(28, 33, 44, 0.88)`，避免生硬死黑）与半透明柔和微暗悬浮（`color-mix(in srgb, var(--color-primary) 10%, rgba(0, 0, 0, 0.05))`，避免死白与黑斑）。全部悬浮配合 0.18s 平滑渐变过渡。

## 图片库规则补充

- 图片管理器（`useImageManager`）提供单例状态管理，自定义图片持久化保存到 SQLite settings 的 `custom-background-images`，预置图片与自定义图片按时间倒序合并为统一图片列表。
- 自定义图片上传时由 Electron main 侧（`dialog:select-background-image`、`dialog:select-background-images`）将文件复制到应用数据目录下的 `backgrounds/` 目录并返回本地 `file:///` 绝对路径；同时自动通过 `imageManager.addImage(url, name)` / `imageManager.addImages(items)` 注册入库，支持文件选择对话框多选。
- 自定义图片删除支持多选，由 main 侧 `dialog:delete-background-image` 安全校验路径并在磁盘中物理删除（仅限 `backgrounds/` 目录内文件，防路径穿越），预置图片只读受保护不可删除。
- 图片库弹窗组件（`AppImageCenterModal.vue`）以 Modal 形式打开，复用【一起听】同款居中缩放动画（`transform-origin="center"`）、圆角实色卡片（`border-radius: var(--radius-control);`（12px）、820px × 550px 实色防透）与操作条；标题绝对居中，左上角集成“添加图片”与“删除图片（带二次确认 `AppConfirmDialog`）”圆形纯图标按钮（通过原生 `title` 提示），支持单选高亮、双击直接选中确认并返回图片地址。
- 基本设置页背景选项中，原【预置图片】行升级为【图片库】，右侧横向展示最新的 3 张图片（可直接点击切换背景），最右侧配备打开图片库图标按钮（`Images` 图标），选中确认后无缝生效为当前背景。

## 歌词背景与主播放界面设置规则补充

- 主播放界面（`MainPlayer.vue`）在右侧垂直居中位置配备毛玻璃圆形齿轮按钮（`Settings` 图标），随鼠标活动状态（`isMouseActive`）平滑淡入淡出，点击唤起紧凑型歌词设置弹窗（`LyricSettingModal.vue`）。
- `LyricSetting.vue` 按“主播放器 / 桌面歌词 / 底栏歌词”切换。主播放器设置由 `setting/lyric/MainPlayerSettings.vue` 组合歌词样式、通用文字/排版、背景；外层连续展示，`LyricSettingModal.vue` 在 720px `AppModal` 中按“歌词样式 / 通用设置 / 背景”切换，默认打开歌词样式。样式选择器下以手风琴展示当前样式专属参数。字段、文案、适用条件、字体列表、图片库、取色与控件范围只维护一份；复用 `SettingSection`、`LyricSettingRow` 与 `SettingAdjustment`，不得复制表单或保存监听。弹窗无 footer，关闭动画结束前保留内容。
- `src/utils/lyricSettings.ts` 统一 `LyricSetting`、默认值与归一规则。主播放器所有设置沿用 localStorage `pisa-lyric-setting`，通过 `lyricStore.updateSetting(patch)` 立即保存；不是 SQLite `lyric-setting`。旧字段按默认值合并，损坏 JSON 回退默认并报告错误；主播放器设置与应用背景、桌面歌词持久化独立。
- `LyricSetting.style` 固定为 `default / amlyric / typewriter / ink / bounce / spotlight / neon / ocean`，分别为现有普通歌词、AMLyric、打字机逐现、水墨流光、律动弹跳、聚光灯聚焦、流彩星尘霓虹、海浪翻滚；不接入桌面 `particle`。`styles` 独立保存八款参数，`updateStyleSetting` 深合并单款字段、`resetStyleSetting` 仅重置当前款；桌面和主播放器仅共用参数类型/默认值/范围与 `LyricStyleParams.vue` 表单，持久化值互不影响。旧 `useAMLyric` 和顶层颜色/AM 动效仅作为迁移输入，已有用户保留选择和参数，新用户初始选择仍为 AMLyric。
- 字号 12–60px、整体文字透明度 0.01–1、垂直位置 0–1；八款共用字体、加粗、基础阴影、透明度、水平居中及 top/center/bottom 对齐锚点，专属光晕由样式颜色参数控制。默认款独立设置普通/当前行色；AMLyric 独立设置基准色、弹簧、行放大、背景行模糊及隐藏已唱行；悬停时间适用于默认和六款新样式。切换样式保留各自偏好。
- `src/lyricStyles/` 承载播放页样式配置、可换行字形布局与六款共享纯 Canvas 绘制。桌面六款通过单行适配复用绘制，保留原相机与窗口时钟；播放页 `CommonLyric` 负责默认和六款的纵向多行列表、自动跟随、手动滚动恢复和统一跳转命令。当前句 Canvas 保留可访问文字，非激活行完整可读；长句换行保留绝对逐字时序与累计逻辑位置，扫光/打字机不因换行重置。播放页仅一个 RAF，暂停、隐藏、卸载停止；尺寸/字体变化重算布局，不改变封面和歌曲信息的整体布局。
- 关闭逐字且只有 KRC/YRC 数据时，AM 使用复制的整句歌词回退，不修改原始字级数据；逐字选择作用于主播放器与桌面；底栏默认跟随，也可独立选择优先逐字或逐行显示。
- 播放背景采用 `src/playerBackground/backgroundConfig.ts` 的 version 2 三模式配置，存于 `LyricSetting.background`；通过 `updateBackgroundSetting` 深合并当前模式参数并即时保存，各模式独立保留偏好。旧 flat `backgroundMode=image` 迁移图片与模糊/亮度，`default` 迁移 AML 动态背景并保留流速/帧率/清晰度；新安装和恢复默认选择 Canvas 封面流光。恢复默认只重置全部背景配置。
- 背景设置使用模式选择器与当前模式的单个手风琴，默认收起，图片库与图片选择也在图片参数手风琴内。图片：模糊0–100默认0、亮度0–100默认100、遮罩0–80默认16；AML 动态：速度0–4默认2、帧率30/60/120默认60、清晰度25/50/75/100%默认75、亮度100、遮罩30；Canvas 流光参考 PM 四光场，速度0.5–2默认1，运动幅度/流光强度/亮度/饱和度0–100默认50，色彩跟随封面/柔和/鲜艳，帧率默认30、清晰度默认75%。动态模式暂停继续动画默认关闭；隐藏、最小化和销毁停帧，减少动画显示静态画面。背景取色为 Canvas 色板职责；文字设置取色仍优先已选图片、其次应用背景，不取歌曲封面。

- 歌词设置内的“底栏歌词”Tab 由 `PlayerBarLyricSettings.vue` 管理，`src/store/playerBarLyric.ts` 统一归一与即时保存到 localStorage `pisa-playerbar-lyric-setting`。可控制显示、暂停保留、歌词模式、字体、10–22px 字号、加粗、不透明度与主题/自定义文字及逐字高亮色；默认启用、暂停显示歌手、模式跟随主播放器、16px、不加粗、完全不透明、颜色跟随主题。PlayerBar 独立选择当前歌词行，逐行模式缺 LRC 时按整句显示逐字源，不更改共享歌词数据；固定 28px 单行高度与省略行为保持。关闭歌词仍显示歌手，设置不影响主播放器或桌面。

## 桌面歌词 Canvas 架构与维护规则

- 模块架构与职责分层：
  - `electron/desktopLyric/`：负责 main 进程歌词窗口生命周期管理、SQLite settings repository（`desktop-lyric-setting` version 2 为唯一权威来源）、多屏/跨屏 bounds 校验和最小 IPC。
  - `web/desktopLyric/`：负责高 DPI Canvas 纯绘制、词级正弦缩放（1 -> 1.14 -> 1）、行平滑过渡（240ms ease-out cubic）及物理时间驱动的时钟平滑（drift < 120ms 吸收，大跳转 snap）。不访问 Node/Electron API。
  - `web/lyric-window.html` / `web/lyric-window.ts` / `web/lyric-window.css`：悬浮交互窗口外壳。Canvas 仅负责渲染歌词，控制栏与调整区域为语义化 DOM 浮层，使用 pointer capture 保证拖拽与缩放不丢帧。
  - `src/desktopLyric/` 与 `src/store/desktopLyric.ts`：renderer 侧主应用通过专用 Pinia store 驱动，`desktopLyricBridge.ts` 监听播放与切歌并向 main 进程广播权威毫秒时间戳与归一化歌词。
- 配置持久化：
  - 桌面歌词配置只持久化到 SQLite `settings` 表的 `desktop-lyric-setting`，格式固定为 `DesktopLyricSettingV2`（`version: 2`）。
  - 旧 `electron-store` 仅用于冷启动一次性只读迁移，严禁回写或恢复旧 schema。
  - 设置变更通过 Pinia store 单一入口 `patchSetting` 提交；`DesktopLyricSettingPatch` 允许仅提交部分 bounds，main 按当前原生窗口补齐，禁止设置页用旧 x/y 覆盖拖拽位置。设置页使用独立编辑草稿，禁止 deep watch 反馈链；数字/颜色通过 300ms 防抖合并 patch，开关/锁定立即提交，切换分区和卸载时发送末次待保存修改。
  - main 将归一、落库后的完整配置通过 `desktop-lyric:setting-changed` 推给主应用，桌面窗口同步接收 setting。主应用 store 持有唯一配置/显隐订阅，先订阅再初始化快照，以内存代次防止迟到快照覆盖新事件，dispose 统一清理；不得用乐观配置替代 main 权威状态。
  - 桌面窗口字号按钮仅通过 `adjustFontSize(-2 | 2)` 提交增量，main 校验 sender 并从当前权威字号计算、归一和保存，然后广播两端；禁止只修改 Canvas 本地设置。字号默认 40、范围 10–64；字重默认 600、范围 100–900，与设置页一致。
- 时钟与动画规范：
  - 所有音频播放进度字段必须统一为毫秒并以 `Ms` 结尾（如 `positionMs`、`durationMs`、`receivedAtMs`），严禁使用浮点秒。
  - KRC 与 YRC 格式且带有真实字级时间跨度时才启用逐字进度与正弦缩放；普通 LRC 仅执行整行平滑变色与行过渡位移，禁止伪造逐字时间戳。
  - 逐帧渲染路径（RAF loop）内严格禁止 DOM 尺寸测量（如 `offsetWidth` / `getBoundingClientRect`）、DOM 插入/删除与 IPC 跨进程调用。
  - 窗口尺寸范围限定在 `500×100` 至 `1600×200`，字号范围限定在 `10` 至 `64`。
- 验证命令：
  - 单元测试：`pnpm --dir yixi test:desktop-lyric`（覆盖 DTO 归一化、SQLite Repository、多屏边界、时钟同步、Canvas 渲染与排版几何）。
  - 编译与全量检查：`pnpm --dir yixi build:t`。

## 封面 URL 与尺寸规则补充

- main/renderer 共用 `src/utils/songCoverUrl.ts` 纯规则；KG 持久化保留原始 `{size}` 模板，旧 KG CDN 固定尺寸路径仅在请求时兼容，不批量改写历史数据。未知域名 URL 保持原样。
- 请求尺寸统一使用实际像素：歌曲行、队列、底栏 240；卡片与弹窗 480；详情 720；大播放器和下载优先 1024。WY 通过 query `param=<size>y<size>` 设置，保留其他参数；旧 `coverSize` 仅作兼容读取，不新增协议。
- 大播放器与下载使用 1024→720→480→240 候选降档并去重；本地内嵌封面和默认资源保留原链路。下载封面有独立超时，nativeImage 解码校验后统一 PNG，封面失败不阻断音频。


## 下载设置与歌词资产规则补充

- `src/utils/downloadSettings.ts` 统一 main/renderer 下载策略。外置歌词 `downloadLyricsMode` 为 `off/word/line/all`，新用户默认关闭；旧 `saveDownloadLyricsFile=true/false` 分别迁移为逐行/关闭。保留四项 PC 命名规则与扫描、缓存、下载目录设置。
- `embedDownloadTags/embedDownloadCover/embedDownloadLyrics` 独立控制普通歌曲标签、封面和内嵌歌词，关闭即跳过该类写入，保留音频原有资产；`audioMetadataWriter.ts` 独立于普通标签开关向 MP3（ID3 `TXXX`）、FLAC（Vorbis `pm-info`）与 M4A/AAC/MP4（`----:cn.partialy.pm:pm-info`）写入与手机端对齐的 `pm-info`（`<source>:<songId>`），不再写入标准 `comment` 备注，修复时缺失歌词支持联网拉取补缺并保留既有标签与历史自定义字段。
- `electron/download/downloadLyrics.ts` 按实际语法识别 KG KRC / WY YRC / LRC，复用 `LyricParser` 转标准逐行 LRC供内嵌。外置逐字缺失回退 LRC，全部模式保存实际可用逐字版本及逐行版本，不用 `.lrc` 冒充逐字格式。
- 歌词 sidecar 使用音频最终 basename 与真实扩展名，排除已有音频/歌词命名冲突，独占创建避免覆盖；下载缓存使用 taskId 隔离并发。sidecar 失败记录可选资产警告，不影响已落盘音频成功状态。
- 多歌词路径放在下载记录 `payload.downloadLyricPaths`，兼容旧 `lyricPath`，不新增数据库列；从列表移除不删文件，安全文件服务只清理记录中与音频同目录同 basename 且未被其他音频引用的 `.lrc/.krc/.yrc`（旧 `lyricPath` 与多路径字段均参与引用保护）。任务取消、删除与修复统一遵循上文持久下载及安全文件服务规则。
- MP3 自定义 UTF-16 帧各字符串补 BOM；普通标签库重写歌词帧时，关闭歌词写入须恢复原 USLT，FLAC/M4A 同样不得删除既有歌词。

## 设置页分组与调整控件

- 设置页保留 basic/local/sync/lyric/shortcut/advance/about/announcements 八个 Tab；字段型页面使用 `src/components/setting/SettingSection.vue` 分组卡片，标题、说明与操作槽统一管理。关于、公告继续使用内容布局。
- `settingLayout.scss` 由各设置组件在 scoped 样式内引用，统一设置行、文字层级、间距与换行；本地设置分曲库、缓存、下载三组，目录与快捷键绑定保持单列。
- 基本/歌词背景模糊度与亮度共用 `SettingAdjustment.vue`：圆形加减按钮固定 28px，轨道可伸缩，百分比固定 44px；窄内容区整组换行，不压缩按钮。不在组件中添加主题模式分支。


## PC 形态与弹窗壳层

- 收藏爱心状态统一为未收藏 `--text-secondary`、已收藏 `#ff5d6c`，不能继承按钮悬停或正在播放的主题蓝色；列表、队列、推荐、底栏、大播放器和详情/右键入口遵循同一规则，收藏行为保持原逻辑。
- 顶栏搜索由 search-shell 统一承载 200→300px 宽度过渡，输入框与 `search/SearchHistoryPopover.vue` 始终同宽。历史卡片常驻以保留保存/建议逻辑，ResizeObserver 测自然高度（最高500px），展开/收起和内容变化使用300ms高度/透明度过渡，关闭时禁用点击与焦点；保留鼠标进入历史卡片的失焦保护。
- 播放队列搜索区域置于虚拟列表外部的独立收放区，用300ms高度/位移/透明度过渡向下滑出、向上收回，列表沿用ResizeObserver随剩余高度更新，不改变筛选与定位逻辑；减少动态效果时直接切换。

- 搜索历史与播放队列侧栏统一使用 `--surface-solid` 不透明表面，按亮/暗主题分别适配，不混入壁纸或品牌主色；队列文字/图标/搜索采用语义化文字色，禁止硬编码浅色文字及 light 类分支。多选本体及变形装饰层均不绘制外边框，避免出现黑色描边过渡。App 推广分享将版本置于名称下方，服务端描述与文案居中；不显示成功态“当前身份已校验”，失败/过期提示与复制权限限制保留。

- MainLayout 的 right-content 使用纵向 flex，顶栏不收缩，content 通过 flex: 1 / min-height: 0 填满余下高度，禁止继续写死扣减 80px 顶栏高度（实际由 --header-height 决定）。主内容区统一保留顶部和左右内距，底部 padding 为 0，使首页、搜索、歌单与列表滚动视口贴齐播放器上沿；播放器固定 80px 的占位保留，禁止通过让列表被播放器遮挡消除间距。歌单及推荐列表不再追加纯留白的底部 padding，加载/无更多状态、分页和滚动触底行为保留。

- 未特别说明时，操作按钮默认采用“左侧图标 + 文案”，文字按钮保持药丸形态；后续新增或修改按钮必须遵循。本轮已覆盖详情（含接收分享）、通用确认、批量操作及其涉及页面；其他历史页面不在本轮全量翻修。头像、窗口圆形图标按钮、纯图标专用控件、Tab/分段导航保留专用形态；批量操作组按下述悬停展开规则作为明确例外。

- 普通容器、菜单、输入框、普通歌曲封面使用 `--radius-control`（12px），文字操作按钮使用 `--radius-pill`（999px）。Naive UI 在 `naiveThemeAdapter.ts` 统一 common/Menu 与 Button 各尺寸；普通输入框禁止 `round` 覆盖，头像、圆形图标按钮、开关、滑块、唱片、Tab/分段导航、轨道/滚动条、微型状态/来源徽标保留专用形态。
- 一起听、下载歌曲、添加到歌单、定时关闭、均衡器复用 `src/components/common/AppModal.vue`；系统账号登录继续用动态 `$modal.create`，与声明式弹窗共用 `src/utils/appModal.ts` 的 card props/图标标题和 `src/styles/appModal.css` 壳层。不得嵌套第二层 Modal 或丢失动态实例 `destroy/onAfterLeave`（邀请登录后续接依赖）。
- 统一左图标标题、右关闭、24px 横向内距、底部右对齐药丸操作、居中缩放与 Naive 默认遮罩/焦点管理。下载和添加歌单在提交期间禁止遮罩、Esc、右上关闭及取消；业务校验、尺寸与内部表单布局继续由所属组件控制。登录表单保留密码/验证码/注册分段，品牌精简为壳层标题与同步说明。

- 通用弹窗统一复用 `common/AppModal.vue`：图标标题、12px 外壳、标准内距、底部药丸按钮与焦点/遮罩动画；业务通过默认内容、`header`、`footer` 插槽实现自定义 UI，不复制 Teleport/遮罩/关闭按钮。共享 `appModalProps.internalAppear=true`，确保 JS 动态创建且初始 show=true 的确认框同样播放首次居中缩放与遮罩淡入动画，不能只依赖后续 show 切换。可独立设置关闭按钮、遮罩与 ESC，忙碌流程用 `closeDisabled` 禁止交互关闭。
- 通用提示/确认使用 `common/AppDialog.vue`（`options` + 内容/底部插槽）；命令式 `window.$dialog` 由 `utils/appDialog.ts` 和 App 常驻 `AppDialogHost` 统一承载，支持异步操作、返回 false 保留弹窗、destroy 与 onAfterLeave。收藏/图片库旧 `AppConfirmDialog.open()` Promise API 仅作兼容适配；`DialogWrapper` 也只包装共享壳层。分享与退出确认复用同一 AppModal，后续不得新增独立确认框样式。
- 均衡器使用共享 AppModal 标题与关闭按钮，宽度 660px；内容按效果开关、频响、预设、频段分组，组间 20px、组内 12px，重置与关闭置于标准底部操作区。窄窗口频段区域水平滚动，保持推子可操作，不另外定义弹窗边框/阴影/标题外壳。
- 新建歌单也接入 `AppModal`，添加歌单内继续新建时由 Naive 管理嵌套焦点栈；歌单 Select 菜单挂载 body，避免内部滚动区裁切。
- 离散 message/dialog/modal API 的 ConfigProvider 使用 `theme/discreteTheme.ts` 共享响应式配置，由 App setup 的 watchEffect 同步主题/overrides；不得在模块初始化时调用 Pinia Store。Tabs 保留 3px 专用圆角；所有复选框统一圆形（主题适配器 Checkbox borderRadius 为 50%，自定义复选框同样遵循），保留勾选、半选与禁用语义，不继承 common 12px。

- 一起听未入房面板的“自定义房间号/最大人数”并列一行；创建/加入Tab底部均以“创建房间/加入房间、关闭”排序，关闭由 Lobby emit close→Entry showPanel=false，仅收起弹窗，不退出房间、不修改房间状态。


## 账号歌单与收藏数据层（schema 9）

- `electron/database/accountLibrarySchema.ts` 将旧收藏/歌单/曲目一次性复制到空账号未关联区，保留历史表用于回溯；运行权威改为 `account_library_items` / `account_playlist_tracks`，不能再直接写旧表。账号复合主键允许不同账号收藏同歌或缓存相同远端歌单 ID。
- `AppDatabase.accountLibrary({accountId, deviceIdentity})` 创建捕获 main 可信身份的 Repository，所有 list/pending/remove/import 都限制该账号。旧 AppDatabase API 固定适配未关联区，不根据当前登录态猜归属；运行 IPC/sync 统一从 `electron/account/accountLibraryContext.ts` 捕获 main 当前账号、长期设备身份及公开 identityRevision；禁止 renderer 指定账号或回到旧全库 seed。
- `accountLibraryRepository.ts` 统一收藏关系、自建歌单 create/update/bulkAdd/bulkRemove/delete、数量/自动封面/outbox 同事务。通知与同步调度只能在成功返回后执行；远端 apply 使用 fromSync，排序单独传入 `sortOrder` 与权威 `serverVersion`，不得自行生成服务端版本。
- 曲目重复添加不改变元信息、排序或自动封面，返回 added/existing；排序为 COALESCE(sort_order,fallback_order) → server_version → track_key。历史 fallback 为旧自增 ID；扩展缺省保留，null 显式清除。在线自动封面只检查最后一首实际新增歌曲：仅其为有有效远程图的非 LOCAL 歌曲时更新；最后新增为 LOCAL/无图则保留原封面，不能向前寻找，清空 coverResource/coverPreset；KG 模板原样保留。
- `localTrackIdentityRepository.ts` 为原本机歌曲键维护长期 UUID 映射，与扫描记录删除无级联关系；不修改播放 ID、不按歌名时长猜匹配。双向查询与显式 associateLocalKey 供移动文件后确认关联；下行 resolveIncomingTrack 在原设备映射回原键，异机仍为不可播放占位。`electron/localLibrary/localTrackAccess.ts` 只按 main 索引/下载记录与显式别名恢复可读文件，不把远端 ID 当路径；缺文件不删除关系/映射。
- `importUnassociated()` 只能在用户明确确认后调用；保留未关联原件、收藏去重且保留关系时间、自建歌单创建新 UUID 账号副本。未关联 pending 不随导入搬移或上传，其他账号 pending 永远不清除。
- `syncService` / 收藏歌单 IPC / 托盘 / preload / renderer 已接 schema 9 账号范围；运行验收仍由用户进行。关系与 outbox 在 Repository 同事务提交，IPC 只在提交后通知与调度，不再事务外 record* 重复入队。`sync/syncPayload.ts` 为出站最终白名单，禁止发送原始 TrackSnapshot。

- LOCAL新增显式 `durationMs`（非负有限毫秒）；不从历史 `duration` 数值大小猜单位。出站有可信durationMs则使用，无则duration=0并省略durationMs；本地扫描/index 的秒显式 ×1000，可信下载 metadata 仅复用明确 durationMs，未知不猜。renderer LOCAL 优先 durationMs 转为 Song 毫秒；在线 duration 保持原契约。

- LOCAL收藏仅保留本机/当前账号关系，新增、删除和未关联导入均不产生favorite_song outbox或创建同步UUID；LOCAL跨端只允许playlist_track。安全源字段的私有位置检查与公共HTTPS封面尺寸参数规则须与Server同步policy一致，不合规封面置空，禁止先泄露再依赖服务端400。


## 账号范围、公开身份与导入接入

- `electron/account/accountIdentity.ts` 的 identityRevision 在 main 会话保存/清除时递增；账号异步登录/刷新/资料提交校验请求世代，过期响应不能覆盖新账号。JWT 仅保留于 main raw AccountSession，`account:*` IPC 返回 PublicAccountSession（公开用户/过期时间/identityRevision）；renderer 不再持有 token，一起听按公开世代重连。
- `settings:get/set/delete` 在 `ipc/publicSettingsPolicy.ts` 拒绝 account/sync/auth/credential/token/secret/main/private、设备身份、Cookie 和发现私有前缀（含账号分区）。普通 app-theme/local-setting/audioState 等设置继续使用原 API。新增 main 私有设置须纳入保留命名空间，禁止通用设置伪造会话或游标。
- `sync-state:<accountId>` 独立保存 seed/cursor/error/time；启动、切号和退出不搬移/删除其他账号 pending。seed 仅枚举捕获账号，保留已有 pending 删除/更新；空账号不联网。完整 protocol2 快照结束后才对账，pending/删除/快照均使用同一 LOCAL 逻辑 key；ACK 只删该账号本次 opId，push.version 不推进 pull，skipped 强制权威快照。
- 所有收藏/歌单 IPC 捕获同一 main Repository；renderer 世代只是过期请求保护，不是权限。远端 KG/WY 缓存刷新携带开始时的 identityRevision，main 拒绝切号后的迟到写入；收藏/歌单 store 即时清空当前视图与歌单曲目缓存，晚响应不写回旧账号结果。队列和本地物理库不随账号切换清空。
- 新 typed API：`getLibraryIdentity` / `onAccountIdentityChanged`、`createUserPlaylistWithTracks`、`updateUserPlaylist`、`removeUserPlaylist`、`bulkAddUserPlaylistTracks`、`bulkRemoveUserPlaylistTracks`、`resolveLocalTracks`。create-with-tracks 与 bulk 回执基于 Repository 实际 added/existing/removed，后续 P3/P4 编辑/转换复用，不搭平行存储。
- 设置 → 同步账号提供手动“查看并导入”，通过 `previewUnassociatedLibrary` 查询当前账号名称与未关联收藏/歌单数量；AppModal 明确确认后才调用 `importUnassociatedLibrary`。main 的一次性确认 ID 绑定身份世代、5 分钟过期，成功消费；取消不修改数据、不自动 seed，重复导入歌单会新建副本并明确告知，提交期间禁止重复/关闭。App 全局在首次登录当前账号且有未关联数据时复用同一可取消确认，main 的 account-library-import-prompt:<accountId> 记已提示；不会每次登录循环强制。手动入口随时保留。
- LOCAL 只允许 playlist_track 跨端；LOCAL 收藏仅本机账号关系。`songAvailability.ts`、统一 playbackCommands、audio 内部续播/队列入口和 main 取链共同阻止异机/文件缺失占位，批量过滤不可用项；一起听/下载继续拒绝 LOCAL。下行关系删除仅删账号关系，不删索引或物理文件；受管文件移动/关联 UI 属后续阶段。
- P1 账号范围、P3 编辑封面与 P4 转存已接入源码；Server 资源生命周期与真实跨设备行为仍需用户验收。必要检查仅 TypeScript/vue-tsc 与 diff，不把静态检查视为 App、UI、接口、测试或迁移验证。


## PC 统一批量操作

- `useBatchToolbarMorph` 统一多选入口与批量组的背景变形：点击先捕获带 `data-batch-trigger` 按钮的位置/颜色，组就绪后以约 380ms 过渡到实际组宽，后段淡入内容；退出反向收缩。仅背景伸缩，图标文字不拉伸；窗口边界按真实目标位置偏移，准备全集阶段保留取消入口。切 Tab/路由、重复触发及卸载清理临时动画，减少动态效果时直接切换。退出时同步保留旧组快照，DOM 更新完成后读取恢复的多选按钮，禁止在同步监听器内直接等待一次 nextTick 后测量，避免按钮尚未恢复而漏动画。同区播放全部按钮标记 `data-batch-play-all`，进入多选时从右向左收至左边缘，退出时从左向右展开，复用同一动画代次与清理流程，固定文字/图标尺寸，仅伸缩裁切容器。
- `batch/BatchSegmentedActions.vue` 为共享连续分段条，两端药丸、内部图标分段；默认仅图标，悬停或键盘聚焦时只展开当前项文案，移出收起；文字实际宽度、间距及透明度统一 300ms 过渡，保留减少动态效果设置。所有项有 title/aria-label，已选总数显示在组外；业务按钮组不再另起风格。多选入口默认使用与批量组一致的 `--surface-card` 底色且无边框，不能恢复 secondary 灰底或描边。外部工具栏按钮、取消加载按钮与批量组外框共享 `--batch-control-height: 36px`（`styles/batchToolbar.css`），外框高度包含边框，组内按钮填满内容区，不在 36px 外叠加边框造成切换跳动。多选和播放全部的端帽圆角固定为高度的一半，不参与 transition；播放全部缩至小于自身高度时使用外层裁切，内层药丸保持最小直径，避免宽度动画把圆角压扁。
- 在线歌单详情播放全部右侧直接显示编辑图标 + 多选，收藏/取消收藏收进更多；收藏单曲/歌单的多选在播放全部右侧（歌单无播放全部）；本地/下载四 Tab 多选在原工具栏。进入后隐藏原操作按钮并在同位置显示批量组，搜索保留。`SongList` 用 `batchExternal`、`batchToolbarTarget` 与 `enterBatch/exitBatch` 暴露外置入口，在线完整加载期间也进入准备状态并允许取消；其他未点名页面保留原能力与内部入口。
- 在线歌单批量组：全选、反选、收藏、下载、添加到、退出；收藏单曲：全选、反选、移除、下载、添加到、退出；收藏歌单：全选、反选、移除、退出，不新增整歌单下载/添加；自建歌单详情保留原批量能力。
- 本地歌曲/下载歌曲普通组：播放全部、刷新、多选；批量组：刷新、全选、反选、移除、添加到、退出。正在下载/下载记录普通组：刷新、多选；批量组：刷新、全选、反选、移除、退出；暂停/继续/重试等仍保留行内入口，不显示顶部全部暂停/继续/清除全部。
- 全选/反选只影响当前搜索结果，保留筛选外选择并显示总数；刷新剔除已不存在的选择，切换 Tab 或退出清空。收藏、下载、添加完成后保持多选；移除只剔除已移除项。下载移除继续默认只记录、物理删除二次确认，占用/共享/处理中的目标按现有安全规则报告，不强制取消任务。
- 批量“添加到”调用 `AddToPlaylistDialog.openMany(songs, { includeQueue: true })`，统一列出当前播放队列、自建歌单、新建歌单，创建后继续添加。旧单曲入口仍可只提供歌单。重复按 source:id 跳过，反馈实际添加/已存在结果；队列始终经统一播放命令 `appendUniqueToPlaylist`，可用性解析完成后读取最新队列同步去重追加，返回真实 added/existing/unavailable，不替换、不自动播放，一起听时禁用队列目标并说明原因。
- 下载列表后台更新与手动刷新状态分离：1.5 秒静默更新进度，不切换刷新按钮 loading；同一刷新请求复用 pending promise，避免并行请求。仅用户刷新展示 loading，切 Tab 清空多选状态。

- `useBatchSelection` 使用 `source:id` 稳定身份，Ctrl/Shift 选择、右键保留已选、全选/反选仅影响当前筛选全集，筛选外选择保留。`SongList` 的虚拟行 key 同时包含来源和 ID，不能只用 id 混淆不同音源。
- 在线歌单进入批量模式前，`prepareBatch` 必须经严格全集 loader 核验，支持取消加载，不以当前滚动已加载页冒充完整结果；收藏/本地完整列表直接复用。操作开始冻结目标快照，`BatchActionCoordinator` 分别计成功、跳过、失败和未执行；停止只影响后续项，不回滚已提交项，账号变化停止后续并清除旧界面状态。
- `BatchActionBar/BatchActionMenu` 复用明确幂等收藏/取消、持久下载入队、`AddToPlaylistDialog.openMany` 单事务添加及统一播放命令追加队列；不循环 toggle，不替换队列或自动播放。一起听中禁用仅追加队列，自建歌单移除曲目和删除歌单均单独确认，不删除音频。
- `BatchDownloadPlanner` 跳过 LOCAL、不可播、不支持和重复项；KG/WY/KW 各自选择当前账号可用音质，超过 100 首需明确确认。全部入队只调用持久 `enqueueDownloads`，大批次按接口上限分批并汇总未执行项，不创建第二下载执行器；重新下载必须用户勾选，默认复用已存在任务/完成实体，原文件不覆盖。
- 收藏歌单和自建歌单管理沿同一稳定选择规则；删除/取消收藏冻结确认前目标并校验账号世代，报告真实部分成功和取消结果。多曲添加歌单支持在选择器内新建目标，返回实际新增/重复数量。

## 自建歌单编辑与封面上传

- `mine/PlaylistEditDialog.vue` 统一新建与编辑外壳，`CreatePlaylistDialog` 保留 open/created 接口供添加歌单流程复用；标题、描述和最多 3 个标签保持，修改未保存关闭需确认。我的歌单与自建详情提供编辑/二次确认删除，成功后刷新索引和详情；删除仅移除关系，不删音频。
- `playlist-cover:*` typed IPC 走 API/store，再由 main `playlistCover/coverUploadManager.ts` 组合 Repository create/update 和本机私有状态事务；renderer 只能提供受管 assetId、表单和 identityRevision，不能指定账号、磁盘路径或 JWT。列表返回仅附加本机 preview/status，不持久化到歌单公共 payload 或 sync。
- `coverAssets.ts` 通过系统选择器收 JPG/PNG/WebP，校验扩展名、魔数、5MiB、解码和像素上限；main 重编码为最大 1024px JPEG 去附带元数据，存 `covers/playlists/<UUID>.jpg`。renderer 获得受管 ID 与预览 Data URL，不读磁盘。取消草稿不创建上传任务，不删除共享/原图。
- 私有 `main/private/playlist-cover-assets` 与 `main/private/playlist-cover-jobs` 保存账号归属、playlistId、editGeneration、expectedLocalCover、assetId、编辑时间与有界重试检查点；不存上传 token/key/JWT，不新增 schema。未关联歌单保留本机图，不自动搬给登录账号。用户明确确认导入时，在导入事务内为新歌单复制私有封面引用、独立账号/歌单/上传代次，并显式授权新账号读取共享受管副本；源 guest 原件及其引用保留，不直接删除共享图片。重启、身份变化及每分钟网络恢复检查只恢复当前账号，最多 3 次自动尝试后需用户重试，不热循环。
- `coverClient.ts` 沿用 requestSystem/unwrapResponse 与 main 捕获会话，请求 token→七牛实际直传→complete，核对 userId/playlistId/editGeneration/uploadId 与真实回执；401 保留失败项及会话，不调用失败会清会话的刷新入口、不降游客。每个 await 后检查身份/封面代次，停机停止回写。
- uploadId/上传已完成/ready DTO 分别持久化；上传后未 complete 可幂等续 complete，ready 但引用未落库可重试短事务。引用更新与 outbox、本机状态原子提交；尚未引用的迟到上传留 Server 七天生命周期回收，不复活被替换/自动封面/删除的状态。已上传资源同步400时，编辑弹窗可用本机副本显式解绑重传（生成新 outbox）或恢复默认。
- 上传引用的 outbox 沿用该封面代次最近真实用户编辑时钟（含同机后续改名/曲目修改），不能使用上传完成时刻压过他端编辑；Repository 原子维护 row/outbox/私有 editedAt，同设备远端回声不推进该时钟。每次明确本机图/默认/预设切换都生成或取消私有代次，资源/预设互斥清 null；本机图在公共歌单中 cover 为空，私有 fallback 不被同设备空 cover 回声/快照抹掉。实际应用其他设备更新时对照 deviceId/clientUpdatedAt 与本机编辑时间，较新明确恢复默认即使同为空 cover 也撤销旧上传；公共封面指纹变化同样阻止晚引用。
- `playlist/playlistCover.ts` 解析 PM 相同逻辑预设 local_chill/focus/gaming/jazz/pop/workout（PC 使用自身矢量资源），普通自建歌单 KG 模板也按调用尺寸解析；卡片 480、详情 720，远程图加载失败回退本机副本。最后一首实际新增歌曲的自动封面规则始终生效，重复项不参与，LOCAL/无图保留原图；有有效远程图则清资源/预设使旧上传指纹失配。


## PC 下载管理四分区 UI（P5c）

- `MineLocalSongsPanel.vue` 与 `MineDownloadPanel.vue`（合并自原 `localDownload.vue`）分别承载本地歌曲与已下载歌曲/正在下载/下载记录；任务列表只读 typed main 快照，未完成与全部历史分别展示，不再通过旧负数 records id 操作文件。轮询按面板挂载引用计数串行执行、卸载停止，错误保留可重试提示。
- `components/download/DownloadTaskList.vue` 负责九种中文状态、字节/速度/进度与单条操作；勾选按 taskId，搜索不丢筛选外选择。全部暂停/继续和清除全部覆盖 main 全集，与搜索过滤无关；PROCESSING 禁止中断。
- 暂停任务的“更换目录（从零开始）”只传 taskId 调用 main `selectDownloadTaskDirectory` 系统选择器；取消返回 null 不报成功或失败。选定后保持暂停并明确提示零起点，其他入队配置不变，再由用户继续下载。
- `DownloadRecordDetail.vue` 仅传 fileId/taskId 查询真实详情、定位/打开可信目录及修复；可信时长来自 file.durationMs，不推断历史未知时长；字段有效才展示并支持复制，修复失败保留错误提示。
- `DownloadDeleteConfirm.vue` 统一 AppModal，先 main preview 冻结范围，默认仅记录，勾选物理删除再二次明确确认。执行消费 previewId，分别展示 recordsRemoved/filesDeleted/sharedSkipped/occupied/failed/notExecuted；扫描歌曲经可信索引 lookup 的旧 store 入口，保留失败与占用/共享记录并可重新确认重试，不传任意路径给系统执行。
- 本地/下载 SongList 传完整歌曲源和 search-key，使用 local/download batch-context 与独立 key 隔离选择；行播放保留 append 行为，批量移除不受后续筛选变化影响。
- `settingStore.local.downloadConcurrency` 默认 2，持久化归一为 1–5 整数；LocalSetting 歌曲下载组可调整，并由 main 在后续排队调度读取。目录/四种命名/标签/封面/内嵌歌词及 off/word/line/all 外置歌词仍保留，文件配置只影响新入队任务。
- 本阶段只做类型、编译与静态审查；没有启动 App、调用真实接口/下载、执行迁移或完整测试，不把静态通过视为运行验收。
