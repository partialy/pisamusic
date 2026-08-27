# 登记已上传七牛的 PC 自动更新文件

七牛直传完成后，将 `latest.yml`、EXE 安装包或 blockmap 文件的元数据登记入 `file_records` 表。若上传的是 EXE，会自动与发布页同版本 EXE 安装包联动复用。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/desktop-updates/complete`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `version` | `string` | 是 | 版本号 |
| `bucket` | `string` | 是 | 七牛空间名称 |
| `key` | `string` | 是 | 对象 Key |
| `hash` | `string` | 是 | ETag / Hash |
| `fileName` | `string` | 是 | 文件名 |
| `mimeType` | `string` | 是 | MIME 类型 |
| `fileSize` | `number` | 是 | 文件大小（字节数） |
| `platform` | `string` | 否 | `win32`（默认） |
| `arch` | `string` | 否 | `x64`（默认） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "自动更新文件已登记",
  "data": {
    "id": "f_latest_yml_150",
    "usageType": "desktop-update",
    "assetType": "manifest",
    "version": "1.5.0",
    "platform": "win32",
    "arch": "x64",
    "fileName": "latest.yml",
    "status": "uploaded"
  },
  "success": true
}
```
