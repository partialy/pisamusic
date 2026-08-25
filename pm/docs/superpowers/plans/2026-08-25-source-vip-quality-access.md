# 音源标签、隐式 VIP 与音质权限 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全局统一 KG/WY 单字母圆角方块标签，为 PisaMusic 系统账号增加后台可控的限时 VIP，并让播放、下载共用按游客/普通用户/VIP 分级的音质权限。

**Architecture:** 系统 VIP 只存外层 `server` 用户表，与 KG/WY 第三方登录完全分离；服务端统一计算有效 VIP 并通过现有公开用户 DTO 下发，Android 只持久化而不展示。Android 新增集中式音质策略，负责生成可见/可选列表并校验已保存的播放音质；两个音质弹窗只负责渲染策略结果。

**Tech Stack:** Kotlin 1.9.24、Android ViewBinding/Material、Node.js 22、TypeScript 6、SQLite、React 18、Vite。

## Global Constraints

- “登录”只指 PisaMusic 系统账号，不指 KG/WY 第三方音乐账号。
- 系统用户默认普通用户；VIP 必须启用且设置未来到期时间，不支持永久 VIP。
- 公开用户数据返回 `vip: boolean` 与 `vipExpiresAt: number | null`，Android 内部使用但任何客户端页面不得展示 VIP 文案或标识。
- 游客只显示普通用户档位：WY `128k / 标准 / 较高 / 极高`，其中前两项可用，后两项灰色并标记蓝色“需登录”；KG `128 / 320 / 无损（high）`，其中仅 128 可用，后两项灰色并标记“需登录”。
- 普通已登录用户可用上述 WY 四档与 KG 三档；其余现有档位隐藏。
- 有效 VIP 显示并可用改动前的全部 KG/WY 音质；KW 保持现状。
- 下载和播放必须调用同一音质权限策略；退出登录、后台取消 VIP 或 VIP 到期后，已保存的越权播放音质必须自动回退到该身份可用档位。
- KG/WY 可见来源标签全局统一为圆角方块 `K` / `Y`，侧拉栏必须复用 `SongSourceTagBinder`。
- 保留用户未提交的 `pm/app/build.gradle.kts` 修改，不暂存、不覆盖。
- 不新增复杂测试、不运行测试套件；只执行 TypeScript 构建、Android Kotlin 编译、资源/静态引用检查和 `git diff --check`。

---

## File Structure

- `server/src/db/appDb.ts`：用户 VIP 列及兼容迁移。
- `server/src/db/userStore.ts`：用户原始 VIP、公开有效 VIP 和独立权益更新方法。
- `server/src/db/adminUserStore.ts`、`server/src/routes/adminUsers.ts`：后台用户 VIP 查询、更新与校验。
- `server/admin/src/types/config.ts`、`server/admin/src/components/modals/UserEditModal.tsx`：后台 VIP 开关和必填到期时间。
- `pm/app/src/main/java/cn/partialy/pm/model/AccountModels.kt`、`network/auth/AccountSessionStore.kt`：Android 隐式账号权益。
- `pm/app/src/main/java/cn/partialy/pm/model/MusicQualityAccessPolicy.kt`：唯一音质可见性、可用性和降级规则。
- `pm/app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt`、`OptionPickerRows.kt`：灰色禁用行与“需登录”标签。
- `pm/app/src/main/java/cn/partialy/pm/activity/base/BaseDownloadActivity.kt`、`PlayerActivity.kt`、`player/MediaItemFactory.kt`：下载、播放和已保存音质接入统一策略。
- `pm/app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt`、`res/layout/main_drawer_content.xml`、`MainActivity.kt`：全局 `K` / `Y` 圆角方块。
- `pm/AGENTS.md`、根 `AGENTS.md`、`pm/design-html/components.md`：同步数据契约与 UI 规则。

---

### Task 1: 统一 KG/WY 来源标签

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/ui/widget/SongSourceTagBinder.kt`
- Modify: `app/src/main/res/layout/main_drawer_content.xml`
- Modify: `app/src/main/java/cn/partialy/pm/activity/MainActivity.kt`
- Modify: `app/src/main/res/values/strings.xml`

**Interfaces:**
- Produces: `SongSourceTagBinder.bind(TextView, SongType)` 对 KG/WY 统一渲染固定方形的 `K` / `Y`；侧拉栏只调用该入口。

- [ ] 将 Binder 的 KG/WY 文案分别改为 `K`、`Y`，仅这两种来源设置相同最小宽高、居中重力和现有圆角描边背景；KW/LOCAL 保持原矩形行为。
- [ ] 给侧拉栏两个标签增加 ViewBinding id，删除独立背景和专用 padding，在侧拉栏绑定阶段调用同一个 Binder。
- [ ] 删除不再使用的 `drawer_badge_kg/drawer_badge_wy` 文案引用；只有确认无引用时才删除旧 drawable。
- [ ] 运行 `rg -n "drawer_badge_kg|drawer_badge_wy|bg_drawer_badge_kg|bg_drawer_badge_wy" app/src`，确认无旧调用。
- [ ] 精确暂存 Task 1 文件并提交：`完善：统一音源单字母标签`。

---

### Task 2: 服务端和管理后台增加限时 VIP

**Files:**
- Modify: `../server/src/db/appDb.ts`
- Modify: `../server/src/db/userStore.ts`
- Modify: `../server/src/db/adminUserStore.ts`
- Modify: `../server/src/routes/adminUsers.ts`
- Modify: `../server/admin/src/types/config.ts`
- Modify: `../server/admin/src/components/modals/UserEditModal.tsx`

**Interfaces:**
- Produces: `PublicUser.vip: boolean`、`PublicUser.vipExpiresAt: number | null`、`updateUserVip(id, vipEnabled, vipExpiresAt)`；后台更新 payload 为 `{ username, email, vipEnabled, vipExpiresAt }`。

- [ ] 为 `users` 表增加 `vip_enabled INTEGER NOT NULL DEFAULT 0` 和 `vip_expires_at INTEGER`，并在 `migrateUsers()` 对已有库补列。
- [ ] 扩展 `UserRecord/UserRow/mapUserRow()`；`toPublicUser()` 使用 `vipEnabled && vipExpiresAt != null && vipExpiresAt > Date.now()` 计算 `vip`，同时返回原到期时间。
- [ ] 新增独立 `updateUserVip()`：关闭时写 `0/NULL`；开启时只接受未来毫秒时间戳，更新 `updated_at`。
- [ ] 扩展后台用户 SELECT、映射和 DTO，返回 `vipEnabled`、计算后的 `vip`、`vipExpiresAt`；`updateAdminUser()` 分别调用资料更新和权益更新。
- [ ] `normalizeUpdatePayload()` 接收 `vipEnabled/vipExpiresAt`；启用时要求未来时间，关闭时归一化为 `null`，并把这两个字段计入“存在可更新字段”判断。
- [ ] 管理后台类型同步字段；`UserEditModal` 增加 VIP 开关与 `datetime-local`，开启时未填未来时间不得保存，提交时转换为毫秒时间戳；列表和详情不新增 VIP 展示。
- [ ] 运行 `pnpm --dir ../server build` 与 `pnpm --dir ../server/admin build`，只检查 TypeScript/React 构建语法。
- [ ] 精确暂存 Task 2 文件并提交：`新增：后台限时VIP控制`。

---

### Task 3: Android 保存隐式 VIP 并集中定义音质策略

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/model/AccountModels.kt`
- Modify: `app/src/main/java/cn/partialy/pm/network/auth/AccountSessionStore.kt`
- Create: `app/src/main/java/cn/partialy/pm/model/MusicQualityAccessPolicy.kt`
- Modify: `app/src/main/java/cn/partialy/pm/model/DownloadQualityChoice.kt`

**Interfaces:**
- Produces: `AccountUser.vip/vipExpiresAt`、`Session.vipActive`、`MusicQualityAccessPolicy.optionsFor(type, session)`、`allowedChoiceOrFallback(type, choice, session)`。

- [ ] `AccountUser` 增加默认值 `vip=false`、`vipExpiresAt=null`；`AccountSessionStore` 在 read/save/updateUser 全链路保存字段，并提供实时 `vipActive = loggedIn && user.vip && expiresAt > now`。
- [ ] `DownloadQualityOption` 增加 `enabled: Boolean = true` 与 `badge: String? = null`，保留完整 KG/WY/KW 原始选项清单供 VIP 使用。
- [ ] 新建 `MusicQualityAccessPolicy`，按游客/普通账号/有效 VIP 返回策略列表；游客受限行使用 `enabled=false, badge="需登录"`，普通账号只返回普通档位，VIP 返回完整原始档位，KW 原样返回。
- [ ] 策略提供已保存音质校验：不可见或禁用的 choice 回退到 KG 128、WY standard、KW 原默认，避免注销或到期后继续使用高阶取链。
- [ ] 运行 `rg -n "downloadOptionsForSongType" app/src/main/java`，列出后续必须迁移的全部调用点。
- [ ] 精确暂存 Task 3 文件并提交：`新增：统一账号音质权限策略`。

---

### Task 4: 下载、播放和音质弹窗接入权限策略

**Files:**
- Modify: `app/src/main/java/cn/partialy/pm/ui/dialog/OptionPickerRows.kt`
- Modify: `app/src/main/res/layout/item_settings_option_sheet_row.xml`
- Modify: `app/src/main/java/cn/partialy/pm/ui/dialog/QualityPickerBottomSheet.kt`
- Modify: `app/src/main/java/cn/partialy/pm/activity/base/BaseDownloadActivity.kt`
- Modify: `app/src/main/java/cn/partialy/pm/activity/PlayerActivity.kt`
- Modify: `app/src/main/java/cn/partialy/pm/player/MediaItemFactory.kt`

**Interfaces:**
- Consumes: Task 3 的 `DownloadQualityOption.enabled/badge` 与 `MusicQualityAccessPolicy`。
- Produces: 两个弹窗一致的禁用行、右侧蓝色“需登录”标签以及提交前防越权校验。

- [ ] 扩展通用选项行绑定模型以支持 enabled 和右侧 badge；禁用行文字/选中图标变灰、不可点击，badge 使用主题蓝色浅底圆角样式。
- [ ] 播放与下载弹窗按 option 绑定，不再只传 label；默认选中项若不可用则选择首个 enabled 项，确认按钮永远不能返回禁用项。
- [ ] `BaseDownloadActivity` 和 `PlayerActivity` 读取 `AccountSessionStore.read(context)`，通过策略获得可见选项；下载/切换前再次检查 selected.enabled。
- [ ] `MediaItemFactory.savedPlaybackQualityChoice()` 用当前 Session 校验持久化 choice；越权时使用策略回退 choice，确保自动播放、缓存 key 和取链一致。
- [ ] 检查所有 `downloadOptionsForSongType` 旧调用已迁移或仅保留策略内部调用。
- [ ] 精确暂存 Task 4 文件并提交：`完善：限制播放与下载音质权限`。

---

### Task 5: 文档同步和轻量语法检查

**Files:**
- Modify: `AGENTS.md`
- Modify: `../AGENTS.md`
- Modify: `design-html/components.md`
- Modify: `docs/superpowers/plans/2026-08-25-source-vip-quality-access.md`

**Interfaces:**
- Produces: 后续开发可复用的账号 VIP 契约、音质策略边界和来源标签规则。

- [ ] 在根/Android `AGENTS.md` 记录系统 VIP 与第三方 VIP 分离、服务端有效期计算、Android 不展示、播放/下载必须走统一策略。
- [ ] 在 UI 索引记录 `SongSourceTagBinder` 的 K/Y 方块规则，以及音质选项行的禁用态/蓝色 badge 复用方式。
- [ ] 勾选本计划已完成任务，保留真机验收项未勾选。
- [ ] 运行 `pnpm --dir ../server build`、`pnpm --dir ../server/admin build`、`.\gradlew.bat compileDebugKotlin`、`git diff --check`。
- [ ] 运行静态检查：`rg -n "vip|vipExpiresAt|vip_enabled|vip_expires_at" app/src/main/java ../server/src ../server/admin/src`，确认契约贯通且 Android UI 无 VIP 展示代码。
- [ ] 精确暂存文档并提交：`文档：记录VIP与音质权限规则`。

---

## Manual Acceptance（由用户验证）

- [ ] 首页、搜索、歌单、播放器、播放队列和侧拉栏的 KG/WY 均显示同款 `K` / `Y` 圆角方块。
- [ ] 游客的受限普通音质为灰色，右侧显示蓝色“需登录”，点击不可选。
- [ ] 普通系统账号登录后可用 WY 四档、KG 三档，但看不到其他 VIP 档位。
- [ ] 后台设置未来到期 VIP 后，重新登录/刷新账号即可看到并使用全部原有音质，但 App 不显示任何 VIP 标识。
- [ ] VIP 到期、后台关闭 VIP 或退出系统账号后，已保存的高阶播放音质自动回退。
