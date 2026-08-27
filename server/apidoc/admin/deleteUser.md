# 硬删除用户

从管理后台物理硬删除用户账号及其云端所有同步记录和数据。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/users/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待删除的用户 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "用户已删除",
  "data": null,
  "success": true
}
```

### 常见错误响应

- `404 用户不存在`
