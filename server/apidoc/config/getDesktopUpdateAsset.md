# 下载 PC 自动更新资源文件

供 Electron 客户端 `electron-updater` 下载自动更新差异包（`.exe` 或 `.blockmap`）。请求该接口将 302 重定向到七牛云存储私有空间中签名的临时文件下载地址。

- **请求方法**：`GET`
- **请求路径**：`/api/config/desktop-updates/:platform/:arch/:fileName`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 操作系统平台，目前仅支持 `win32` |
| `arch` | `string` | 是 | 架构，目前仅支持 `x64` |
| `fileName` | `string` | 是 | 文件名（例如 `PisaMusic-Setup-1.5.0.exe` 或 `PisaMusic-Setup-1.5.0.exe.blockmap`，不得为 `latest.yml`） |

---

## 响应数据

- **HTTP 302 Found**：重定向到七牛云临时签名私有下载链接。
- **404 Not Found**（纯文本）：当资产不存在时返回。
- **403 Forbidden**（纯文本）：服务处于停机维护状态时返回。
