# 更新动态配置

在管理后台修改已存在的动态配置项。

- **请求方法**：`PUT`
- **请求路径**：`/api/admin/dynamic-configs/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 待修改的配置 ID |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `type` | `string` | 是 | `html` / `string` / `number` / `url` |
| `content` | `string` | 是 | 新内容 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "动态配置已保存",
  "data": {
    "id": "listen_together_max_people",
    "type": "number",
    "content": "30",
    "createdAt": 1700000000000,
    "updatedAt": 1700000060000
  },
  "success": true
}
```

### 常见错误响应

- `404 动态配置不存在`
