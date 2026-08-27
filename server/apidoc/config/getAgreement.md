# 获取用户服务协议

获取客户端展示的用户服务协议标题与富文本/纯文本正文。

- **请求方法**：`GET`
- **请求路径**：`/api/config/agreement` 或 `/api/config/service-agreement`（同义别名）
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "title": "PisaMusic 服务协议",
    "content": "欢迎使用 PisaMusic 音乐播放器..."
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `title` | `string` | 协议标题 |
| `content` | `string` | 协议内容全文 |
