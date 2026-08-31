# 账号手机号认证与请求加载状态改造计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为服务端、Android 登录/注册/找回密码和个人资料补齐手机号验证码能力，并让所有账号网络操作在等待期间显示统一 loading 动画。

**Architecture:** 服务端保留现有邮箱接口兼容，同时增加手机号验证码发送与手机号字段；验证码校验抽象为邮箱/短信双通道，登录、注册、重置密码和资料绑定共用同一套 purpose 校验。Android 将登录/注册/找回密码的账号通道统一为邮箱或手机号，按钮使用现有 `ic_loading_loop_24` 配合旋转动画；个人资料新增手机号绑定行，邮箱和手机号仅以脱敏值展示，编辑仍通过现有即时提交流程完成。

**Tech Stack:** Node.js/TypeScript/SQLite/Express、Android Kotlin/XML/ViewBinding/Hilt/Retrofit、Media3 风格的 `ObjectAnimator` loading 图标。

## Global Constraints

- 通知服务短信接口固定为 `POST /api/send/sms`，请求字段为 `{ phone, code, time }`；邮件接口继续使用 `POST /api/send/email`。
- 手机号按 11 位大陆手机号校验；邮箱继续使用现有邮箱格式校验。
- 现有邮箱接口路径和字段必须保持兼容；新增手机号能力不能破坏旧 Android/PC 客户端。
- 验证码有效期 5 分钟、同一用途同一账号发送冷却 60 秒；验证码只能使用一次。
- 公共用户资料不得返回密码等敏感字段；手机号加入账号资料 DTO 时只用于已登录用户资料展示与本人编辑。
- 为兼容现有 `users.email NOT NULL` 数据约束，纯手机号账号在库内使用不可登录的 `${phone}@phone.invalid` 占位邮箱，公开 DTO 将其序列化为空字符串；后续如需邮箱真正可空再单独做数据迁移。
- 邮箱和手机号展示统一脱敏为原始字符串前 3 位 + `******` + 后 2 位；编辑请求必须提交用户输入的完整新值，不能提交脱敏文本。
- loading 期间必须禁用当前操作及相关切换控件；成功、失败和取消页面时都恢复按钮文案、可点击状态和动画。
- 本轮不恢复旧的同步码账号流程，不改第三方 KG/WY 登录。
- 按项目约定同步更新 `server/apidoc/`、`server/apidoc/index.md`、`AGENTS.md` 或 `pm/AGENTS.md` 中受影响的契约说明。

---

### Task 1: 服务端账号字段与双通道验证码基础设施

**Files:**
- Modify: `server/src/db/appDb.ts`
- Modify: `server/src/db/userStore.ts`
- Create: `server/src/services/smsDeliveryService.ts`
- Modify: `server/src/services/emailCodeService.ts` (重命名逻辑保持现有导出兼容，内部抽象为 contact channel)
- Modify: `server/src/services/emailDeliveryService.ts`

**Interfaces:**
- `UserRecord` / `PublicUser` 新增 `phone: string | null`。
- `CreateUserInput` 支持 `phone?: string | null`。
- `UpdateUserProfileInput` 支持 `phone?: string | null`。
- 验证码服务提供 `sendContactCode(channel: "email" | "phone", contact: string, purpose: ContactCodePurpose)` 与 `verifyContactCode(...)`；保留 `sendEmailCode` / `verifyEmailCode` 包装函数供旧路由调用。
- `sendVerifyCodeSms(phone, code)` 使用通知服务 `/api/send/sms`，URL 从现有 `email.serviceUrl` 的 `/api/send/email` 同源替换为 `/api/send/sms`，继续复用 gateway 签名。

- [ ] **Step 1: 为 users 表增加手机号列和唯一索引**

在 `CREATE TABLE users` 增加 `phone TEXT UNIQUE`，在 `migrateUsers` 中用 `getColumnNames` 判断后执行 `ALTER TABLE users ADD COLUMN phone TEXT`，并创建 `idx_users_phone`；不得改写已有邮箱数据。

- [ ] **Step 2: 扩展 userStore 映射和资料更新**

让 `SELECT *` 映射读取 `phone`，`createUser` 写入空值或规范化手机号，`updateUserProfile` 在传入 `phone` 时更新手机号，`toPublicUser` 返回 `phone`；手机号为空统一序列化为 `null`。

- [ ] **Step 3: 抽象验证码缓存键并增加短信发送器**

将验证码缓存键从 `${purpose}:${email}` 改成 `${channel}:${purpose}:${contact}`，新增 `ContactCodePurpose = "register" | "login" | "profile_email" | "profile_phone" | "reset_password"`；短信发送 body 固定为 `{ phone, code, time: 5 }`，失败时返回通知服务的业务错误。

- [ ] **Step 4: 做服务端静态检查并提交**

运行 `pnpm --dir server exec tsc --noEmit` 或项目现有 TypeScript 构建命令，确认用户字段、短信服务和验证码服务类型一致后提交：

```bash
git add server/src/db/appDb.ts server/src/db/userStore.ts server/src/services/smsDeliveryService.ts server/src/services/emailCodeService.ts server/src/services/emailDeliveryService.ts
git commit -m "功能（server）：支持手机号验证码基础设施"
```

---

### Task 2: 服务端认证与资料接口

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/apidoc/user/sendEmailCode.md`
- Create: `server/apidoc/user/sendPhoneCode.md`
- Modify: `server/apidoc/user/loginByCode.md`
- Modify: `server/apidoc/user/register.md`
- Modify: `server/apidoc/user/resetPassword.md`
- Create: `server/apidoc/user/sendProfilePhoneCode.md`
- Modify: `server/apidoc/user/updateProfile.md`
- Modify: `server/apidoc/index.md`

**Interfaces:**
- 保留 `POST /api/auth/email-code` 原请求 `{ email, purpose }`。
- 新增 `POST /api/auth/phone-code`，请求 `{ phone, purpose }`，purpose 支持 `register | login | reset_password | profile_phone`。
- `POST /api/auth/login/code` 接受 `{ email?, phone?, code }`，email/phone 必须且只能提供一个；未注册联系人自动创建账号并返回标准 `{ token, expiresAt, user }`。
- `POST /api/auth/register` 接受 `{ email?, phone?, username, password, code }`，email/phone 必须且只能提供一个。
- `POST /api/auth/password/reset` 接受 `{ email?, phone?, code, newPassword }`。
- 新增受保护的 `POST /api/auth/profile/phone-code`，请求 `{ phone }`；`PATCH /api/auth/profile` 支持 `{ phone, code }`，使用 purpose `profile_phone`。

- [ ] **Step 1: 增加手机号规范化、校验和查找方法**

在 `auth.ts` 增加 `PHONE_RE = /^1\d{10}$/`、`normalizePhone`、`validatePhone`，并通过 `readUserByPhone`、`readUserByContact` 查找用户；所有联系人查找和唯一性判断都使用规范化值。

- [ ] **Step 2: 新增手机号验证码发送路由并保留邮箱路由**

邮箱路由继续走 `sendEmailCode`；手机号路由校验 purpose，注册时拒绝已注册手机号，登录/重置时对未注册手机号返回 404，资料绑定时拒绝当前手机号和已占用手机号，然后调用 `sendContactCode("phone", ...)`。

- [ ] **Step 3: 实现邮箱/手机号验证码登录与未注册自动注册**

验证码登录先验证联系人验证码；已有用户调用 `loginResult`。无用户时生成唯一用户名（优先取邮箱 `@` 前或手机号后 4 位，冲突时追加 6 位随机数字），生成随机不可登录密码哈希，创建用户并直接签发标准 token；响应字段与旧邮箱验证码登录完全一致。

- [ ] **Step 4: 扩展注册、重置密码、资料绑定**

注册和重置密码复用联系人验证码；资料手机号绑定先调用 `/profile/phone-code`，PATCH 时校验 `profile_phone`，与邮箱更新保持同一事务和 token 返回结构。资料更新无变化时继续返回当前 token。

- [ ] **Step 5: 更新接口文档并提交**

补充请求/响应、错误码、兼容规则和自动注册行为，更新索引链接后提交：

```bash
git add server/src/routes/auth.ts server/apidoc/user server/apidoc/index.md
git commit -m "功能（server）：支持手机号验证码认证与绑定"
```

---

### Task 3: Android 账号模型、API 和脱敏工具

**Files:**
- Modify: `pm/app/src/main/java/cn/partialy/pm/model/AccountModels.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/network/config/ConfigManager.kt`
- Modify: `pm/app/src/main/java/cn/partialy/pm/network/auth/AccountSessionStore.kt`
- Create: `pm/app/src/main/java/cn/partialy/pm/network/auth/AccountContactFormatter.kt`

**Interfaces:**
- `AccountUser.phone: String?`。
- `AccountPhoneCodeRequest(phone, purpose)`。
- `AccountCodeLoginRequest(email: String?, phone: String?, code: String)`。
- `AccountRegisterRequest(email: String?, phone: String?, username, password, code)`。
- `AccountPasswordResetRequest(email: String?, phone: String?, code, newPassword)`。
- `AccountProfilePhoneCodeRequest(phone)`。
- `ConfigManager.sendAccountPhoneCode`、`loginAccountByCode`、`registerAccount`、`resetAccountPassword`、`sendAccountProfilePhoneCode`、`updateAccountProfile` 使用上述 DTO。
- `maskAccountContact(value)` 返回前 3 位 + `******` + 后 2 位，空值返回“未绑定”。

- [ ] **Step 1: 扩展 DTO 和 session 持久化**

为 Gson/Retrofit DTO 增加可空 email/phone 字段；`AccountSessionStore` 新增 `phone` key，在 `read/save/updateUser/clear` 全链路同步。

- [ ] **Step 2: 增加 Retrofit 路由和 ConfigManager 包装**

新增 `POST api/auth/phone-code`、`POST api/auth/profile/phone-code`，更新登录/注册/重置/PATCH 方法签名；ConfigManager 继续统一 `systemCall`、错误码和中文错误文案。

- [ ] **Step 3: 添加脱敏格式化函数并提交**

用纯 Kotlin 函数覆盖手机号、邮箱和空值，加入静态检查后提交：

```bash
git add pm/app/src/main/java/cn/partialy/pm/model/AccountModels.kt pm/app/src/main/java/cn/partialy/pm/network/api/SystemApiService.kt pm/app/src/main/java/cn/partialy/pm/network/config/ConfigManager.kt pm/app/src/main/java/cn/partialy/pm/network/auth/AccountSessionStore.kt pm/app/src/main/java/cn/partialy/pm/network/auth/AccountContactFormatter.kt
git commit -m "功能（pm）：接入手机号认证接口与账号脱敏"
```

---

### Task 4: Android 登录页验证码登录、手机号登录和 loading

**Files:**
- Modify: `pm/app/src/main/res/layout/activity_login.xml`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/LoginActivity.kt`
- Modify: `pm/app/src/main/res/values/strings.xml`
- Create: `pm/app/src/main/java/cn/partialy/pm/ui/widget/LoadingTextButtonRenderer.kt`

**Interfaces:**
- 登录模式为 `PASSWORD`、`EMAIL_CODE`、`PHONE_CODE`；底部邮箱/手机/密码切换按钮继续沿用现有入口。
- `LoadingActionRenderer` 接收操作视图和原始文案，使用 `ic_loading_loop_24`、`ObjectAnimator` 旋转 loading 图标，提供 `show()` / `hide()`，不改变按钮尺寸。

- [ ] **Step 1: 将登录验证码输入区支持邮箱和手机**

手机模式将账号输入框切换为手机号 hint/inputType，邮箱模式保留邮箱校验；验证码模式显示发送按钮，密码模式隐藏验证码行；手机号模式调用 `sendAccountPhoneCode(phone, "login")`，邮箱模式调用旧接口。

- [ ] **Step 2: 接入验证码登录与 loading 状态**

点击发送验证码、密码登录、验证码登录时立即显示 loading；发送成功后恢复按钮并开始 60 秒倒计时，登录请求成功/失败都恢复状态。请求期间禁用输入、底部模式切换、注册和找回密码入口，避免重复请求。

- [ ] **Step 3: 复用现有 loading 图标并提交**

loading 图标使用 `ic_loading_loop_24`，只旋转图标区域，恢复时清理 animator；更新中文文案（手机号验证码登录、验证码登录、手机号校验错误）后提交：

```bash
git add pm/app/src/main/java/cn/partialy/pm/activity/LoginActivity.kt pm/app/src/main/java/cn/partialy/pm/ui/widget/LoadingActionRenderer.kt pm/app/src/main/res/layout/activity_login.xml pm/app/src/main/res/values/strings.xml
git commit -m "功能（pm）：支持手机号验证码登录并增加加载状态"
```

---

### Task 5: Android 注册与找回密码双通道

**Files:**
- Modify: `pm/app/src/main/res/layout/activity_account_assist.xml`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/AccountAssistActivity.kt`
- Modify: `pm/app/src/main/res/values/strings.xml`

**Interfaces:**
- `AccountAssistActivity` 模式仍为 `MODE_REGISTER` / `MODE_RESET`，新增 `ContactMode.EMAIL` / `ContactMode.PHONE`。
- 注册字段为联系人、用户名（仅注册）、密码、新密码（找回）、验证码；底部新增邮箱/手机切换按钮，样式复用登录页图标和选中态。

- [ ] **Step 1: 在注册/找回页增加邮箱/手机号底部切换**

根据 `ContactMode` 切换联系人输入框 hint/inputType、验证码 hint 和校验函数；注册/重置标题及副标题只按当前 mode 更新，不改变已有页面入口。

- [ ] **Step 2: 接入双通道发送和提交 loading**

发送按钮按联系人通道调用对应接口；注册提交调用可空 email/phone 的注册接口，找回提交调用可空 email/phone 的重置接口；所有网络等待阶段显示 loading，完成后恢复并保留倒计时。

- [ ] **Step 3: 处理验证码登录自动注册后的 session**

注册成功和验证码登录自动注册都沿用 `AccountSessionStore.save`、`SyncManager.startAccountSync`、`ListeningManager.onAccountAvailable`，确保新账号立即进入同步和听歌补传流程。

- [ ] **Step 4: 提交**

```bash
git add pm/app/src/main/java/cn/partialy/pm/activity/AccountAssistActivity.kt pm/app/src/main/res/layout/activity_account_assist.xml pm/app/src/main/res/values/strings.xml
git commit -m "功能（pm）：支持邮箱手机号注册与找回密码"
```

---

### Task 6: Android 个人资料绑定手机号与脱敏展示

**Files:**
- Modify: `pm/app/src/main/res/layout/activity_account_profile.xml`
- Reuse: `pm/app/src/main/res/layout/dialog_account_profile_edit_email.xml` for both contact types
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/AccountProfileActivity.kt`
- Modify: `pm/app/src/main/res/values/strings.xml`

**Interfaces:**
- 资料卡新增“绑定手机”行，点击进入手机号编辑弹窗；邮箱行继续可点击编辑。
- `AccountContactFormatter.mask` 只展示脱敏邮箱/手机号；发送验证码和提交更新都只使用弹窗中的完整输入。

- [ ] **Step 1: 增加手机号资料行和绑定弹窗**

在邮箱行下增加 `accountProfilePhoneRow/accountProfilePhoneValue`，弹窗结构复用邮箱弹窗：手机号输入、验证码输入、发送验证码按钮、取消/确认按钮。

- [ ] **Step 2: 改造邮箱/手机号展示为脱敏值**

`renderProfile()` 对 email/phone 调用统一脱敏函数；空手机号显示“未绑定”，邮箱仍显示已绑定状态；不得把脱敏文本回填到编辑输入框。

- [ ] **Step 3: 接入资料发送验证码与直接修改 loading**

邮箱调用现有 `/profile/email-code`，手机调用 `/profile/phone-code`；确认按钮调用同一个 PATCH profile，按更新字段携带 email 或 phone 和 code。发送按钮沿用现有禁用/倒计时状态，成功后保存新 token/user 并重新渲染脱敏资料。

- [ ] **Step 4: 提交**

```bash
git add pm/app/src/main/java/cn/partialy/pm/activity/AccountProfileActivity.kt pm/app/src/main/res/layout/activity_account_profile.xml pm/app/src/main/res/layout/dialog_account_profile_edit_phone.xml pm/app/src/main/res/values/strings.xml
git commit -m "功能（pm）：支持个人资料绑定手机号"
```

---

### Task 7: 文档、静态检查与交付

**Files:**
- Modify: `AGENTS.md`
- Modify: `pm/AGENTS.md`
- Modify: `server/apidoc/index.md` and affected auth API docs

- [ ] **Step 1: 更新项目契约说明**

记录手机号字段、双通道验证码、自动注册、资料脱敏规则和 Android loading 行为；说明通知服务 `/api/send/sms` 与现有邮件服务同源。

- [ ] **Step 2: 做轻量静态检查**

按用户偏好不运行复杂测试；只执行 `git diff --check`、`rg` 检查旧的“手机登录暂未实现”文案和所有 loading 状态恢复路径，服务端/Android 构建留给用户验收。

- [ ] **Step 3: 汇总分步提交**

列出 server、Android、文档各提交号；明确未执行运行时测试和设备验证。

---

## Self-review checklist

- 覆盖发送验证码 loading、登录 loading、注册 loading、找回密码 loading、资料发送验证码 loading、资料确认 loading。
- 覆盖邮箱/手机号验证码登录、未注册自动注册、邮箱/手机号注册、邮箱/手机号找回密码。
- 覆盖邮箱/手机号资料脱敏和手机号绑定，保持旧邮箱接口兼容。
- 通过 notify-service 文档确认短信字段为 `phone/code/time`，未把短信请求错误地发送到邮件路径。
