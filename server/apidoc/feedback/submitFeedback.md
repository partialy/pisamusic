# 提交用户反馈

用户提交问题反馈、功能建议或使用咨询，支持上传最多 3 张截图（JPEG / PNG / WebP，单张 ≤ 5MB）及设备运行环境 JSON。

- **请求方法**：`POST`
- **请求路径**：`/api/feedback`
- **请求类型**：`multipart/form-data`
- **需要鉴权**：否（支持匿名或客户端携带联系方式）
- **加密模式**：明文白名单路径

---

## 请求参数

### Form Data (multipart/form-data)

| 表单字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `description` | `string` | 是 | 反馈问题描述（1-500 字） |
| `feedback_type` | `string` | 是 | 反馈类型，可选值：<br>• `bug`：功能异常<br>• `playback`：播放失败<br>• `ui`：界面展示问题<br>• `feature`：功能建议<br>• `other`：其他问题 |
| `contact` | `string` | 否 | 联系方式（QQ / 微信 / 邮箱） |
| `device` | `string` | 否 | 设备软硬件环境 JSON 字符串（品牌、型号、系统版本、应用版本等） |
| `images` | `File[]` | 否 | 截图文件数组（最多 3 张，支持 jpg / png / webp，单张 ≤ 5MB） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "提交成功",
  "data": {
    "id": "e4b1a134-8b6b-4e89-8d39-65231bfa2833",
    "createdAt": "2026-08-26T14:30:00.000Z"
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 服务端生成的反馈记录 UUID |
| `createdAt` | `string` | 提交时间 ISO 字符串 |

### 常见错误响应

```json
{
  "code": 400,
  "msg": "问题描述长度应为 1-500 字",
  "data": null,
  "success": false
}
```

- `400 问题描述长度应为 1-500 字`
- `400 无效的反馈类型`
- `400 仅支持 JPEG、PNG、WebP 图片`
- `400 单张图片不能超过 5MB`
- `400 最多上传 3 张图片`
