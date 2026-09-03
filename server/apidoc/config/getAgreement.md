# 获取用户服务协议

获取客户端展示的用户服务协议标题、版本和纯文本正文。

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
    "content": "欢迎使用 PisaMusic 音乐播放器...\n\n第二段内容。",
    "version": 1
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `title` | `string` | 协议标题 |
| `content` | `string` | 协议纯文本全文，使用 `\\n` 表示换行，客户端按原文显示 |
| `version` | `number` | 协议版本，从 `1` 开始；标题或正文实际变化时递增，重复保存不递增 |

历史数据库中遗留的 HTML 正文只在服务端初始化迁移时转换一次，客户端不得将 `content` 当作 HTML 解析。客户端可保存已同意的版本号，服务端版本变化后重新请求用户确认。
