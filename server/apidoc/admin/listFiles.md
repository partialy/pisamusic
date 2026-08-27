# 分页查询统一文件登记记录

管理后台统一文件管理中心，查询登记在 `file_records` 表中的所有七牛云对象文件（安装包 APK/EXE、PC 自动更新 latest.yml/blockmap 等）。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/files`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `status` | `string` | 否 | 状态筛选：`uploaded`（默认已上传生效）/ `deleted`（已标记删除）/ `all`（全部） |
| `usageType` | `string` | 否 | 资产用途：`release-package`（安装包）/ `desktop-update`（PC自动更新）/ `all`（全部） |
| `platform` | `string` | 否 | 平台筛选：`android` / `desktop` / `win32` |
| `version` | `string` | 否 | 版本号过滤 |
| `keyword` | `string` | 否 | 文件名或对象 Key 模糊搜索关键词 |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数，默认 20 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "items": [
      {
        "id": "f_desktop_150_exe",
        "usageType": "desktop-update",
        "assetType": "installer",
        "platform": "desktop",
        "arch": "x64",
        "version": "1.5.0",
        "provider": "qiniu",
        "bucket": "pisamusic-releases",
        "objectKey": "pisamusic/releases/desktop/1700000000000_PisaMusic-Setup-1.5.0.exe",
        "hash": "FvJ9...",
        "fileName": "PisaMusic-Setup-1.5.0.exe",
        "mimeType": "application/x-msdownload",
        "fileSize": 93532160,
        "status": "uploaded",
        "active": true,
        "referencedBy": "release:hist_1,desktop_update:1.5.0",
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000,
        "deletedAt": null
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
