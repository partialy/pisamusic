# Desktop Quality Unlock and VIP UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 PC 端完整展示 KG/WY 音质并按游客、普通账号、VIP 控制可用性，同时增加音质解锁反馈入口和限定范围的 VIP 标识、到期时间展示。

**Architecture:** 延续现有 `musicQualityPolicy.ts` 作为 renderer/main 共用的唯一音质权限策略，完整目录始终返回，策略只控制可用性、标签和排序；Electron main 继续在取链、缓存、下载前做权限归一化。普通账号点击受限音质时通过路由 query 进入设置“关于”，由关于页消费一次性请求并打开现有反馈弹窗。

**Tech Stack:** Electron 37、Vue 3.5、TypeScript 5.8、Pinia 3、Naive UI 2.42、electron-vite。

## Global Constraints

- 只修改 `yixi/`、根 `AGENTS.md`、`yixi/AGENTS.md` 和本计划文件，不修改 `pm/`、`server/`。
- 权益只认 PisaMusic 系统账号，不使用 KG/WY Cookie、第三方 VIP 或歌曲 `vip` 字段。
- 游客现有可用范围不变：KG 仅 `kg:128`；WY 仅 `wy-br:128000`、`wy-level:standard`。
- 普通账号现有可用范围不变：KG 为 `kg:128`、`kg:320`、`kg:high`；WY 为 `wy-br:128000`、`wy-level:standard`、`wy-level:higher`、`wy-level:exhigh`。
- VIP 有效条件保持 `loggedIn && vip === true && vipExpiresAt > Date.now()`；KW 保持全部开放。
- 所有音质列表按可用项在前、不可用项在后稳定排序，各组内部保留原 catalog 顺序。
- 点击普通账号受限项后提示文案必须为“请输入需求并提交，等待作者审核。”
- 按老大要求只做 `git diff --check` 和 `pnpm --dir yixi build:t`，不运行 Vitest/E2E、不启动、不安装、不打包。
- 本轮不自动提交 Git。

---

### Task 1: 完整展示音质并输出明确限制原因

**Files:**
- Modify: `yixi/src/musicQuality/musicQualityPolicy.ts`
- Modify: `yixi/src/components/player/MusicQualityPicker.vue`

**Interfaces:**
- `QualityAccessOption` 增加 `unlockRequired: boolean`，`badge` 支持 `"需登录" | "解锁"`。
- `MusicQualityPicker` 保留 `login-required`，新增 `unlock-required` 事件。

- [x] **Step 1:** 将 KG/WY 的 `getVisibleQualityOptions()` 改为始终基于完整 catalog 生成选项。
- [x] **Step 2:** 游客和普通账号分别用允许 key 集合计算 `enabled`、`loginRequired`、`unlockRequired` 与标签。
- [x] **Step 3:** 对结果做稳定分组，先返回可用项，再返回受限项。
- [x] **Step 4:** 选择器按限制原因分别触发登录或解锁事件，受限项不得更新 modelValue。

### Task 2: 普通账号受限音质跳转反馈

**Files:**
- Create: `yixi/src/composables/useQualityUnlockFeedback.ts`
- Modify: `yixi/src/components/player/PlayerBar.vue`
- Modify: `yixi/src/components/player/ControlPanel.vue`
- Modify: `yixi/src/components/player/DownloadSongDialog.vue`
- Modify: `yixi/src/components/setting/about/AboutSetting.vue`
- Modify: `yixi/src/components/about/AboutFeedbackDialog.vue`

**Interfaces:**
- `useQualityUnlockFeedback().openQualityUnlockFeedback()` 跳转 `/setting?tab=about&feedback=quality-unlock`。
- `AboutFeedbackDialog` 新增 `initialType?: "bug" | "suggestion" | "account" | "other"`。

- [x] **Step 1:** 新建组合式函数，集中管理音质解锁反馈路由，不在三个播放器组件复制 query。
- [x] **Step 2:** 播放条、播放器页和下载弹窗监听 `unlock-required`；下载弹窗跳转前关闭自身。
- [x] **Step 3:** 关于页监听一次性 `feedback=quality-unlock`，把弹窗初始类型设为 `account` 并显示指定 message。
- [x] **Step 4:** 关于页消费 query 后用 `router.replace()` 移除 `feedback`，避免刷新或切换 Tab 重复弹窗。
- [x] **Step 5:** 普通点击“意见反馈”仍以 `bug` 为默认类型，解锁入口才预选 `account`。

### Task 3: 展示 VIP 标识与到期时间

**Files:**
- Modify: `yixi/src/components/Header.vue`
- Modify: `yixi/src/views/user/ProfileView.vue`

**Interfaces:**
- 两处统一调用 `isSystemVipActive(userStore)`，不复制到期判断。

- [x] **Step 1:** Header 昵称尾部添加仅有效 VIP 可见的金色方块斜体 `V` 标识，并调整账号胶囊布局。
- [x] **Step 2:** 用户资料网格新增仅有效 VIP 可见的“特权到期时间”，值使用现有时间格式函数处理 `vipExpiresAt`。

### Task 4: 同步项目规则并做轻量检查

**Files:**
- Modify: `yixi/AGENTS.md`
- Modify: `AGENTS.md`

- [x] **Step 1:** 将旧“桌面端 VIP 完全隐式”规则更新为仅允许 Header 金色 V 和用户资料到期时间两处展示。
- [x] **Step 2:** 记录完整音质展示、游客“需登录”、普通账号“解锁”及反馈跳转契约。
- [x] **Step 3:** 运行 `git diff --check`，预期无空白错误。
- [x] **Step 4:** 运行 `pnpm --dir yixi build:t`；`vue-tsc`、main 与 preload 通过，renderer 因 Windows 无法打开自动生成的 `yixi/components.d.ts` 而中断，已单独复跑 `vue-tsc -b` 确认类型语法通过。
- [x] **Step 5:** 检查 `git status --short`，确保未修改 `pm/`、`server/`，并保留已有未提交文件。
