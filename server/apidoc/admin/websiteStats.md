# 官网域名统计

- `GET /api/admin/website-records/stats`
- 管理员 JWT + 既有端到端加密，聚合结果不返回 IP、visitor hash 或 User-Agent。

| 查询参数 | 说明 |
| --- | --- |
| `days` | 7、30、90，默认 30，包含今天，按北京时间自然日 |
| `domain` | 省略为全部；空字符串为未知域名；非空须为规范化域名，不含协议、端口和路径 |

`data` 返回：

```json
{
  "days": 7,
  "startDay": "2026-11-05",
  "endDay": "2026-11-11",
  "summary": { "uv": 1, "pv": 3, "downloads": 1, "androidDownloads": 1, "desktopDownloads": 0 },
  "trend": [{ "day": "2026-11-11", "uv": 1, "pv": 3, "downloads": 1, "androidDownloads": 1, "desktopDownloads": 0 }],
  "domains": [{ "domain": "music.example.com", "uv": 1, "pv": 3, "downloads": 1, "androidDownloads": 1, "desktopDownloads": 0 }],
  "topPages": [{ "path": "/listen/", "pv": 3 }]
}
```

示例趋势仅列一日；实际 `trend` 固定返回 days 项，缺失日补零。汇总、趋势、域名排行、页面排行使用同一数据库快照与筛选。域名排行按 UV、PV 降序；页面排行最多 20 条。空域名在 Admin 显示「未知域名」，无记录时返回零汇总及空排行。

`uv` 是各域名每日 UV 累加，同人跨域、跨日可重复，不是时间段内独立人数；与 Dashboard 口径一致。下载是有效客户端下载重定向触发次数，非安装或注册成功数。历史数据没有 PV，不伪造补齐。

非法参数返回 400，查询异常返回 500。记录列表日期筛选不影响统计标签独立的 7/30/90 天范围。
