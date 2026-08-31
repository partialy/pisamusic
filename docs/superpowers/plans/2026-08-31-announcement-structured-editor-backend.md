# 公告结构化编辑器后端改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公告后台的 HTML 富文本改为服务端可校验的结构化内容，支持纯文字/换行、图片、高亮块、跳转 URL 与复制操作，同时保留“每次都展示”和“前往”按钮等现有公告行为，并为 Android 与 PC 后续适配提供稳定、可扩展的统一接口。

**Architecture:** 公告正文采用 `contentBlocks` 结构化 JSON 作为新写入格式，服务端保存规范化后的 block 文档；公开接口同时返回结构化文档和一份服务端生成的兼容 HTML，保证旧版 Android/PC 不会因接口字段变化立即崩溃。图片不接受 base64 或任意外链，统一走七牛公开图片空间并登记到 `file_records`，正文只保存资产 ID。公告 CRUD 从通用 `configStore` 中抽出到独立 announcement store，内容校验、资产解析和兼容 HTML 渲染分别放在独立 service 中。

**Tech Stack:** Node.js 22、TypeScript、Express、SQLite、现有 Qiniu 公共图片空间与 `file_records` 文件登记机制。

## 方案结论与取舍

1. **不再接受后台提交的原始 HTML。** 新建和更新公告必须提交 `contentBlocks`；服务端拒绝 `content` 作为新正文输入，避免脚本、样式和不同客户端 HTML 渲染差异。
2. **采用有限 block 文档，而不是自由格式 JSON。** V1 仅支持三类 block：
   - `text`：`text` 字段支持 `\n` 换行，服务端统一换成 LF。
   - `image`：引用 `assetId`，可选 `alt`；图片 URL 由服务端根据文件记录解析。
   - `highlight`：`text`、`tone` 和可选 `action`。`action` 为 `url`（显示文本 `label` + `http/https` 地址 `url`）或 `copy`（显示文本 `label` + 要复制的 `value`）。客户端点击高亮块或其中的操作区域后自行执行动作。
3. **保留旧字段兼容。** 数据库继续保留 `content`，新公告由服务端根据 blocks 生成安全 HTML；接口新增 `contentFormat` 与 `contentBlocks`。历史 HTML 公告标记为 `legacy-html`，仍可读取和展示，但不允许在旧格式上继续提交原始 HTML 更新。这样新旧客户端可以渐进升级。
4. **图片独立管理。** 后台先申请上传凭证，再直传七牛，最后由服务端 `stat` 校验并创建 `file_records` 记录。公告 block 只引用记录 ID；被公告引用的图片不能被文件管理直接删除，替换或删除公告时同步维护引用关系。
5. **现有行为不变。** 顶层 `confirmText`、`showEveryTime`、`showGotoButton`、`gotoUrl` 保留原语义；正文高亮操作与顶层“前往”按钮是两套能力，互不替代。
6. **本轮只改 `server/` 和本计划文档。** 不修改 `server/admin/`、`pm/`、`yixi/`；下一阶段前端改造直接消费 `contentBlocks`，旧客户端暂时继续消费兼容 `content`。用户确认方案后再按任务分步提交。

## V1 内容契约

规范化后的 `contentBlocks`：

```ts
type AnnouncementContent = {
  schemaVersion: 1;
  blocks: AnnouncementBlock[];
};

type AnnouncementBlock =
  | { type: "text"; text: string }
  | { type: "image"; assetId: string; alt?: string }
  | {
      type: "highlight";
      text: string;
      tone: "info" | "success" | "warning" | "danger";
      action?:
        | { type: "url"; label: string; url: string }
        | { type: "copy"; label: string; value: string };
    };
```

建议的服务端限制固定为：单个公告最多 100 个 block、最多 10 个图片；普通文本最多 10,000 字符、高亮文本最多 2,000 字符、复制值最多 4,096 字符、URL 最多 2,048 字符；图片仅允许 JPEG/PNG/WebP，单张不超过 5 MB。服务端拒绝 `javascript:`、`data:`、`file:` 及其他非 HTTP(S) URL，并对所有文本、属性和 URL 做 HTML 转义。限制写入独立常量，后续可在不改客户端契约的情况下调整。

公开/后台读取的公告对象新增：

```ts
{
  id: string;
  content: string; // 兼容旧客户端的服务端生成 HTML；legacy-html 时为历史原值
  contentFormat: "blocks" | "legacy-html";
  contentBlocks: AnnouncementContent | null;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime: boolean;
  showGotoButton: boolean;
  gotoUrl?: string;
}
```

客户端后续以 `contentBlocks` 为主：`text` 渲染换行，`image` 渲染服务端返回的图片地址，`highlight.action.url` 通过系统浏览器/应用内页面打开，`highlight.action.copy` 写入剪贴板并给出反馈。旧 Android WebView 当前关闭 JavaScript，兼容 HTML 只负责展示高亮，不承诺复制交互；复制和跳转交互必须在后续客户端结构化渲染中实现。

## 实施任务

### 1. 抽取公告领域类型与 SQLite 迁移

- [ ] 新增 `server/src/services/announcementContentTypes.ts`，定义 `AnnouncementContent`、三类 block、action、`contentFormat`、校验错误类型及上述限制常量，供 route/store/service 共用。
- [ ] 修改 `server/src/db/appDb.ts`：为 `announcements` 增加 `content_format TEXT NOT NULL DEFAULT 'legacy-html'` 和 `content_blocks_json TEXT`；启动迁移只补列和索引，不重建表、不丢失现有 `content`。
- [ ] 新增 `server/src/db/announcementStore.ts`，承接公告查询、按 ID 查询、upsert、删除和 block JSON 序列化；查询时把旧行识别为 `legacy-html`，解析失败不得阻断启动。
- [ ] 修改 `server/src/db/configStore.ts`：保留现有导出名作为兼容包装，内部转调 announcement store，避免其他配置模块一次性大范围改动；`insertAnnouncement` 兼容旧 JSON 导入字段，但新业务写入统一走 blocks。

### 2. 实现内容校验、规范化与兼容 HTML 渲染

- [ ] 新增 `server/src/services/announcementContentService.ts`，实现：
  - `normalizeAnnouncementContent(input: unknown): AnnouncementContent`：校验 schema、block 顺序、长度、图片数量、action 字段和 URL 协议，统一换行并返回字段路径错误。
  - `parseStoredAnnouncementContent(row): AnnouncementContent | null`：只解析 `content_format='blocks'` 的 JSON；历史 HTML 返回 `null`。
  - `resolveAnnouncementContent(content, assetResolver)`：将图片 `assetId` 解析为公开 `imageUrl`，资产缺失时让保存/发布请求失败而不是生成不可用公告。
  - `renderAnnouncementCompatibilityHtml(content)`：仅生成服务端允许的 `p`、`br`、`div`、`img`、安全 `a` 等标签；不拼接用户 HTML，不执行脚本，不信任用户 style。
- [ ] 在 service 中集中实现 `http/https` URL 校验、HTML 属性转义、换行处理和错误码，供顶层 `gotoUrl` 与 block action 共用。
- [ ] 为历史 HTML 公告定义明确读取规则：公开接口继续返回 `contentFormat='legacy-html'`、`contentBlocks=null`；新建/更新请求不允许把旧 `content` 原样写回。

### 3. 建立公告图片上传与引用生命周期

- [ ] 新增 `server/src/services/announcementAssetService.ts`：复用现有七牛配置和签名能力，生成 `announcement-images/<uuid>.<ext>` 公共图片对象 key；校验文件名、MIME、大小并返回直传 token。
- [ ] 增加完成上传逻辑：调用七牛 `stat` 校验实际大小与 MIME，创建 `file_records` 记录，使用 `usage_type='announcement-image'`，保存稳定公开 URL、所有者和原始文件信息；禁止客户端直接把七牛 URL写入正文。
- [ ] 扩展 `server/src/db/configStore.ts` 中的 file record 类型映射（或抽出共享 file-record helper），使 `announcement-image` 能被 `GET /api/admin/files` 正确显示，并保留既有删除审计字段。
- [ ] 保存公告时计算 block 中的 asset ID 集合，原子更新 `file_records.referenced_by`（至少记录 `announcement:<id>`）；删除/替换公告前清理旧引用，仍被其他公告引用的文件不清理。
- [ ] 修改文件删除路径的引用检查：被任一公告引用时返回明确的冲突响应，不调用七牛删除；未被引用且状态允许删除时，按现有规范删除七牛对象并将记录标记为 `deleted`。

### 4. 改造后台公告 CRUD 与图片接口

- [ ] 修改 `server/src/routes/admin.ts` 的 `normalizeAnnouncement`：保留 ID、发布时间、发布者、确认文案及展示开关校验；新建/更新必须读取 `contentBlocks`，调用内容 service 规范化并生成兼容 HTML；`showGotoButton=true` 时继续要求合法 `gotoUrl`。
- [ ] 在 `server/src/routes/admin.ts` 增加：
  - `POST /api/admin/announcements/images/upload-token`：返回七牛直传参数和 `assetKey`，不写数据库。
  - `POST /api/admin/announcements/images/complete`：接收上传结果，完成 `stat`、登记 `file_records` 并返回 `{ assetId, imageUrl }`。
- [ ] 让公告 `GET/POST/PUT/DELETE` 使用 announcement store 和资产引用事务；响应中统一返回 `contentFormat`、`contentBlocks` 和兼容 `content`。
- [ ] 保持现有管理员加密、鉴权、错误响应风格；图片接口同样走管理员 JWT 和加密响应，不新增明文管理入口。

### 5. 改造公开公告响应并维护接口文档

- [ ] 修改 `server/src/routes/config.ts` 的 `GET /api/config/announcements`：对 blocks 公告解析并解析图片 URL，对历史公告按兼容规则返回；继续保留公开明文白名单和设备封禁处理。
- [ ] 如需稳定图片域名，统一使用现有公共图片空间 URL 构造函数，不新增签名 URL；图片记录缺失时不返回伪造地址。
- [ ] 更新 `server/apidoc/config/getAnnouncements.md`、`server/apidoc/admin/createAnnouncement.md`、`server/apidoc/admin/updateAnnouncement.md`、`server/apidoc/admin/getAnnouncements.md`、`server/apidoc/admin/deleteAnnouncement.md`，补充 blocks schema、限制、兼容字段、错误码和图片引用规则。
- [ ] 新增图片 token/complete 的接口文档，并更新 `server/apidoc/index.md` 的公告与文件管理索引链接。

### 6. 最小验证与交接边界

- [ ] 增加内容 service 的聚焦单元测试：换行规范化、危险 URL 拒绝、HTML 转义、block 限制、图片引用解析和兼容 HTML 输出；不覆盖客户端 UI。
- [ ] 使用现有 SQLite 测试方式验证旧 HTML 行迁移、新 blocks 行读写、乐观引用更新和删除冲突。
- [ ] 执行 `pnpm --dir server build` 作为服务端类型/构建检查；不启动服务、不改后台前端、不做 Android/PC 真机测试。
- [ ] 按“数据库与类型 → 内容 service → 图片生命周期 → 路由 → 文档/验证”分步提交，提交消息沿用仓库近期中文规范；每步只包含对应范围文件。

## 本轮确认点

按上述推荐方案，后续前端需要从 HTML 展示切换到 `contentBlocks` 渲染，并在客户端实现剪贴板反馈、URL 跳转和图片加载失败占位。若确认“图片统一七牛公开图床、保留旧公告兼容读取、服务端拒绝新 HTML”三点，我再开始执行第 1 项；当前不修改任何业务代码。
