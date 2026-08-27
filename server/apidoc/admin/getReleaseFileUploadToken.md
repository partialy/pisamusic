# 获取安装包直传七牛上传凭证

管理后台上传 Android APK 或 PC 安装包 EXE 前，获取七牛云私有存储空间的上传 Token 与预分配对象 Key。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/release-files/upload-token`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 平台：`android` 或 `desktop` |
| `fileName` | `string` | 是 | 文件名（Android 必须以 `.apk` 结尾，Desktop 必须以 `.exe` 结尾） |
| `fileSize` | `number` | 是 | 文件大小（字节数，APK 限制 ≤ 200MB，EXE 限制 ≤ 500MB） |
| `mimeType` | `string` | 否 | MIME 类型 |

### 请求示例

```json
{
  "platform": "android",
  "fileName": "PisaMusic-v2.2.0.apk",
  "fileSize": 48025600
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "上传凭证已生成",
  "data": {
    "token": "QiniuUploadTokenString...",
    "key": "pisamusic/releases/android/1700000000000_PisaMusic-v2.2.0.apk",
    "uploadUrl": "https://upload.qiniup.com",
    "bucket": "pisamusic-releases",
    "domain": "https://releases.pisamusic.example.com",
    "expiresIn": 3600
  },
  "success": true
}
```
