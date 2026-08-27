# 公开读取分享内容

根据分享 UUID 公开获取单曲或歌单分享详情，用于官网扫码页展示、PC 详情页解析及移动端识别。每次成功读取都会原子递增分享记录的访问计数（`accessCount`）。

- **请求方法**：`GET`
- **请求路径**：`/api/shares/public/:uuid`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | 是 | 分享记录 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "uuid": "8c919a71-6c39-4d87-9eb5-c26693836101",
    "type": "song",
    "source": "wy",
    "sourceId": "186016",
    "title": "晴天",
    "description": "周杰伦 · 叶惠美",
    "coverUrl": "https://p1.music.126.net/...",
    "rawJson": {
      "source": "wy",
      "id": "186016",
      "name": "晴天",
      "singer": "周杰伦",
      "albumName": "叶惠美",
      "pic": "https://p1.music.126.net/...",
      "interval": "04:29"
    },
    "sharer": {
      "id": "u_abc123456",
      "username": "音乐爱好者",
      "avatarUrl": "/static/account-avatars/default.jpg"
    },
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000,
    "accessCount": 12,
    "valid": true
  },
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 404,
  "msg": "分享不存在或已失效",
  "data": null,
  "success": false
}
```

- `404 分享不存在或已失效`：分享记录不存在或 `valid = false`。
