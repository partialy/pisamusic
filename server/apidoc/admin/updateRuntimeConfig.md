# 批量修改运行时策略配置

## 接口说明
- **URL**: `/api/admin/runtime-config`
- **Method**: `PATCH`
- **鉴权**: 管理员 JWT (`Authorization: Bearer <adminToken>`)
- **加密**: 走管理后台统一加密通信协议

## 请求体
```json
{
  "changes": [
    {
      "key": "security.releaseDownloadTtlSeconds",
      "value": 600
    },
    {
      "key": "security.downloadRateLimitMaxRequests",
      "value": 10
    }
  ]
}
```

## 响应数据
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "items": [...],
    "snapshot": {...}
  },
  "success": true
}
```

## 错误说明
- `400`: 配置项不存在、只读项或越界校验失败（整批原子回滚，不写入数据库及内存）。
