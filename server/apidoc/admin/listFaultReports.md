# 分页查询故障上报批次列表

管理后台分页查询客户端上报的故障批次列表，支持按场景（`play_url` / `desktop_network`）与处理状态筛选。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/fault-reports`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `status` | `string` | 否 | `pending` 或 `processed` |
| `scene` | `string` | 否 | `play_url` 或 `desktop_network` |
| `keyword` | `string` | 否 | 品牌/型号/版本模糊搜索 |
| `offset` | `number` | 否 | 分页偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（默认 20） |

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
        "id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
        "userId": "u_abc123456",
        "scene": "play_url",
        "platform": "android",
        "arch": "arm64-v8a",
        "appVersion": "2.1.0",
        "appVersionCode": 210,
        "osVersion": "14",
        "sdkInt": 34,
        "brand": "Xiaomi",
        "model": "23127PN0CC",
        "networkType": "WIFI",
        "logCount": 1,
        "status": "pending",
        "createdAt": 1700000000000,
        "processedAt": null
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
