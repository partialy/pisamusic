# 推送增量同步变更

客户端将本地离线或新发生的数据变动（收藏/取消收藏歌曲、收藏/自建歌单、歌单加歌删歌）批量推送到服务端。服务端通过事务原子递增账号版本号并记录操作日志，同时更新用户实体快照表。

- **请求方法**：`POST`
- **请求路径**：`/api/sync/changes`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |
| `x-pm-device-id` | `string` | 否 | 客户端设备唯一标识 |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `changes` | `Array<object>` | 是 | 变更操作数组（单次推送上限 500 条） |
| `changes[].opId` | `string` | 是 | 客户端操作唯一 ID（用于防重复幂等校验） |
| `changes[].itemType` | `string` | 是 | `favorite_song` / `favorite_playlist` / `user_playlist` / `playlist_track` |
| `changes[].itemKey` | `string` | 是 | 同步项唯一业务键 |
| `changes[].action` | `string` | 是 | `upsert` 或 `delete` |
| `changes[].payload` | `object` | 否 | 实体数据（`action="upsert"` 时必填） |
| `changes[].clientUpdatedAt` | `string` | 否 | 客户端发生变更的 ISO 时间字符串 |

### 请求示例

```json
{
  "changes": [
    {
      "opId": "op_local_1700000000_1",
      "itemType": "favorite_song",
      "itemKey": "kg_001",
      "action": "upsert",
      "payload": {
        "source": "kg",
        "id": "001",
        "title": "海阔天空",
        "artist": "Beyond",
        "album": "Words & Music Final Live",
        "duration": 326
      },
      "clientUpdatedAt": "2026-08-26T12:00:00.000Z"
    }
  ]
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "version": 46,
    "accepted": 1,
    "skipped": 0
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `version` | `number` | 提交后账号达到的最新同步版本号 |
| `accepted` | `number` | 本次成功接受并应用的变更条数 |
| `skipped` | `number` | 因 `opId` 已处理而被幂等跳过的条数 |
