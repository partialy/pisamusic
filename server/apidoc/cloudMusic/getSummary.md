# 获取网盘音乐概览

返回公共网盘曲库的歌曲总数和最近更新时间。统计范围与公开搜索一致，仅包含未删除的 `active` 与 `disabled` 曲目。

- **请求方法**：`GET`
- **请求路径**：`/api/cloud-music/summary`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求示例

```http
GET /api/cloud-music/summary
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
    "latestUpdatedAt": 1700000000000
  },
  "success": true
}
```

`latestUpdatedAt` 在暂无公开曲目时为 `null`。
