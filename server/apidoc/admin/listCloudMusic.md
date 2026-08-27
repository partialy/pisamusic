# 获取网盘音乐列表 (管理后台)

分页查询管理后台网盘音乐曲目，支持状态、上传阶段、关键词等条件筛选。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/cloud-music`
- **需要鉴权**：是（管理员 JWT）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `keyword` | `string` | 否 | 关键词筛选（匹配歌名、歌手、专辑） |
| `status` | `string` | 否 | 业务状态筛选（`temp`、`active`、`disabled`、`offline`、`pending_review`、`rejected` 或 `all`） |
| `uploadState` | `string` | 否 | 上传阶段筛选（`reserved`、`uploaded`、`processing`、`ready`、`failed` 或 `all`） |
| `offset` | `number` | 否 | 偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数，默认 30，最大 200 |

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
        "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
        "source": "cloud",
        "owner": { "type": "system", "userId": null, "displayName": "system" },
        "status": "active",
        "uploadState": "ready",
        "statusReason": "",
        "title": "晴天",
        "artist": "周杰伦",
        "album": "叶惠美",
        "durationMs": 269000,
        "format": "flac",
        "codec": "flac",
        "bitrate": 892000,
        "sampleRate": 44100,
        "channels": 2,
        "year": 2003,
        "trackNo": 3,
        "playable": true,
        "cover": { "source": "uploaded", "url": "https://..." },
        "lyrics": { "format": "lrc", "fileName": "晴天.lrc" },
        "createdAt": 1700000000000,
        "updatedAt": 1700000000000
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 30
  },
  "success": true
}
```
