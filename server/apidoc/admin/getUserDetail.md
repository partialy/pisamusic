# 获取用户详情与统计

获取指定用户的基本资料、VIP 权益状态以及该用户在云端的收藏歌曲数、收藏歌单数、自建歌单数等同步数据统计。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/users/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 用户 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "u_abc123456",
    "email": "user@example.com",
    "username": "音乐爱好者",
    "avatar": "default",
    "avatarKey": "default",
    "avatarUrl": "/static/account-avatars/default.jpg",
    "vip": true,
    "vipEnabled": true,
    "vipExpiresAt": 1735689600000,
    "syncVersion": 45,
    "createdAt": 1700000000000,
    "updatedAt": 1700000050000,
    "lastLoginAt": 1700000050000,
    "stats": {
      "favoriteSongs": 128,
      "favoritePlaylists": 15,
      "userPlaylists": 3,
      "listeningTracks": 86,
      "listeningTotalMs": 18540000
    }
  },
  "success": true
}
```
