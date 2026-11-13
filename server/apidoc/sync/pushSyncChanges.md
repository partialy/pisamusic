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
      "itemKey": "kg:001",
      "action": "upsert",
      "payload": {
        "source": "kg",
        "id": "001",
        "name": "海阔天空",
        "singer": "Beyond",
        "album": "Words & Music Final Live",
        "duration": 326,
        "favoritedAt": 1787745600000
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
| `skipped` | `number` | 输入总数减 accepted：包括已处理/重复 opId、同 key 合并、相同状态 no-op、LWW 过期项 |

## 合并、幂等与冲突

每批在用户行锁内先批量过滤已处理 opId，再按 `(itemType,itemKey)` 合并。默认开启 `sync.lwwEnabled`，同 key 取最新 clientUpdatedAt（同时间取输入最后一条）；关闭时按输入最后一条。递归规范化对象 key 后比较 payload（数组顺序保留），相同 upsert 或已有墓碑的 delete 不分配版本、不写日志，但记入 applied_ops。较新 no-op 会推进实体冲突时钟，防止旧数据随后覆盖。

有效项一次性原子分配连续版本区间，批量更新 items/log/applied_ops；重复操作及整个事务失败不会产生版本空洞。客户端时间支持 ISO 字符串或毫秒数字字符串，统一存为 ISO，未来时间最多限制为服务端当前时间加五分钟，防止时钟异常永久阻塞同步。缺失时间按 0 处理。相等时间按到达顺序决定。

`favorite_song` payload 可选 `favoritedAt`（毫秒），seed 和新增时提交原收藏时间；服务端透传保留该字段。空 payload 兼容为 `{}`。HTTP/code 400 表示参数错误；其他失败返回 500，客户端保留 outbox 并退避重试。成功返回 `accepted=0` 仍可确认并移除本批全部原始 opId；不能用返回的全局 version 推进 pull 游标。

历史日志默认保留 90 天且每用户至少 1000 条，applied_ops 保留 30 天；实体与墓碑不清除。过期幂等记录重放通常由 LWW/no-op 阻止，关闭 LWW 后按到达顺序处理。运行配置可调整 `sync.logRetentionDays` / `sync.logMinimumEntries` / `sync.lwwEnabled`。
