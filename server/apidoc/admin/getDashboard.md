# 获取仪表盘聚合数据

管理后台首页仪表盘数据接口，返回 7、30 或 90 天的时间序列与聚合统计（包含新增用户、日活设备、官网 UV、下载量趋势、Top 平台与版本分布等）。接口严格执行隐私脱敏，仅返回聚合汇总与零填充日序列，严禁返回单条 IP 或访客明细。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/dashboard`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `days` | `number` | 否 | 统计时间跨度天数，仅支持 `7`、`30`（默认）、`90` |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "rangeDays": 30,
    "overview": {
      "totalUsers": 1250,
      "newUsersPeriod": 180,
      "newUsersToday": 8,
      "totalAndroidDevices": 3400,
      "totalDesktopDevices": 1200,
      "activeAndroidDevicesToday": 850,
      "activeDesktopDevicesToday": 420,
      "siteVisitsPeriod": 15400,
      "siteVisitsToday": 520,
      "totalDownloads": 4800,
      "androidDownloads": 3500,
      "desktopDownloads": 1300,
      "downloadsToday": 110
    },
    "dailySeries": [
      {
        "date": "2026-08-01",
        "newUsers": 5,
        "totalUsers": 1075,
        "newAndroidDevices": 20,
        "newDesktopDevices": 8,
        "activeAndroidDevices": 600,
        "activeDesktopDevices": 300,
        "siteVisits": 480,
        "androidDownloads": 90,
        "desktopDownloads": 30
      }
    ],
    "distributions": {
      "androidVersions": [
        { "name": "2.1.0", "value": 720 },
        { "name": "2.0.5", "value": 130 }
      ],
      "desktopVersions": [
        { "name": "1.5.0", "value": 380 },
        { "name": "1.4.0", "value": 40 }
      ]
    }
  },
  "success": true
}
```
