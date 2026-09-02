# 获取运行时策略配置

## 接口说明
- **URL**: `/api/admin/runtime-config`
- **Method**: `GET`
- **鉴权**: 管理员 JWT (`Authorization: Bearer <adminToken>`)
- **加密**: 走管理后台统一加密通信协议

## 请求参数
无

## 响应数据
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "items": [
      {
        "key": "security.releaseDownloadTtlSeconds",
        "value": 300,
        "defaultValue": 300,
        "group": "download_security",
        "groupLabel": "下载安全",
        "label": "安装包/更新下载链接有效期",
        "description": "通过官网/更新接口生成的七牛私有下载签名 URL 有效时长（秒）",
        "type": "number",
        "unit": "秒",
        "min": 60,
        "max": 3600,
        "adminEditable": true,
        "updatedAt": 1700000000000
      }
    ],
    "snapshot": {
      "security.releaseDownloadTtlSeconds": 300,
      "security.downloadRateLimitMaxRequests": 5
    }
  },
  "success": true
}
```
