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
| `changes[].baseVersion` | `number \| null` | 否 | 可选；客户端已知的该实体最近 `server_version`，用于判断因果快进或并发冲突 |

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
| `accepted` | `number` | 本次输入中成功应用的最终有效项数（不含派生子墓碑） |
| `skipped` | `number` | 输入总数减 accepted：包括已处理/重复 opId、同 key 合并、相同状态 no-op、LWW 过期项、父墓碑屏蔽项 |
| `serverTime` | `number` | 服务端落库 UTC 毫秒时间戳（客户端用于对齐 HLC 时钟偏移） |
| `conflicts` | `number` | 本批触发 `baseVersion < server_version` 并发冲突裁决的条目数 |
| `appliedItems` | `Array` | 已应用（含 no-op 确认）项的权威版本清单：`{ opId, itemType, itemKey, version, noop? }` |
| `rejectedItems` | `Array` | 被拒绝/忽略项清单：`{ opId, itemType, itemKey, reason: "lww_lost" \| "parent_deleted" \| "duplicate_op", serverVersion }` |

## 合并、幂等与冲突

每批在用户行锁内先批量过滤已处理 opId，再按 `(itemType,itemKey)` 合并。当客户端携带 `baseVersion` 且等于或大于库中当前 `server_version` 时，判定为因果快进（不受本地偏慢时钟触发 LWW 误拒绝）；若 `baseVersion < server_version`（发生并发修改）或未传 `baseVersion`，默认开启 `sync.lwwEnabled` 时按 `clientUpdatedAt` 做 LWW 裁决。递归规范化对象 key 后比较 payload（数组顺序保留），相同 upsert 或已有墓碑的 delete 不分配版本、不写日志，但记入 applied_ops 并返回现有 `server_version`。较新 no-op 会推进实体冲突时钟，防止旧数据随后覆盖。

有效项一次性原子分配连续版本区间，批量更新 items/log/applied_ops；重复操作及整个事务失败不会产生版本空洞。客户端时间支持 ISO 字符串或毫秒数字字符串，统一存为 ISO，未来时间最多限制为服务端当前时间加五分钟，防止时钟异常永久阻塞同步。缺失时间按 0 处理。相等时间按到达顺序决定。

`favorite_song` payload 可选 `favoritedAt`（毫秒），seed 和新增时提交原收藏时间；服务端透传保留该字段。空 payload 兼容为 `{}`。HTTP/code 400 表示参数错误；其他失败返回 500，客户端保留 outbox 并退避重试。成功返回 `accepted=0` 仍可确认并移除本批全部原始 opId；不能用返回的全局 version 推进 pull 游标。

历史日志默认保留 90 天且每用户至少 1000 条，applied_ops 保留 30 天；实体与墓碑不清除。过期幂等记录重放通常由 LWW/no-op 阻止，关闭 LWW 后按到达顺序处理。运行配置可调整 `sync.logRetentionDays` / `sync.logMinimumEntries` / `sync.lwwEnabled`。

## 歌单扩展与 LOCAL 占位（P1）

- `playlist_track.payload.sortOrder?: number | null`：非负安全整数；缺字段保留权威值，null 显式重置。客户端按 sortOrder、权威 `change.version`、trackKey 稳定排序；缺失/null 回退既有顺序，不能伪造服务端版本。
- `user_playlist.payload.coverResource?: { resourceId: string } | null`、`coverPreset?: string | null`：缺字段保留，null 显式清除。resourceId/preset 为 1～128 字符 ASCII 字母数字起始、后续字母数字/冒号/下划线/连字符；resource 对象只能含 resourceId。切换类型时客户端显式清除互斥扩展，基础 cover 继续承载旧端可显示 URL/KG 原始模板。P1 仅严格校验形状，P2 才接入资源归属与引用生命周期，不能将 P1 当作上传授权。
- 同批同 key 按输入顺序累计未过期事件，较新事件缺扩展继承前一有效事件；过期事件不参与扩展合并。其他基础字段仍整份替换，不做递归 merge。delete 始终写空 payload，不继承扩展。
- LOCAL 仅允许自建歌单曲目：`source=local`、`id=<deviceScopeUuid>:<localSongUuid>`（两个标准 UUID）、`urlParam=id`、`itemKey=<playlistId>|local:<id>`。只允许 source/id/urlParam/name/singer/album/durationMs/duration/cover/sortOrder；文本最多512字符，拒绝绝对路径、盘符路径、UNC、file/content URI及scheme:// URL；允许普通公开元信息中的 / 或反斜杠（如AC/DC），无需改写名称，新LOCAL使用durationMs（非负有限毫秒数），消费端显式转为本机单位；duration仅保留非负有限值的旧字段兼容，服务端不猜其单位、不推断或改写在线旧payload，cover为空或不含凭据/hash的公共HTTPS URL（query仅允许param/thumbnail/w/h/width/height/size/quality/q，值为1～5位数字或数字x/y/_/*数字，可带末尾!；拒绝签名、Token与过期参数）（最长2048字符）。禁止 filePath、歌词、token、播放/签名链接等额外字段；非法负载整批400。自建/收藏歌单自身的历史 source=local 不受歌曲占位规则影响。
- 父 user_playlist 权威 delete 在同事务派生当前存活 playlist_track 墓碑与日志，派生版本计入账号版本，但不增加 accepted；`accepted + skipped = 输入数`。最终父墓碑屏蔽同批或迟到子 upsert，和输入先后无关；子项不创建/恢复父项。父项仍保持已有合法 upsert 的 LWW，无新增恢复入口。子墓碑时钟不早于原子项及父删除，防止旧子操作回放。
- 无已知父项的历史曲目继续兼容；不会凭空创建父项。快照分页、floor、no-op时钟规则保持不变；新快照排除墓碑，旧快照含父子墓碑，delta包含派生删除。

## 歌单封面资源（P2 / Schema v5）

`coverResource` 在最终胜出项上校验JWT用户归属、ready及对象uploaded；无可引用资源400且整批回滚。服务端覆盖`cover`为权威稳定公共URL，与歌单items/log/引用同一事务更新；旧端缺字段保留，null解除，父删除释放引用，多歌单共享最后解绑七天后回收。`coverResource`和非null `coverPreset`互斥。上传接口、DTO、完整生命周期见[用户歌单封面资源](../playlistCovers/overview.md)。
