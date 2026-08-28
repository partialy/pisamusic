# 搜索网盘音乐

搜索公共网盘曲库中的曲目列表。仅返回 `active`（可用）与 `disabled`（禁用）状态的曲目；`disabled` 曲目的 `playable` 字段为 `false`。网盘音乐作为独立 `cloud` 音源，不参与其他平台聚合搜索。

- **请求方法**：`GET`
- **请求路径**：`/api/cloud-music/search`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 默认值 | 说明与限制 |
| :--- | :--- | :--- | :--- | :--- |
| `keyword` | `string` | 否 | `""` | 搜索关键词（支持匹配歌名、歌手、专辑、UUID） |
| `offset` | `number` | 否 | `0` | 分页偏移量，最小 0 |
| `limit` | `number` | 否 | `30` | 每页数量，最小 1，最大 100 |

### 请求示例

```http
GET /api/cloud-music/search?keyword=晴天&offset=0&limit=20
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "source": "cloud",
    "items": [
      {
        "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
        "source": "cloud",
        "title": "晴天",
        "artist": "周杰伦",
        "album": "叶惠美",
        "durationMs": 269000,
        "format": "flac",
        "playable": true,
        "cover": {
          "source": "uploaded",
          "url": "/api/cloud-music/tracks/8c919a71-6c39-4d87-9eb5-c26693836101/cover"
        },
        "lyrics": {
          "format": "lrc",
          "fileName": "晴天.lrc"
        },
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `source` | `string` | 固定为 `"cloud"` |
| `items` | `array` | 曲目列表 |
| `items[].uuid` | `string` | 曲目唯一 UUID |
| `items[].playable` | `boolean` | 是否可播放（`active` 为 true，`disabled` 为 false） |
| `items[].cover.source` | `string` | 封面来源：`uploaded`（手动上传）、`embedded`（内嵌提取）、`default`（默认封面） |
| `items[].cover.url` | `string` | 稳定的相对封面入口 `/api/cloud-music/tracks/:uuid/cover`；该入口会即时重定向到私有签名 URL 或默认静态封面。 |
| `items[].lyrics` | `object \| null` | 歌词信息（若有） |
| `total` | `number` | 符合条件的曲目总数 |
| `offset` | `number` | 当前偏移量 |
| `limit` | `number` | 每页数量 |
