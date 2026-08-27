# 获取 PC 自动更新文件上传凭证

管理后台在上传 PC 自动更新资产（`latest.yml`、安装包 `.exe` 或 `.blockmap`）前获取直传七牛云私有空间的凭据。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/desktop-updates/upload-token`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `version` | `string` | 是 | 自动更新目标版本号（如 "1.5.0"） |
| `fileName` | `string` | 是 | 文件名（`latest.yml` / `*.exe` / `*.blockmap`） |
| `fileSize` | `number` | 是 | 文件大小（字节数） |
| `mimeType` | `string` | 否 | MIME 类型 |
| `platform` | `string` | 否 | 平台（默认 `win32`） |
| `arch` | `string` | 否 | 架构（默认 `x64`） |

### 请求示例

```json
{
  "version": "1.5.0",
  "fileName": "latest.yml",
  "fileSize": 450
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "自动更新上传凭证已生成",
  "data": {
    "token": "QiniuUploadTokenString...",
    "key": "pisamusic/desktop-updates/win32/x64/1.5.0/latest.yml",
    "uploadUrl": "https://upload.qiniup.com",
    "bucket": "pisamusic-releases",
    "domain": "https://releases.pisamusic.example.com",
    "expiresIn": 3600
  },
  "success": true
}
```
