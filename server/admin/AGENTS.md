# Admin 管理后台规范

适用于 `server/admin/`。继承[根通用规范](../../AGENTS.md)，[Server 入口](../AGENTS.md)仅用于导航；后端实现细则不适用于纯前端页面任务。

## 技术栈与命令

- React 18 + TypeScript + Ant Design + React Router + Vite；图表使用 Recharts，优先复用项目现有组件、请求封装与交互模式。
- 以下命令从仓库根目录执行：开发 `pnpm --dir server/admin dev`，构建 `pnpm --dir server/admin build`。
- 构建产物输出到 `server/web-admin/`，已忽略，不提交。不要恢复旧 `build:web`、`deploy:web` 或复制到 `server/web/` 的流程。
- 页面、业务组件、状态与请求按职责拆分；不在页面复制加密、鉴权或服务端业务规则。

## 管理功能约束

- 管理接口继续使用现有管理员 JWT 与加密请求链路；字段及规则以 [API 索引](../apidoc/index.md)及对应模块文档为准。
- 仪表盘采用 Recharts 懒加载并作为默认主页；支持 7 / 30 / 90 天零填充趋势。“官网记录”固定放在左侧菜单第三项，列表显示摘要，详情再读取完整字段；仪表盘聚合响应不得暴露明细 IP、访客 hash 或 User-Agent。
- “运营与发布 → 分享记录”维护 App 推广记录，支持筛选、排序、详情事件分页、趋势、CSV 导出和单向失效；失效不删除、不恢复、不修改计数。推广隐私条款通过现有内容管理发布，不通过数据库迁移覆盖管理员内容。
- 歌曲 / 歌单分享记录使用独立 `/api/admin/shares`，支持类型、分享人关键词、有效性筛选和预览 / 复制扫码链接；只支持标记失效，保留历史。
- 发布安装包先获取上传 token、直传七牛、complete 登记，再发布版本。PC 发布页 EXE 与自动更新 installer 必须复用同一对象，上传任意一处后同步另一处地址、大小及文件引用；自动更新启用前上传真实 `latest.yml`、EXE 和可选 blockmap，不手写 `latest.yml`。
- 文件管理允许删除被版本引用的对象；界面应反映接口返回的删除状态与引用清理结果。完整删除发布历史仅允许非当前版本，当前版本须先发布替代版本。
- App 推广图标保存才切换引用，当前图标禁止删除；二维码地址仅允许本站 HTTPS `/app-share/`，不允许手填 code。
- 用户详情分类表格按 `/api/admin/users/:id/library` 分页，默认 30 条；不暴露密码 hash。系统 VIP 与第三方音乐账号分离，不支持永久 VIP；启用必须设置未来到期时间，关闭写入 `0 / NULL`。
- “验证码记录”位于用户管理下方，支持多维筛选、分页和删除；保留 email / phone、用途与发送 / 验证 / 过期 / 失败状态语义。
- 反馈与故障上报使用 `pending / processed` 两态；故障页支持 Android `play_url` 与 PC `desktop_network` 筛选、详情、JSON / ZIP 导出和级联删除。
- 一起听后台支持在线 / 历史列表详情与在线房间安全解散，不影响普通用户接口契约。专属消息硬删除不提供客户端撤回语义；公告停用不删除历史及回执。
- 邮件 provider 默认含 `aliyun / 阿里云`、`resend / Resend`。端点批量替换只修改 hostname，保留协议、端口、路径，替换后仍须“保存端点”。
- 服务发现的 API / realtime 地址须为纯 origin，仅 HTTPS（开发 localhost 可用 HTTP），不带认证信息、路径、query 或 hash；更新 feed 可含路径，但必须是无认证信息、query、hash 的 HTTPS URL，后端保存时也须校验。
- 动态配置固定 `html / string / number / url`；运行时策略通过 `/api/admin/runtime-config` 维护。听歌等级配置按 `expectedVersion` 乐观并发整组提交，区间规则查阅[跨模块契约](../../agents/CROSS_MODULE.md)。

## 契约维护与验证

- 涉及账号、分享、消息、发布、云盘等公共行为时，按需阅读[跨模块契约](../../agents/CROSS_MODULE.md)对应章节。
- API 新增、字段 / 规则变更或删除时，同步 `server/apidoc/` 对应文档与 `index.md`；需要修改后端时读取 [Server 后端规范](../agents/SERVER.md)。
- 前端改动运行对应构建；视觉或交互改动检查浏览器页面。纯文档调整只检查路径、链接、内容归属与差异，不运行完整测试。
