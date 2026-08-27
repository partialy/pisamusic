# 拉取增量同步变更

客户端根据本地保存的上次同步游标版本（`since`）拉取当前账号在云端的增量操作变更记录，用于将其他设备创建或更新的收藏歌曲、收藏歌单、自建歌单和歌单内歌曲同步到本地。

- **请求方法**：`GET`
- **请求路径**：`/api/sync/changes`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |
| `x-pm-device-id` | `string` | 否 | 客户端设备唯一标识（用于区分多端同步来源） |

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `since` | `number` | 否 | 本地已同步的最新版本号游标，默认为 `0`（首次拉取全量） |

### 请求示例

```http
GET /api/sync/changes?since=42 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1Ni...
x-pm-device-id: android-device-uuid-123
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "version": 45,
    "changes": [
      {
        "version": 43,
        "opId": "op_fav_001",
        "deviceId": "desktop-device-456",
        "itemType": "favorite_song",
        "itemKey": "wy_123456",
        "action": "upsert",
        "payload": {
          "source": "wy",
          "id": "123456",
          "title": "晴天",
          "artist": "周杰伦",
          "album": "叶惠美",
          "duration": 269
        },
        "clientUpdatedAt": "2026-08-26T10:00:00.000Z",
        "serverUpdatedAt": 1700000001000
      },
      {
        "version": 44,
        "opId": "op_fav_002",
        "deviceId": "desktop-device-456",
        "itemType": "favorite_song",
        "itemKey": "kg_987654",
        "action": "delete",
        "payload": {},
        "clientUpdatedAt": "2026-08-26T10:05:00.000Z",
        "serverUpdatedAt": 1700000002000
      }
    ]
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `version` | `number` | 云端当前账号的最新同步总版本号 |
| `changes` | `Array` | 增量操作日志列表（单次最多 1000 条） |
| `changes[].version` | `number` | 本次操作的原子递增版本号 |
| `changes[].opId` | `string` | 客户端生成的操作幂等 ID |
| `changes[].deviceId` | `string` | 产生本次操作的设备 ID |
| `changes[].itemType` | `string` | 同步项类型：`favorite_song`（收藏歌曲）、`favorite_playlist`（收藏歌单）、`user_playlist`（自建歌单）、`playlist_track`（歌单关联歌曲） |
| `changes[].itemKey` | `string` | 同步项唯一业务主键（例如 `wy_123456`） |
| `changes[].action` | `string` | 操作类型：`upsert`（新增/更新）或 `delete`（删除） |
| `changes[].payload` | `object` | 实体完整 JSON 对象 |
| `changes[].clientUpdatedAt` | `string` | 客户端操作时间 ISO 字符串 |
| `changes[].serverUpdatedAt` | `number` | 服务端落库毫秒时间戳 |
