# 获取网盘音乐概览

返回公共网盘曲库的歌曲总数、当前用户贡献数和最近更新时间。统计范围与公开搜索一致，仅包含未删除的 `active` 与 `disabled` 曲目。若请求携带有效用户 Token，则返回该用户投稿并生效的歌曲数量。

- **请求方法**：`GET`
- **请求路径**：`/api/cloud-music/summary`
- **需要鉴权**：否（可选携带 `Authorization: Bearer <userToken>` 统计用户个人贡献）
- **加密模式**：端到端加密

---

## 请求示例

```http
GET /api/cloud-music/summary
Authorization: Bearer <userToken>
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 128,
    "latestUpdatedAt": 1700000000000,
    "myContributions": 6
  },
  "success": true
}
```

- `latestUpdatedAt` 在暂无公开曲目时为 `null`。
- `myContributions` 在未登录或无贡献时为 `0`。
