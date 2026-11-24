# 获取侧栏动态菜单配置

用于 Android 客户端获取侧栏横栏入口与九宫格入口的公开配置（亦会随 `POST /api/config/startup` 冷启动聚合下发）。

- **请求方法**：`GET`
- **请求路径**：`/api/config/sidebar-menu`
- **需要鉴权**：无（默认走系统 AES-GCM 加密链路）

---

## 响应数据

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "listSection": {
      "enabled": true,
      "title": "其他",
      "items": [
        {
          "id": "activity-1",
          "sortOrder": 0,
          "name": "活动中心",
          "iconType": "svg",
          "iconValue": "<svg viewBox=\"0 0 24 24\">...</svg>",
          "badgeType": "dot_once",
          "subtitleText": "",
          "badgeVersion": 1,
          "openType": "web",
          "url": "https://example.com"
        }
      ]
    },
    "gridSection": {
      "enabled": true,
      "position": "top",
      "items": [
        {
          "id": "grid-1",
          "sortOrder": 0,
          "name": "歌单广场",
          "iconType": "preset",
          "iconValue": "link",
          "badgeType": "dot_always",
          "subtitleText": "",
          "badgeVersion": 1,
          "openType": "fullscreen_web",
          "url": "https://example.com/square"
        }
      ]
    },
    "updatedAt": 1700000000000
  },
  "success": true
}
```

### 字段说明

- `iconType`：`none`（仅横栏）| `image`（HTTPS 图片 URL）| `svg`（`<svg>` 源码）| `preset`（预置图标 key）
- `badgeType`：`none` | `text`（仅横栏）| `dot_once`（点击后本地消除）| `dot_always`（常驻红点）
- `badgeVersion`：一次性红点版本号，客户端按 `id:badgeVersion` 记录消除状态
- `openType`：`web`（带顶栏网页）| `fullscreen_web`（全屏无顶栏网页）
- `gridSection.position`：`top`（已有列表上方）| `bottom`（已有列表下方）
