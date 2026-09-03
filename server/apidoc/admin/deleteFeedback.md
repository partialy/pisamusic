# 删除用户反馈记录及附件

从数据库中删除指定的用户反馈记录，并级联清理关联的图片记录与磁盘附件文件。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/feedback/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待删除的反馈 ID（UUID） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "反馈已删除",
  "data": null,
  "success": true
}
```

### 错误响应

- `400 Bad Request`：无效的反馈 ID
- `404 Not Found`：反馈不存在
- `500 Internal Server Error`：删除反馈失败
