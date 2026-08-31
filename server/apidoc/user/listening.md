# 听歌时长与等级

`/api/listening` 是账号维度的听歌事实与统计模块。客户端上传不可变的真实连续播放片段，服务端据此维护权威累计时长、单曲统计和动态等级；接口同时面向 Android 与未来 PC 桌面端，双方都使用相同的 V1 DTO，禁止传入 Media3、Howler、Activity、renderer、播放列表下标或本地文件路径等平台实现字段。

所有本页接口都不是明文白名单路径，必须遵守[全局通信规范](../common/overview.md)：请求使用端到端 AES-GCM 加密并携带 `x-pm-random`，正常业务响应也会加密；所有接口均要求 `Authorization: Bearer <UserToken>`。加密中间件在安装响应加密包装前拒绝请求时（例如加密 Header、载荷、时间戳或 nonce 校验失败），该 `401` 响应可能为明文，客户端必须同时兼容明文失败响应与加密业务响应。示例展示的是解密后的标准 `ApiResponse.data`。

## 统一时间与统计口径

- 所有时间戳和累计时长均为整数毫秒；播放区间使用半开区间 `[startedAtMs, endedAtMs)`，`endedAtMs` 不计入该片段。
- 等级和展示分钟统一为 `floor(totalMs / 60000)`。
- 用户 `totalMs` 是同一账号下**全部设备、全部歌曲**播放区间的并集；重叠区间只计一次。
- 单曲 `listenedMs` 是同一账号、同一规范化小写 `source + songId` 的区间并集；不同歌曲即使同时播放也分别统计，因此单曲时长之和可以大于用户总时长。
- 歌曲身份只支持 `kg`、`wy`、`kw`、`cloud`、`local`，不同音源不做标题或歌手模糊合并。本地歌曲只允许不透明 ID，不得上传路径、`content://`、歌词、封面字节、播放 URL 或 Cookie。

## 批量上报听歌片段

- **请求方法**：`POST`
- **请求路径**：`/api/listening/fragments/batch`
- **需要鉴权**：是（User JWT）
- **加密模式**：端到端加密

### Request Headers

| Header | 必填 | 说明 |
| :--- | :--- | :--- |
| `Authorization` | 是 | `Bearer <UserToken>`；用户 ID 只能从该 JWT 获取。 |
| `x-pm-random` | 是 | 加密协议使用的 128 字符随机密钥，详见全局通信规范。 |
| `x-pm-device-id` | 是 | 设备 ID 只能从此 Header 获取；服务端会 `trim` 并最多保留前 128 个字符，空值返回 `400`。它与 `eventId` 一起构成幂等域。 |

### Request Body

| 字段 | 类型 | 必填 | 限制与说明 |
| :--- | :--- | :--- | :--- |
| `schemaVersion` | `number` | 是 | 当前仅支持整数 `1`。 |
| `platform` | `string` | 是 | 仅 `android` 或 `desktop`；仅标记采集平台，不参与用户总时长隔离。 |
| `fragments` | `array` | 是 | 每批 `1..200` 条。批次无有效待上传片段时客户端不应请求。 |
| `fragments[].eventId` | `string` | 是 | 片段幂等 ID，去除首尾空白后长度 `1..128`，仅允许字母数字以及 `.`、`_`、`:`、`-`，且首字符必须是字母或数字。 |
| `fragments[].playSessionId` | `string` | 是 | 同一次播放会话 ID；格式和长度与 `eventId` 相同。同一账号、设备、会话不得关联不同歌曲。 |
| `fragments[].source` | `string` | 是 | 去除空白并转小写后必须为 `kg`、`wy`、`kw`、`cloud`、`local` 之一。 |
| `fragments[].songId` | `string` | 是 | 去除首尾空白后长度 `1..256`。`local` 不得为 `content:` / `file:` URI，也不得含 `/` 或 `\\`。 |
| `fragments[].title` | `string` | 否 | 展示快照，去除空白后最长 512；缺省按空字符串保存。 |
| `fragments[].artist` | `string` | 否 | 展示快照，去除空白后最长 512；缺省按空字符串保存。 |
| `fragments[].album` | `string` | 否 | 展示快照，去除空白后最长 512；缺省按空字符串保存。 |
| `fragments[].trackDurationMs` | `number` | 否 | 正整数毫秒；用于单次播放会话的有效播放/完成次数判定。 |
| `fragments[].startedAtMs` | `number` | 是 | 安全整数毫秒时间戳。 |
| `fragments[].endedAtMs` | `number` | 是 | 安全整数毫秒时间戳，必须大于 `startedAtMs`。 |
| `fragments[].activeDurationMs` | `number` | 是 | 正安全整数毫秒，且与 `endedAtMs - startedAtMs` 的绝对差不超过 5000。 |
| `fragments[].terminalReason` | `string` | 否 | `natural_end`、`manual_next`、`stop`、`error`、`app_exit` 之一，最长 32；未提供为 `null`。 |

额外时间校验：单个连续片段不得超过 16 分钟，`startedAtMs` 和 `endedAtMs` 都不能晚于服务端当前时间 5 分钟。当前与未来客户端应以 15 分钟为网络批量上报周期，并在本地开放片段每 30–60 秒 checkpoint；这是客户端采集策略，不改变服务端接受的单片段上限。

### 请求示例

```json
{
  "schemaVersion": 1,
  "platform": "android",
  "fragments": [
    {
      "eventId": "35f0d35f-5b06-43d4-8f30-9fa85c557bc5",
      "playSessionId": "5b0d80f8-3b8d-4cc2-b5e6-6204f7001b19",
      "source": "kg",
      "songId": "12345",
      "title": "海阔天空",
      "artist": "Beyond",
      "album": "乐与怒",
      "trackDurationMs": 326000,
      "startedAtMs": 1787976000000,
      "endedAtMs": 1787976900000,
      "activeDurationMs": 900000,
      "terminalReason": "manual_next"
    }
  ]
}
```

### 幂等与处理结果

服务端以 `(userId, deviceId, eventId)` 判断幂等：已经保存且完整载荷相同的片段进入 `duplicate`，不会再次累计；相同三元组但载荷不同进入 `rejected`，原因是 `eventId` 已用于不同播放片段。相同 `eventId` 可在不同设备各自使用。一个批次中同一 `eventId` 若对应不同载荷，该 ID 也会被拒绝；合法批次中的单条校验失败只列入 `rejected`，其他片段仍会在同一事务中处理。批次顶层结构不合法时整个请求返回 `400`。

### 播放与完成次数口径

`playCount` 与 `completedCount` 的作用域都是同一 `(userId, deviceId, playSessionId)` 播放会话；同一会话跨片段、跨批次累计，且各计数最多增加一次。若已知 `trackDurationMs`，有效播放阈值为 `min(30000, max(1, floor(trackDurationMs * 0.5)))` 毫秒；未知歌曲时长时阈值固定为 `30000` 毫秒。会话的累计 `activeDurationMs` 首次达到该阈值时，`playCount +1`；会话已达到阈值且任一已接受片段观察到 `terminalReason="natural_end"` 时，`completedCount +1`。两种条件的先后顺序可跨批次：先自然结束后达到阈值，或先达到阈值后自然结束，都会在第二个条件满足时只计一次完成。

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "accepted": ["35f0d35f-5b06-43d4-8f30-9fa85c557bc5"],
    "duplicate": [],
    "rejected": [],
    "summary": {
      "totalMs": 900000,
      "totalMinutes": 15,
      "level": { "level": 1, "minMinutes": 0, "maxMinutes": null }
    },
    "serverTimeMs": 1787976900100
  },
  "success": true
}
```

| 响应字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `accepted` | `string[]` | 本次新写入、并参与统计的 `eventId`。 |
| `duplicate` | `string[]` | 已存在且载荷完全相同、未重复计时的 `eventId`。 |
| `rejected` | `Array<{ eventId, reason }>` | 未接受的 ID 与原因；`eventId` 可能为空，表示该条本身没有可用 ID。 |
| `summary` | `ListeningSummary` | 本批处理后的权威汇总，结构见下节。 |
| `serverTimeMs` | `number` | 本次处理时的服务端毫秒时间戳，可用于客户端校准绝对时间。 |

## 获取听歌汇总

- **请求方法**：`GET`
- **请求路径**：`/api/listening/summary`
- **需要鉴权**：是（User JWT）
- **加密模式**：端到端加密

不需要设备 Header。响应 `data` 为：

```json
{
  "totalMs": 900000,
  "totalMinutes": 15,
  "level": {
    "level": 1,
    "minMinutes": 0,
    "maxMinutes": null
  }
}
```

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `totalMs` | `number` | 全设备、全歌曲时间并集后的权威累计毫秒数；没有事实片段时为 `0`。 |
| `totalMinutes` | `number` | `floor(totalMs / 60000)`。 |
| `level` | `ListeningLevelRule` | 当前分钟数命中的动态等级闭区间。 |
| `level.level` | `number` | 从 1 开始连续编号的等级。 |
| `level.minMinutes` | `number` | 包含的起始分钟。 |
| `level.maxMinutes` | `number \| null` | 包含的结束分钟；`null` 表示无上限。 |

## 分页查询单曲统计

- **请求方法**：`GET`
- **请求路径**：`/api/listening/tracks`
- **需要鉴权**：是（User JWT）
- **加密模式**：端到端加密

### Query Parameters

| 参数 | 类型 | 必填 | 默认值 | 说明与限制 |
| :--- | :--- | :--- | :--- | :--- |
| `source` | `string` | 否 | 全部 | 仅 `kg`、`wy`、`kw`、`cloud`、`local`。 |
| `sort` | `string` | 否 | `listenedMs` | 支持 `listenedMs` / `listened_ms`、`playCount` / `play_count`、`lastListenedAt` / `last_listened_at`。同类排序的次序：时长后按最近听歌时间，播放次数后按最近听歌时间。 |
| `offset` | `number` | 否 | `0` | 十进制非负整数。 |
| `limit` | `number` | 否 | `20` | 十进制正整数；服务端最多返回 `100` 条。 |

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "items": [
      {
        "source": "kg",
        "songId": "12345",
        "title": "海阔天空",
        "artist": "Beyond",
        "album": "乐与怒",
        "durationMs": 326000,
        "listenedMs": 900000,
        "playCount": 1,
        "completedCount": 0,
        "firstListenedAt": 1787976000000,
        "lastListenedAt": 1787976900000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `items[].source` / `songId` | `string` | 单曲身份。 |
| `items[].title` / `artist` / `album` | `string` | 最近一次带非空值的展示快照；可能为空字符串。 |
| `items[].durationMs` | `number \| null` | 最近已知的歌曲时长。 |
| `items[].listenedMs` | `number` | 同账号、同一歌曲跨设备区间并集后的毫秒数。 |
| `items[].playCount` | `number` | 该歌曲下各 `(userId, deviceId, playSessionId)` 会话首次累计达到有效阈值的次数；同一会话只计一次。 |
| `items[].completedCount` | `number` | 该歌曲下已达到有效阈值且任一片段出现 `natural_end` 的会话次数；同一会话只计一次。 |
| `items[].firstListenedAt` / `lastListenedAt` | `number` | 该歌曲已接受片段的最早开始、最新结束毫秒时间戳。 |
| `total` | `number` | 符合筛选条件的歌曲总数。 |
| `offset` / `limit` | `number` | 实际使用的分页参数。 |

## 错误码

| HTTP 状态 | 业务 `code` | 场景 |
| :--- | :--- | :--- |
| `400` | `400` | 缺少/无效 `x-pm-device-id`、批次顶层结构、`schemaVersion`、`platform`、`fragments` 数量，或 `GET /tracks` 查询参数不符合限制。任何单条 fragment 字段校验失败、批内 `eventId` 载荷冲突、已存 `eventId` 载荷冲突或同一播放会话关联不同歌曲，均返回 `200` 并写入 `rejected`。 |
| `401` | `401` | 缺少或无效 User JWT，或缺少/无效加密 Header、加密载荷、时间戳或 nonce。 |
| `500` | `500` | 非预期服务端错误；客户端不可把此情况当作已确认成功。 |
