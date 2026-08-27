# 删除公告

从管理后台删除指定的公告。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/announcements/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待删除的公告 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "公告已删除",
  "data": null,
  "success": true
}
```

### 常见错误响应

```json
{
  "code": 404,
  "msg": "公告不存在",
  "data": null,
  "success": false
}
```
