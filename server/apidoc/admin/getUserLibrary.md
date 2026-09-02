# 分页获取用户歌单/歌曲数据

管理后台按类别分页查看指定用户同步在云端的歌曲或歌单数据明细。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/users/:id/library`
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
| `kind` | `string` | 是 | 数据类型：`favoriteSongs`（收藏歌曲）/ `favoritePlaylists`（收藏歌单）/ `userPlaylists`（自建歌单）/ `listeningHistory`（听歌历史） |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（默认 30） |

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
        "itemKey": "wy:186016",
        "itemId": "186016",
        "source": "wy",
        "name": "晴天",
        "subtitle": "周杰伦 · 叶惠美",
        "cover": "",
        "serverUpdatedAt": 1700000000000,
        "clientUpdatedAt": "",
        "durationMs": 269000,
        "listenedMs": 538000,
        "playCount": 3,
        "completedCount": 2,
        "firstListenedAt": 1699900000000,
        "lastListenedAt": 1700000000000
      }
    ],
    "total": 128,
    "offset": 0,
    "limit": 30
  },
  "success": true
}
```
