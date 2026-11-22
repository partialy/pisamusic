# 查询指定版本的 PC 自动更新文件资产

读取后台指定版本已登记的 PC 自动更新文件（`latest.yml`、安装包 `EXE`、`blockmap`），用于版本编辑回显及文件槽位复用校验。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/desktop-updates/assets`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query 参数

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `version` | `string` | 是 | 目标版本号 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "assets": [
      {
        "id": "f_latest_yml_150",
        "version": "1.5.0",
        "platform": "win32",
        "arch": "x64",
        "fileType": "latest-yml",
        "fileName": "latest.yml",
        "fileSize": 324,
        "status": "uploaded",
        "active": true
      }
    ]
  },
  "success": true
}
```
