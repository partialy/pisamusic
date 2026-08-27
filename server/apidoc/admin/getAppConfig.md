# 读取系统完整配置

读取管理后台所管理的系统全量配置信息（服务可用性、邮件发送通道、Bootstrap 端点与验签、双端版本发布、用户协议、隐私政策、关于软件与发现页等）。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/app-config`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "availability": {
      "appAvailable": true,
      "unavailableReason": "系统维护中，请稍后再试"
    },
    "email": {
      "serviceUrl": "https://gateway.partialy.cn/auth-service/api/send/email",
      "provider": "aliyun",
      "providers": [
        { "code": "aliyun", "name": "阿里云邮件" },
        { "code": "resend", "name": "Resend" }
      ]
    },
    "bootstrap": {
      "version": "1.0.0",
      "updatedAt": 1700000000000,
      "endpoints": {
        "kw_search": "https://gateway.partialy.cn/kw/search"
      },
      "gatewaySign": {
        "secret": "gateway_sign_secret_key",
        "as": "pmsign"
      },
      "updater": {
        "desktop": {
          "enabled": true,
          "feedBaseUrl": "https://pisamusic.partialy.cn/api/config/desktop-updates/win32/x64",
          "checkOnStartup": true,
          "startupDelayMs": 3000
        }
      }
    },
    "releases": {
      "android": {
        "latestVersion": "2.1.0",
        "updateTime": "2026-08-20",
        "forceUpdate": false,
        "downloadUrl": "/api/config/release-files/f_1/download",
        "officialUrl": "https://pisamusic.partialy.cn",
        "updateContent": "更新日志",
        "platformLabel": "Android",
        "fileSizeText": "45.8 MB",
        "available": true
      },
      "desktop": {
        "latestVersion": "1.5.0",
        "updateTime": "2026-08-22",
        "forceUpdate": false,
        "downloadUrl": "/api/config/release-files/f_2/download",
        "officialUrl": "https://pisamusic.partialy.cn",
        "updateContent": "更新日志",
        "platformLabel": "PC 桌面版",
        "fileSizeText": "89.2 MB",
        "available": true
      }
    },
    "agreement": {
      "title": "用户服务协议",
      "content": "协议正文..."
    },
    "privacy": {
      "title": "隐私政策",
      "content": "隐私政策正文..."
    },
    "about": {
      "appName": "PisaMusic",
      "websiteLabel": "官方网站",
      "websiteUrl": "https://pisamusic.partialy.cn",
      "description": "简洁音乐播放器",
      "team": "PisaMusic Team",
      "copyright": "Copyright © 2026 PisaMusic"
    },
    "discover": {
      "url": "https://pisamusic.partialy.cn/discover",
      "updatedAt": 1700000000000
    }
  },
  "success": true
}
```
