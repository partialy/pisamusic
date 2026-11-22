# 分页查询用户同步变更日志

管理后台只读排查指定用户的云端同步操作日志（`user_sync_change_log`），并展示当前 `syncVersion` 与日志裁剪水位 `syncLogFloor`。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/users/:id/sync-logs`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 用户 ID |

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（默认 30，上限 100） |
| `itemType` | `string` | 否 | 过滤类型：`favorite_song` / `favorite_playlist` / `user_playlist` / `playlist_track` |
| `action` | `string` | 否 | 过滤动作：`upsert` / `delete` |
| `deviceId` | `string` | 否 | 设备 ID 模糊筛选 |
| `keyword` | `string` | 否 | 模糊匹配 `item_key` 或 `op_id` |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "list": [
      {
        "version": 45,
        "opId": "op_fav_001",
        "deviceId": "desktop-device-456",
        "itemType": "favorite_song",
        "itemKey": "wy:186016",
        "action": "upsert",
        "summary": "晴天 - 周杰伦",
        "payloadJson": "{...}",
        "clientUpdatedAt": "2026-08-26T10:00:00.000Z",
        "serverUpdatedAt": 1700000000000
      }
    ],
    "total": 45,
    "offset": 0,
    "limit": 30,
    "hasMore": true,
    "syncVersion": 45,
    "syncLogFloor": 0
  },
  "success": true
}
```
