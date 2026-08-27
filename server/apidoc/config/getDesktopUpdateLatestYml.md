# 获取 PC 自动更新配置文件 (latest.yml)

供 Electron 客户端 `electron-updater` 使用的 generic feed 入口。请求该接口将 302 重定向到七牛云存储私有空间中签名的 `latest.yml` 临时下载地址。

- **请求方法**：`GET`
- **请求路径**：`/api/config/desktop-updates/:platform/:arch/latest.yml`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 操作系统平台，目前仅支持 `win32` |
| `arch` | `string` | 是 | 架构，目前仅支持 `x64` |

---

## 响应数据

- **HTTP 302 Found**：重定向到七牛云临时签名私有下载链接。
- **404 Not Found**（纯文本）：当未激活对应的 PC 自动更新版本或文件不存在时返回。
- **403 Forbidden**（纯文本）：服务处于停机维护状态时返回。
