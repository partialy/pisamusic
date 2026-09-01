# 登记公告图片

七牛直传完成后，服务端校验对象并登记到 `file_records`。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/announcements/images/complete`
- **需要鉴权**：是
- **加密模式**：端到端加密

请求体：

```json
{
  "announcementId": "anno_202609",
  "bucket": "public-bucket",
  "key": "pisamusic/announcements/anno_202609/uuid.png",
  "hash": "etag",
  "fileName": "screenshot.png",
  "mimeType": "image/png",
  "fileSize": 102400
}
```

服务端会校验公告 ID 前缀、公共空间、真实对象大小和图片类型。成功响应包含 `fileId` 和 CDN `url`，公告内容的 `image` 块只引用该 `fileId`。
