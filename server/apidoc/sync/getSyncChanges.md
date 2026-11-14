# 拉取同步快照或增量变更

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
| `since` | `number` | 否 | 已完整应用的版本游标，默认 0；0 或小于 sync_log_floor 时返回快照 |
| `protocol` | `number` | 否 | 新客户端固定发送 2，启用安全快照分页 |
| `limit` | `number` | 否 | 每页 1～1000，默认 1000 |
| `snapshotVersion` | `number` | 否 | 后续快照页固定携带第一页返回值 |
| `cursor` | `string` | 否 | 后续快照页原样携带上一页 cursor；必须同时传 snapshotVersion |

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
        "itemKey": "wy:123456",
        "action": "upsert",
        "payload": {
          "source": "wy",
          "id": "123456",
          "name": "晴天",
          "singer": "周杰伦",
          "album": "叶惠美",
          "duration": 269,
          "favoritedAt": 1787738400000
        },
        "clientUpdatedAt": "2026-08-26T10:00:00.000Z",
        "serverUpdatedAt": 1700000001000
      },
      {
        "version": 44,
        "opId": "op_fav_002",
        "deviceId": "desktop-device-456",
        "itemType": "favorite_song",
        "itemKey": "kg:987654",
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
| `mode` | `string` | snapshot 或 delta |
| `changes` | `Array` | delta 的日志，或 snapshot 的兼容映射（结构相同） |
| `items` | `Array` | snapshot 专用：当前页存活项，结构同 changes，action=upsert |
| `snapshotVersion` | `number` | snapshot 一致性版本，最终对账完成后才保存到本地游标 |
| `cursor` | `string/null` | snapshot 下一页偏移，末页为 null |
| `hasMore` | `boolean` | 是否还有下一页 |
| `changes[].version` | `number` | 本次操作的原子递增版本号 |
| `changes[].opId` | `string` | 客户端生成的操作幂等 ID |
| `changes[].deviceId` | `string` | 产生本次操作的设备 ID |
| `changes[].itemType` | `string` | 同步项类型：`favorite_song`（收藏歌曲）、`favorite_playlist`（收藏歌单）、`user_playlist`（自建歌单）、`playlist_track`（歌单关联歌曲） |
| `changes[].itemKey` | `string` | 同步项唯一业务主键（例如 `wy:123456`） |
| `changes[].action` | `string` | 操作类型：`upsert`（新增/更新）或 `delete`（删除） |
| `changes[].payload` | `object` | 实体完整 JSON 对象 |
| `changes[].clientUpdatedAt` | `string` | 客户端操作时间 ISO 字符串 |
| `changes[].serverUpdatedAt` | `number` | 服务端落库毫秒时间戳 |

## 一致性、兼容与错误

新客户端每次发送 `protocol=2`。快照第一页请求 `since=0`，后续请求保持 `since=0` 并携带 `snapshotVersion`、`cursor`、`limit`。服务端每页在用户行锁内读取版本与实体；期间任何有效写入导致版本变化，下一页返回 HTTP 409、响应 `code=409`。客户端必须丢弃累计页并从头重试，不能应用不完整快照或提前推进游标。快照最后一页对四类实体全量对账，保留本机 pending 项；空快照同样有效。不要对快照过滤同设备项。

Delta 仅在已完整应用后以最后一条 `changes[].version` 推进游标；全局 `version` 和 push 返回版本不能直接覆盖 pull 游标。`hasMore=true` 时继续分页；同设备回声可跳过实体应用，但仍推进对应版本。

未传 `protocol=2` 的旧端遇到快照条件时，一次性返回全部最新实体（含 delete 墓碑）作为 `changes`，按 `server_version` 升序，不使用分页。最后一条版本达到当前全局版本，避免旧端重复读取第一页。旧端不能执行缺失项对账，可能保留本地历史多余项；新端只接收存活项。兼容返回可能大于 1000 条，建议升级客户端。

`favorite_song.payload.favoritedAt` 为可选毫秒收藏时间，客户端用它恢复收藏顺序。旧端缺失时按各端原兼容规则回退。非法参数返回 HTTP/code 400；数据库故障返回 HTTP/code 500，客户端应退避重试。

歌单排序、封面可空扩展、LOCAL安全占位与父删除派生子墓碑遵循[推送扩展契约](pushSyncChanges.md#歌单扩展与-local-占位p1)。null必须保留其清除含义；排序使用外层权威version。派生子墓碑与普通delete相同，拥有独立的确定性opId，按各自version推进游标。

LOCAL占位下行优先 `payload.durationMs`（可选非负有限毫秒数），客户端显式转换为本机时长单位；`duration`只作旧字段兼容，缺少durationMs时不由服务端猜单位。在线来源历史duration原样透传，不重新定义全来源单位。
