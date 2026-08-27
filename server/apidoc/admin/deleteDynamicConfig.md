# 删除动态配置

从数据库中删除指定的动态配置项。

- **请求方法**：`DELETE`
- **请求路径**：`/api/admin/dynamic-configs/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待删除的配置 ID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "动态配置已删除",
  "data": null,
  "success": true
}
```

### 常见错误响应

- `404 动态配置不存在`
