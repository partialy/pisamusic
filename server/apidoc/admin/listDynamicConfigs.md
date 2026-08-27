# 获取动态配置列表

管理后台获取所有存储在 SQLite `dynamic_configs` 表中的动态配置项列表。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/dynamic-configs`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "id": "listen_together_max_people",
      "type": "number",
      "content": "20",
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ],
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 动态配置 ID |
| `type` | `string` | 配置数据类型：`html`、`string`、`number` 或 `url` |
| `content` | `string` | 配置内容（字符串） |
| `createdAt` | `number` | 创建时间戳 |
| `updatedAt` | `number` | 更新时间戳 |
