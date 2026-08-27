# 启用 PC 自动更新版本

在后台将指定版本的 `latest.yml` 及配套安装包资产设为全局当前活跃（`active=true`）。生效后，Electron 客户端请求 `/api/config/desktop-updates/win32/x64/latest.yml` 时即可自动下载并升级到该版本。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/desktop-updates/activate`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `version` | `string` | 是 | 已上传完整资产的目标版本号 |
| `platform` | `string` | 否 | `win32`（默认） |
| `arch` | `string` | 否 | `x64`（默认） |

### 请求示例

```json
{
  "version": "1.5.0",
  "platform": "win32",
  "arch": "x64"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "PC 自动更新版本已启用",
  "data": {
    "assets": [
      {
        "id": "f_latest_yml_150",
        "assetType": "manifest",
        "fileName": "latest.yml",
        "active": true
      },
      {
        "id": "f_exe_150",
        "assetType": "installer",
        "fileName": "PisaMusic-Setup-1.5.0.exe",
        "active": true
      }
    ]
  },
  "success": true
}
```
