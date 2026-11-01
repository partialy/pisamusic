# App 分享实施计划

来源：已确认的「实现分享App功能」设计，2026-11-02 开始实施。

## 约束与契约

- 独立 SQLite 单条配置，不混入歌曲/歌单分享。
- GET `/api/config/app-share` 公开读取，返回现有响应信封，data 为 appName、version、iconUrl、description、qrCodeText、copyText、updatedAt。
- 管理接口 GET/PUT `/api/admin/app-share`，POST `/api/admin/app-share/icon/upload-token`、`/icon/complete`，沿用管理员 JWT 和加密。
- 管理字段 appName（必填最多60）、versionOverride（最多40）、iconFileId（可空）、description（最多500）、qrCodeText（完整HTTP/HTTPS URL）、copyTemplate（最多1000）。模板替换全部 `{url}`，缺少占位符时末尾追加链接。
- 默认 Pisa Music、默认本地图标、描述「发现更多好音乐」、链接 `https://pisamusic.partialy.cn/download/`、模板「分享 Pisa Music，发现更多好音乐！\n{url}」。版本优先覆盖，其次 Android 发布版本；v0.0.0/缺失返回空供 Android 本机版本兜底。
- 图标七牛公开图片空间，JPG/PNG/WebP、最大2MiB、正方形；建议256px。服务端核验实际文件后登记 file_records usage_type=app-share-icon。上传不发布；保存切换引用，旧图保留，当前图禁止删除。
- Android 设置关于下新增分享App，复制 pm/icons/share_app_分享App_压缩.webp 并重命名，不移动原文件。独立 Sheet：图标/名称/版本、黑白二维码带白边、描述、复制链接与更多两圆形按钮（主题蓝图标、灰背景）。更多用 ACTION_SEND text/plain，不接微信/QQ SDK。
- 每次打开立即展示缓存/默认，再异步刷新；SharedPreferences 整份原子缓存，失败维持旧配置，无固定过期时间。复制/更多使用同一快照文案；远程图失败回退本机图标；深浅主题适配。
- Admin 系统设置下 App分享，表单与实时预览，移动端上下布局；恢复默认仅改草稿；保存才发布。前后端校验。
- 保留未跟踪 ic_qq_24.xml、ic_wechat_24.xml。只改本项目，禁止读取 example。复用现有封装。

## 任务一：Server

独立 store/service/routes，数据库初始化、路由与权限接入、七牛图标上传/核验/登记、当前图引用删除保护。同步 server/apidoc 模块和索引。运行服务端 build 和必要聚焦验证。仅暂存本任务文件，中文提交。

## 任务二：Admin

按上述契约新增 AppSharePage、API、菜单路由，复用现有表单、上传和通知。显示有效版本及自动模式，图标上传与保存分离。运行 admin build。仅暂存本任务文件，中文提交。

## 任务三：Android

先读 pm/AGENTS.md、pm/components.md 与 frontend-development Android 规范。新增独立 Repository/DTO/Sheet、设置入口与资源，复用网络/二维码/主题/提示。更新 pm 文档和组件索引，运行 Kotlin 编译或 debug 构建。仅暂存本任务文件，中文提交。

## 任务四：整体验证与文档

逐模块审查，核对接口/缓存/图标生命周期，修复重要问题。同步根 AGENTS.md，记录构建及未完成的真机/七牛验证。文档中文提交，不推送、不合并。

## 进度

- 已完成：完整设计读取、工作区核对（dev，基线92bd75e）。
- 已完成：任务一 Server（1a76d32），规格与质量审查通过。
- 已完成：任务二 Admin（b4c3d62），上传控件与文件管理修正（a5fb489、730028d）。
- 已完成：任务三 Android（f388b3f），URL 解析兼容修正（201293a）。
- 已完成：任务四跨端契约审查、隔离环境接口与后台浏览器验证、相关文档同步。
- 验证：Server build；Admin TypeScript + Vite build；Android assembleDebug；隔离 SQLite + mock 七牛图标生命周期；管理权限；后台草稿/保存/恢复默认真实请求联调；1440px 与 390px 浏览器视觉检查均通过。
- 验证边界：没有跑完整测试，没有部署或操作用户真机；真实七牛上传/CORS/imageInfo/CDN、Android 亮暗主题/离线/系统分享需用户实际验收。
