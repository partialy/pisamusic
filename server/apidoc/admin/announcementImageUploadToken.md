# 获取公告图片上传凭证

为管理后台生成公告图片直传七牛公共空间的上传凭证。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/announcements/images/upload-token`
- **需要鉴权**：是
- **加密模式**：端到端加密

请求体：

```json
{
  "announcementId": "anno_202609",
  "fileName": "screenshot.png",
  "fileSize": 102400,
  "mimeType": "image/png"
}
```

仅支持 jpg、jpeg、png、webp，单张图片最大 10MB。返回数据包含七牛 `uploadToken`、`uploadUrl`、`key`、`bucket` 和公共 CDN `downloadUrl`。
