# 获取关于软件信息

获取客户端关于页面展示的软件基本信息、官方站点、团队信息与版权声明。

- **请求方法**：`GET`
- **请求路径**：`/api/config/about`
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
    "appName": "PisaMusic",
    "websiteLabel": "官方网站",
    "websiteUrl": "https://pisamusic.partialy.cn",
    "description": "简洁好用的跨平台多源音乐播放器",
    "team": "PisaMusic Team",
    "copyright": "Copyright © 2026 PisaMusic. All rights reserved."
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `appName` | `string` | 应用软件名称 |
| `websiteLabel` | `string` | 官网跳转按钮文案 |
| `websiteUrl` | `string` | 官网网址 |
| `description` | `string` | 应用简介 |
| `team` | `string` | 团队或开发者署名 |
| `copyright` | `string` | 版权所有声明 |
