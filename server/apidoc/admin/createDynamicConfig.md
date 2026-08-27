# 创建动态配置

在管理后台新增一条动态配置。

- **请求方法**：`POST`
- **请求路径**：`/api/admin/dynamic-configs`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Request Headers

| Header | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `Authorization` | `string` | 是 | 格式为 `Bearer <admin_token>` |

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 配置 ID（1-120 字符，仅支持字母、数字、点号、下划线、短横线） |
| `type` | `string` | 是 | 固定为 `html`、`string`、`number` 或 `url` |
| `content` | `string` | 是 | 配置内容（≤ 50000 字符；`number` 类型必须可转换为合法数字；`url` 类型必须为合法 http/https 链接） |

### 请求示例

```json
{
  "id": "listen_together_max_people",
  "type": "number",
  "content": "20"
}
```

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
    "content": "20",
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000
  },
  "success": true
}
```

### 常见错误响应

- `409 动态配置已存在`
- `400 type 仅支持 html、string、number、url`
