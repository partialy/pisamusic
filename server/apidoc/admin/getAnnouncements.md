# 获取后台公告列表

管理后台获取当前配置的所有系统公告列表。

后台列表包含启用和停用的公告，使用 `enabled` 字段区分。停用公告不会从客户端公开列表返回，且不会删除历史已读回执。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/announcements`
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
      "id": "anno_1",
      "content": {
        "schemaVersion": 1,
        "blocks": [
          { "type": "text", "text": "PisaMusic v2.1.0 已发布\n欢迎体验。" },
          {
            "type": "highlight",
            "color": "primary",
            "text": "查看更新详情",
            "action": { "type": "url", "label": "打开", "url": "https://pisamusic.partialy.cn", "openMode": "app" }
          }
        ]
      },
      "time": "2026-08-25",
      "publisher": "PisaMusic 团队",
      "enabled": true,
      "confirmText": "我知道了",
      "showEveryTime": false,
      "showGotoButton": true,
      "gotoUrl": "https://pisamusic.partialy.cn"
    }
  ],
  "success": true
}
```

`content` 是结构化公告文档，不接受 HTML。内容块支持 `text`、`image`、`highlight`；高亮动作支持 `none`、`copy`、`url`、`protocol`。`url` 只允许 HTTPS，`protocol` 只允许 `pisamusic://`。
