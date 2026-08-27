# 获取单条动态配置

根据配置唯一 ID 读取动态配置内容，类型包括 `html`、`string`、`number`、`url`。

- **请求方法**：`GET`
- **请求路径**：`/api/config/get`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 动态配置的唯一标识 ID（例如 `listen_together_max_people`） |

### 请求示例

```http
GET /api/config/get?id=listen_together_max_people HTTP/1.1
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "listen_together_max_people",
    "type": "number",
    "content": "20"
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 配置 ID |
| `type` | `string` | 数据类型，固定为 `html`、`string`、`number` 或 `url` |
| `content` | `string` | 配置内容（字符串表示） |

### 常见错误响应

```json
{
  "code": 404,
  "msg": "配置不存在",
  "data": null,
  "success": false
}
```
