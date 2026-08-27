# 获取发现页配置

获取客户端发现页的嵌入页面 URL 与更新时间戳。

- **请求方法**：`GET`
- **请求路径**：`/api/config/discover`
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
    "url": "https://pisamusic.partialy.cn/discover",
    "updatedAt": 1700000000000
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `url` | `string` | 发现页地址。若为 `USE_LOCAL_FILE` 则客户端加载内置本地 assets 页面；若为完整 HTTP/HTTPS 链接则在 WebView 中加载该网页 |
| `updatedAt` | `number` | 配置更新时间戳 |
