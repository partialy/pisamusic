# 发送换绑新手机号验证码

向新手机号发送资料换绑验证码。

- **请求方法**：`POST`
- **请求路径**：`/api/auth/profile/phone-code`
- **需要鉴权**：User Token
- **加密模式**：端到端加密

请求体：`{ "phone": "13800138000" }`。手机号必须为 11 位大陆手机号，且不能已绑定其他账号。验证码用于随后 `PATCH /api/auth/profile` 的 `phone` 字段。
