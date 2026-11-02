# App 分享配置

所有响应沿用 `{ success, code, msg, data }`。独立于歌曲、歌单分享。

## GET /api/config/app-share

原接口兼容扩展，强制明文白名单。无设备凭证返回通用配置且 `trackingEnabled=false`，不创建推广记录。带 `x-pm-device-token` 时必须校验为有效 Android 设备，若显式携带 Authorization 则严格校验账号JWT，无效凭证返回401，不降级游客。首次按设备+账号/guest幂等创建6位短码，后续复用。新版在原字段基础上增加 `shareCode`、`trackingEnabled=true`，`qrCodeText` 和 `copyText` 替换为带 code 的最终链接。

所有响应 `Cache-Control: private, no-store`，`Vary: Authorization, x-pm-device-token`；IP限流60秒60次。Android需显式传两个Header以避免guest误归属。`data`通用示例：

```json
{"appName":"Pisa Music","version":"","iconUrl":"https://服务域名/static/app-share/default.png","description":"发现更多好音乐","qrCodeText":"https://pisamusic.partialy.cn/app-share/","copyText":"分享 Pisa Music，发现更多好音乐！\nhttps://pisamusic.partialy.cn/app-share/","updatedAt":0}
```

版本优先 `versionOverride`，否则 Android 当前发布版本；缺失或 `v0.0.0` / `0.0.0` 返回空字符串，由 App 使用本机版本。默认图是服务端本地静态图，客户端加载失败使用本机图标。模板替换全部 `{url}`，不含占位符则换行追加链接。

## GET /api/admin/app-share

管理员 JWT + 现有 AES-GCM 加密。返回平铺管理 DTO：`appName`、`versionOverride`、`iconFileId`（string|null）、`description`、`qrCodeText`、`copyTemplate`、`updatedAt`，另含生效预览字段 `version`、`iconUrl`、`copyText`。管理 DTO 默认图为同源相对路径。

## PUT /api/admin/app-share

管理员 JWT + 加密。请求完整提交六项：

```json
{"appName":"Pisa Music","versionOverride":"","iconFileId":null,"description":"发现更多好音乐","qrCodeText":"https://pisamusic.partialy.cn/app-share/","copyTemplate":"分享 Pisa Music，发现更多好音乐！\n{url}"}
```

`appName` 必填最多60字符，`versionOverride` 最多40，`description` 最多500，`copyTemplate` 最多1000。`qrCodeText` 仅接受本站 `https://pisamusic.partialy.cn/app-share/`，自动规范尾斜线，不得含认证信息、端口、hash或手填 `code`；保留合法非追踪查询参数（key为字母开头的1–64位字母数字/_/-，value最多200字）。最多1000字符且 UTF-8 最多2000字节。字符串会去除首尾空白。`iconFileId=null` 使用默认图，否则必须是已上传且未删除的 `app-share-icon` 文件。返回最新管理 DTO；校验失败 HTTP 400。上传图标不会自动发布；保存才切换引用，旧图保留。

## POST /api/admin/app-share/icon/upload-token

管理员 JWT + 加密。请求 `{ fileName, fileSize, mimeType }`：仅 JPG/JPEG、PNG、WebP，MIME 分别为 `image/jpeg`、`image/png`、`image/webp`，扩展名必须匹配；大小为整数、1B 至 2MiB。建议256px正方形。

返回现有七牛 DTO：`provider="qiniu"`、`uploadToken`、`uploadUrl`、`key`、`bucket`、`domain`、`cdnDomain`、`downloadUrl`、`expiresAt`（毫秒）。客户端将 `token=uploadToken`、`key`、`file` 直传 `uploadUrl`。使用七牛公开图片空间环境配置。Token 为指定 key、insertOnly，限制实际 MIME 和大小，有效1小时。

## POST /api/admin/app-share/icon/complete

管理员 JWT + 加密。请求 `{ key, bucket }`，首次完成必须来自尚未过期的上传会话；已完成会话允许幂等重试，直接返回仍有效的原文件记录。服务端核对会话、七牛 stat 的真实 MIME/大小，并请求对象 `?imageInfo` 验证实际格式与正方形；失败 HTTP 400，不登记文件。成功返回：

```json
{"fileId":"uuid","url":"https://图片域名/pisamusic/app-share-icons/uuid.png","fileName":"icon.png","fileSize":12345,"mimeType":"image/png"}
```

成功登记 `file_records.usage_type=app-share-icon`，重复 complete 返回原记录；已删除图标不可通过重复 complete 恢复。当前选中的图标禁止通过 `DELETE /api/admin/files/:id` 删除，必须先保存其他图标或默认图。未使用旧图可通过文件管理删除，实际删除七牛对象并保留 deleted 记录。

推广访问、归因及后台统计接口见 [tracking.md](./tracking.md)。修改文案/图标/版本不改变身份短码。
