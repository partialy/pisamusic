# 获取系统公告列表

获取客户端启动或关于页展示的系统公告列表。

- **请求方法**：`GET`
- **请求路径**：`/api/config/announcements`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

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
      "content": "PisaMusic v2.1.0 现已发布，欢迎体验全新一起听功能！",
      "time": "2026-08-25",
      "publisher": "PisaMusic 团队",
      "confirmText": "我知道了",
      "showEveryTime": false,
      "showGotoButton": true,
      "gotoUrl": "https://pisamusic.partialy.cn"
    }
  ],
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 公告唯一 ID |
| `content` | `string` | 公告富文本/正文内容 |
| `time` | `string` | 公告发布时间 |
| `publisher` | `string` | 发布者名称 |
| `confirmText` | `string` | 弹窗确认按钮文本 |
| `showEveryTime` | `boolean` | 是否每次启动都强制弹窗提醒 |
| `showGotoButton` | `boolean` | 是否显示跳转链接按钮 |
| `gotoUrl` | `string` | 点击跳转按钮后打开的外链 URL |
