# 通信规范与全局协议说明

本文档说明 PisaMusic 服务端（`server`）的全局通信规范、端到端加密机制、认证鉴权机制及通用响应格式。

---

## 1. 通用响应结构

服务端所有 JSON 响应统一采用如下数据格式（`ApiResponse<T>`）：

```typescript
interface ApiResponse<T> {
  code: number;      // 业务状态码：0 表示成功，负数或非 0 表示失败/错误
  msg: string;       // 提示信息或错误原因，成功时默认为 "ok"
  data: T | null;    // 响应业务数据，失败时为 null
  success: boolean;  // 快捷布尔状态：true 为成功，false 为失败
}
```

### 常用状态码约定

| 状态码 (`code`) | HTTP 状态码 | 说明 |
| :--- | :--- | :--- |
| `0` | `200` | 成功请求并正常返回数据 |
| `-1` | `400` / `500` | 通用错误 / 参数错误 / 业务处理失败 |
| `400` | `400` | 请求参数缺失、格式错误或校验不通过 |
| `401` | `401` | 认证失败（Token 无效、过期或加密校验未通过） |
| `403` | `403` | 权限不足或服务处于不可用维护状态 |
| `404` | `404` | 请求的资源不存在 |
| `409` | `409` | 资源冲突（例如重复 ID、重复房间号等） |
| `-233` | `200` / `403` | 系统停机维护或已关闭服务（`appAvailable = false`） |
| `500` | `500` | 服务端内部异常 |

---

## 2. 端到端 AES-GCM 加密协议

服务端具备全站流量端到端 AES-GCM-256 加密与防重放机制。

### 2.1 白名单机制
- **明文白名单路径**：无需加密，客户端直接发送明文 JSON 或 Form 请求，服务端直接返回明文 JSON。
  - 强制明文路径包括：`/api/health`、`/api/config/bootstrap`、`/api/config/releases`、`/api/config/release-files/*`、`/api/config/desktop-updates/*`、`/api/config/download/*`、`/api/config/discover`、`/api/analytics/site-visit`、`/api/listen-together/config`、`/api/shares/public/*`、`/discover/*`、`/static/*`、`/uploads/*` 等。
- **非白名单路径**：必须执行端到端加密通信。

### 2.2 请求加密信封协议
当访问非白名单路径时：
1. **请求头**：客户端生成 128 位十六进制随机全密钥字符串，放入 Header：`x-pm-random: <128位hex>`。
2. **请求 Payload 封装**：
   ```json
   {
     "ts": 1700000000000,
     "nonce": "32位随机UUID或字符串",
     "p": { /* 真实的业务参数对象 */ }
   }
   ```
   - `ts`：当前时间戳毫秒数，时间窗口为 ±5 分钟。
   - `nonce`：唯一防重放随机串（服务端 TTL 缓存校验）。
3. **加密为信封**：使用 `x-pm-random` 密钥对上述 JSON 进行 AES-256-GCM 加密，得到密文，作为外层 Body 发送：
   ```json
   {
     "isEnc": true,
     "encData": "<AES-GCM密文>"
   }
   ```
4. **响应解密**：
   - 服务端会在响应头中返回新生成的 `x-pm-random: <响应hex密钥>` 以及 `x-pm-enc-ver: 1`。
   - 响应 Body 为 `{ "isEnc": true, "encData": "<密文>" }`。
   - 客户端使用响应头中的 `x-pm-random` 解密 `encData`，再解析为标准 `ApiResponse<T>`。

---

## 3. 认证与鉴权机制

服务端支持以下两类 Token 鉴权：

### 3.1 用户 Token (User JWT)
- **获取方式**：通过 `/api/auth/login/password`、`/api/auth/login/code` 或 `/api/auth/register` 接口获取。
- **有效期**：7 天（可通过 `/api/auth/refresh` 刷新）。
- **传递方式**：HTTP Header `Authorization: Bearer <user_token>`。
- **作用范围**：用户资料修改、数据云同步、一起听房间创建、外链分享创建等。

### 3.2 管理员 Token (Admin JWT)
- **获取方式**：通过 `/api/admin/login` 获取。
- **有效期**：7 天。
- **传递方式**：HTTP Header `Authorization: Bearer <admin_token>`。
- **作用范围**：所有 `/api/admin/*` 管理端接口。

### 3.3 设备标识 Header (用于数据同步)
- 在调用 `/api/sync/*` 数据同步接口时，需在 Header 附带客户端设备标识：
  - `x-pm-device-id: <deviceId>` 或 `x-device-id: <deviceId>`。
