# 登记已上传七牛的安装包

客户端或后台直传七牛云成功后，调用此接口将文件元数据正式写入统一 `file_records` 表，并返回生成的下载服务路径。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/release-files/complete`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 平台：`android` 或 `desktop` |
| `bucket` | `string` | 是 | 七牛空间名称 |
| `key` | `string` | 是 | 七牛对象 Key |
| `hash` | `string` | 是 | 七牛返回的 ETag / Hash |
| `fileName` | `string` | 是 | 文件名 |
| `mimeType` | `string` | 是 | MIME 类型 |
| `fileSize` | `number` | 是 | 文件大小（字节数） |
| `version` | `string` | 否 | 关联的版本号 |

### 请求示例

```json
{
  "platform": "android",
  "bucket": "pisamusic-releases",
  "key": "pisamusic/releases/android/1700000000000_PisaMusic-v2.2.0.apk",
  "hash": "Fk8Y...",
  "fileName": "PisaMusic-v2.2.0.apk",
  "mimeType": "application/vnd.android.package-archive",
  "fileSize": 48025600,
  "version": "2.2.0"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "安装包已登记",
  "data": {
    "id": "f_android_220",
    "platform": "android",
    "version": "2.2.0",
    "provider": "qiniu",
    "bucket": "pisamusic-releases",
    "objectKey": "pisamusic/releases/android/1700000000000_PisaMusic-v2.2.0.apk",
    "hash": "Fk8Y...",
    "fileName": "PisaMusic-v2.2.0.apk",
    "mimeType": "application/vnd.android.package-archive",
    "fileSize": 48025600,
    "status": "uploaded",
    "downloadUrl": "/api/config/release-files/f_android_220/download",
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000
  },
  "success": true
}
```
