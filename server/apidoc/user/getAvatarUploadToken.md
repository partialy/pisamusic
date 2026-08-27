# 获取头像上传凭证

获取直传七牛公开图片空间的上传 Token，客户端可凭此 Token 直接将用户头像上传至七牛云存储。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/avatar/upload-token`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `fileName` | `string` | 是 | 图片原始文件名（如 `avatar.jpg`） |
| `fileSize` | `number` | 是 | 文件大小（字节数，限制 5MB 以内） |
| `mimeType` | `string` | 否 | MIME 类型（如 `image/jpeg`、`image/png`、`image/webp`） |

### 请求示例

```json
{
  "fileName": "my_avatar.png",
  "fileSize": 204800,
  "mimeType": "image/png"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "token": "QiniuUploadTokenString...",
    "key": "pisamusic/user-avatars/u_abc123456/1700000000000_avatar.png",
    "uploadUrl": "https://upload.qiniup.com",
    "bucket": "pisamusic-public-img",
    "domain": "https://img.pisamusic.example.com",
    "expiresIn": 3600
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `token` | `string` | 七牛上传凭证（Upload Token） |
| `key` | `string` | 服务端预分配的七牛对象 Key，上传成功后通过 `PATCH /api/auth/profile` 更新到账号中 |
| `uploadUrl` | `string` | 七牛直传接口地址 |
| `bucket` | `string` | 目标公开存储空间名称 |
| `domain` | `string` | 图片 CDN 域名 |
| `expiresIn` | `number` | 凭证有效期秒数（3600秒） |
