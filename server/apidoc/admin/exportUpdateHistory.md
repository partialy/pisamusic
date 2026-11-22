# 导出全部发行历史记录

导出管理后台所有未逻辑删除（`deleted_at IS NULL`）的版本发行历史记录，支持 JSON 与带 UTF-8 BOM 的 CSV 两种格式。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/update-history/export`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query 参数

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `format` | `string` | 否 | `json` | 导出格式：`json` 或 `csv` |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "format": "csv",
    "fileName": "发行记录-2026-11-22.csv",
    "mimeType": "text/csv;charset=utf-8",
    "content": "\ufeff记录ID,平台,版本状态,版本号,..."
  },
  "success": true
}
```
