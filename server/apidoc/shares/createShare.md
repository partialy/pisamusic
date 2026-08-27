# 创建歌曲/歌单分享

登录用户创建单曲或歌单的外链分享记录，生成唯一的分享 UUID 及网页/App 唤起链接。同一用户对同一资源的有效分享会幂等复用。

- **请求方法**：`POST`
- **请求路径**：`/api/shares`
- **需要鉴权**：是（`Authorization: Bearer <UserToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 是 | 分享类型，可选：`song`（单曲）或 `playlist`（歌单） |
| `rawJson` | `object` | 是 | 分享实体的完整 JSON 描述（单曲需包含 source, id, name/title, singer/artist 等；歌单需包含 id, name/title, list 等） |

### 请求示例

```json
{
  "type": "song",
  "rawJson": {
    "source": "wy",
    "id": "186016",
    "name": "晴天",
    "singer": "周杰伦",
    "albumName": "叶惠美",
    "pic": "https://p1.music.126.net/...",
    "interval": "04:29"
  }
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "创建成功",
  "data": {
    "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
    "shareUrl": "https://pisamusic.partialy.cn/scan?type=music-share&uuid=8c919a71-6c39-4d87-9eb5-c26693836101",
    "appUrl": "pisamusic://scan?type=music-share&uuid=8c919a71-6c39-4d87-9eb5-c26693836101",
    "share": {
      "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
      "type": "song",
      "source": "wy",
      "sourceId": "186016",
      "title": "晴天",
      "description": "周杰伦 · 叶惠美",
      "coverUrl": "https://p1.music.126.net/...",
      "rawJson": { /* 原始数据 */ },
      "sharer": {
        "id": "u_abc123456",
        "username": "音乐爱好者",
        "avatarUrl": "/static/account-avatars/default.jpg"
      },
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000,
      "accessCount": 0,
      "valid": true
    }
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `uuid` | `string` | 分享唯一 UUID |
| `shareUrl` | `string` | 官网公开扫码/分享落地页 URL（用于生成二维码或社交分享） |
| `appUrl` | `string` | PisaMusic App 唤起 Scheme URL（`pisamusic://scan?type=music-share&uuid=...`） |
| `share` | `object` | 分享详情记录 |
| `share.sharer` | `object` | 分享人公开信息快照 |
