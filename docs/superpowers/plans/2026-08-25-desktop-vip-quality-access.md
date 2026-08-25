# Desktop VIP and Quality Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Android 已完成的 PisaMusic 系统账号 VIP 与 KG/WY 播放、下载音质权限同步到 `yixi/`，同时保持 VIP 为隐式功能，不在桌面端展示任何 PisaMusic VIP 标识。

**Architecture:** 服务端现有 `vip` / `vipExpiresAt` 继续作为唯一权益来源；Electron main 将字段保存在既有 `account-session` SQLite setting 中，renderer 仅用它计算音质菜单。音质 catalog 与权限矩阵放在无 Vue/Electron 依赖的共享纯模块中，renderer 用于展示和登录引导，main 在取链、媒体缓存建 key、下载任务落库前再次归一化，防止 IPC 或旧参数旁路。

**Tech Stack:** Electron 37、Vue 3.5、TypeScript 5.8、Pinia 3、Naive UI 2.42、Howler、electron-vite、SQLite。

## Global Constraints

- 本计划执行时只修改 `yixi/`、根 `AGENTS.md` 和 `yixi/AGENTS.md`；不得修改 `pm/` Android 代码、`server/`、数据库结构或后台页面。
- 保留用户已有的 `pm/app/build.gradle.kts` 改动，不回退、不暂存、不提交该文件。
- “登录”只指 PisaMusic 系统账号。不得使用 KG/WY Cookie 登录态、第三方账号 VIP、`Song.vip` 判断本功能权益。
- PisaMusic VIP 必须保持隐式：不显示 VIP 标签、到期时间、提示文案、设置入口或用户等级；现有 Header 灰色 `VIP` 标签也必须删除。
- KG/WY Cookie 仍只负责对应音源的直连取链；不得改变第三方 Cookie 登录、刷新和失败回退逻辑。
- KW 音质保持当前全部可见、全部可用和当前默认值，不受 PisaMusic 登录/VIP 影响。
- 用户退出、VIP 到期或后台撤销权益后，不强制中断已经播放的音频；从下一次切歌、切音质、重新取链或创建下载任务开始生效。
- 不删除已有高音质播放缓存和下载记录；只阻止非当前权益的新命中、新取链和新下载。
- 按老大要求以开发速度为主：不新增复杂测试、不运行 Vitest/E2E、不打包、不安装；只执行 `git diff --check` 和 `pnpm --dir yixi build:t`。
- 本轮执行完成后不自动提交 Git，等待老大手测确认。

---

## Required Behavior Matrix

| PisaMusic 账号状态 | WY 播放/下载 | KG 播放/下载 | KW |
|---|---|---|---|
| 未登录 | 显示 `128k`、`标准`、`较高`、`极高`；前两项可用，后两项灰色并带蓝色 `需登录` 标签 | 显示 `128`、`320`、`无损（high）`；仅 `128` 可用，后两项灰色并带蓝色 `需登录` 标签 | 保持当前行为 |
| 已登录普通账号 | 只显示并启用 `128k`、`标准`、`较高`、`极高` | 只显示并启用 `128`、`320`、`无损（high）` | 保持当前行为 |
| 已登录且 VIP 有效 | 恢复当前全部 12 项，全部可用、顺序不变 | 恢复当前全部 6 项，全部可用、顺序不变 | 保持当前行为 |

有效 VIP 的统一判定：

```ts
loggedIn === true &&
user.vip === true &&
Number.isFinite(user.vipExpiresAt) &&
user.vipExpiresAt! > Date.now()
```

普通/游客的安全回退：KG 使用 `kg:128`，WY 使用 `wy-level:standard`。VIP 无历史偏好时保留原默认 `kg:320` / `wy-level:exhigh`；KW 保留 `kw:exhigh`。

---

## File Structure

### Create

- `yixi/src/types/account.ts`：main/renderer 共用的 PisaMusic 账号 DTO 与实时 VIP 有效性纯函数。
- `yixi/src/musicQuality/musicQualityPolicy.ts`：完整音质 catalog、三档权限矩阵、精确 key 校验和安全回退。
- `yixi/electron/music/qualityAccess.ts`：读取 main 侧 `account-session`，把 IPC/下载入参归一化为当前账号允许的 canonical qualityKey。
- `yixi/src/composables/useAccountLoginDialog.ts`：统一打开现有 `LoginCard` 模态。
- `yixi/src/components/player/MusicQualityPicker.vue`：播放与下载复用的可点击受限音质列表。

### Modify

- `yixi/electron/system/systemClient.ts`
- `yixi/electron/music/quality.ts`
- `yixi/electron/music/musicService.ts`
- `yixi/electron/ipc/musicIpc.ts`
- `yixi/electron/mediaCache/index.ts`
- `yixi/electron/download/downloadService.ts`
- `yixi/src/types/electron.d.ts`
- `yixi/src/store/user.ts`
- `yixi/src/store/audio.ts`
- `yixi/src/utils/musicQuality.ts`
- `yixi/src/components/Header.vue`
- `yixi/src/components/player/PlayerBar.vue`
- `yixi/src/components/player/ControlPanel.vue`
- `yixi/src/components/player/DownloadSongDialog.vue`
- `yixi/AGENTS.md`
- `AGENTS.md`

`electron/preload.ts`、`electron/ipc/systemIpc.ts` 和 SQLite schema 不需要修改：现有账号 IPC 原样透传 session，`account-session` 本身是 JSON setting，可自然保存新增字段。

---

### Task 1: 扩展账号会话并彻底隐藏 PisaMusic VIP

**Files:**
- Create: `yixi/src/types/account.ts`
- Modify: `yixi/electron/system/systemClient.ts`
- Modify: `yixi/src/types/electron.d.ts`
- Modify: `yixi/src/store/user.ts`
- Modify: `yixi/src/components/Header.vue`

**Interfaces:**

```ts
export type AccountUser = {
  id: string;
  username: string;
  email: string;
  avatar: string;
  avatarKey: string;
  avatarUrl: string;
  createdAt: number;
  vip: boolean;
  vipExpiresAt: number | null;
};

export type AccountAuthResult = {
  token: string;
  expiresAt: number;
  user: AccountUser;
};

export type AccountSession = AccountAuthResult & { loggedIn: boolean };

export function isSystemVipActive(
  session: Pick<AccountSession, "loggedIn" | "user">,
  now?: number,
): boolean;
```

- [ ] **Step 1: 建立共享账号类型**

创建 `src/types/account.ts`，只包含类型和纯函数，不引入 Vue、Pinia、Electron 或 Node。`isSystemVipActive()` 必须同时检查登录态、`vip === true`、有限数字到期时间和严格晚于当前时间。

- [ ] **Step 2: 让 systemClient 持久化服务端 VIP 字段**

`electron/system/systemClient.ts` 改为导入共享 `AccountUser / AccountAuthResult / AccountSession`，删除本文件重复定义。更新：

- `emptyAccountSession()`：空用户固定为 `vip: false`、`vipExpiresAt: null`。
- `normalizeAccountAuthResult()`：`vip` 仅接受严格布尔 `true`；`vipExpiresAt` 仅保留有限且大于 0 的数字，否则归一化为 `null`。
- `saveAccountSession()` 与 `getAccountSession()` 继续使用 SQLite setting `account-session`，不新增表或 migration。
- 登录、注册、验证码登录、refresh、资料更新继续走现有保存路径，不新增 `/api/auth/me` 轮询。

旧版缓存没有 VIP 字段时必须自动按普通账号读取，不能导致启动异常。

- [ ] **Step 3: 同步 renderer IPC 类型与 Pinia 用户状态**

`src/types/electron.d.ts` 直接导入共享 `AccountUser / AccountSession`，删除重复声明。`src/store/user.ts` 的 `PMUserInfo` 改为共享 `AccountUser` 或等价别名，`emptyUser()` 补 `vip: false`、`vipExpiresAt: null`；`applySession()` 保留字段。

不要在 user store 新增可展示的 `vipLabel`、`vipText` 或静态缓存的 `vipActive` computed；到期判定必须在需要权益时调用纯函数并读取当前时间。

- [ ] **Step 4: 删除当前 Header 的可见 VIP UI**

在 `src/components/Header.vue` 删除：

- 模板 `.vip-tag`；
- `accountVipActive = computed(() => false)`；
- `.vip-tag` 及 `.active` 样式。

头像、用户名和账号下拉保持不变。不要把真实 VIP 字段重新接到 Header、资料页、“我的”页或设置页。

---

### Task 2: 建立 Android 对齐的共享音质权限策略

**Files:**
- Create: `yixi/src/musicQuality/musicQualityPolicy.ts`
- Modify: `yixi/src/utils/musicQuality.ts`
- Modify: `yixi/electron/music/quality.ts`

**Interfaces:**

```ts
export type QualitySource = "kg" | "wy" | "kw";
export type QualityAccessLevel = "guest" | "account" | "vip";

export type QualityAccessOption = MusicQualityOption & {
  enabled: boolean;
  loginRequired: boolean;
  badge?: "需登录";
};

export function getQualityAccessLevel(
  session: Pick<AccountSession, "loggedIn" | "user">,
  now?: number,
): QualityAccessLevel;

export function getVisibleQualityOptions(
  source: QualitySource,
  access: QualityAccessLevel,
): QualityAccessOption[];

export function isKnownQualityKey(
  source: QualitySource,
  qualityKey: string | null | undefined,
): boolean;

export function isQualityKeyAllowed(
  source: QualitySource,
  qualityKey: string | null | undefined,
  access: QualityAccessLevel,
): boolean;

export function normalizeQualityKeyForAccess(
  source: QualitySource,
  requestedKey: string | null | undefined,
  access: QualityAccessLevel,
): string;
```

- [ ] **Step 1: 把完整 catalog 移入纯策略模块**

从 `src/utils/musicQuality.ts` 移动当前 KG 6 项、WY 12 项、KW 3 项 catalog 到 `src/musicQuality/musicQualityPolicy.ts`。保留原 qualityKey，不改服务端取链参数：

- KG 普通集合：`kg:128`、`kg:320`、`kg:high`；`kg:flac` 仅 VIP 可见。
- WY 普通集合严格按 `wy-br:128000`、`wy-level:standard`、`wy-level:higher`、`wy-level:exhigh` 排序。
- VIP 返回当前完整 catalog 及当前原顺序。
- KW 始终返回当前完整 catalog。

普通/游客展示文案使用 `128k / 标准 / 较高 / 极高` 和 `128 / 320 / 无损（high）`；VIP 全集可保留当前详细 label。

- [ ] **Step 2: 实现可见、可用和回退规则**

`guest` 返回普通集合，但只启用：

- KG：`kg:128`；
- WY：`wy-br:128000`、`wy-level:standard`。

其余可见项设置 `enabled: false`、`loginRequired: true`、`badge: "需登录"`。`account` 返回普通集合且全部启用；`vip` 返回全集且全部启用。

对未知 key、越权 key 或缺失 key：

- 非 VIP KG → `kg:128`；
- 非 VIP WY → `wy-level:standard`；
- VIP KG/WY → 原默认 `kg:320` / `wy-level:exhigh`；
- KW → 保持 `kw:exhigh`。

- [ ] **Step 3: 保留 renderer 兼容入口并收紧 main key 解析**

`src/utils/musicQuality.ts` 改为从纯策略模块重导出或做薄适配，避免已有 import 全量迁移。`electron/music/quality.ts` 的 `parseQualityKey()` / `qualityKeyMatchesSource()` 必须依赖精确 catalog，不能继续接受任意 `kg:xxx`、`wy-level:xxx` 或任意码率。

---

### Task 3: 在 main 侧封死取链、缓存和下载旁路

**Files:**
- Create: `yixi/electron/music/qualityAccess.ts`
- Modify: `yixi/electron/music/musicService.ts`
- Modify: `yixi/electron/ipc/musicIpc.ts`
- Modify: `yixi/electron/mediaCache/index.ts`
- Modify: `yixi/electron/download/downloadService.ts`

**Interfaces:**

```ts
export function getCurrentQualityAccessLevel(): QualityAccessLevel;

export function normalizeMusicUrlParamsForCurrentAccount(
  params: MusicUrlParams,
): CanonicalMusicUrlParams;

export function normalizePlayableTrackForCurrentAccount(
  track: PlayableTrackPayload,
): CanonicalPlayableTrackPayload;
```

Canonical DTO 必须包含经过权限归一化的 `qualityKey`；KG/WY 的 `quality / br / level` 必须由该 key 重新解析，不能继续信任 renderer 原始字段。

- [ ] **Step 1: 创建 main 账号权益适配器**

`electron/music/qualityAccess.ts` 只通过 `getAccountSession()` 读取 PisaMusic `account-session`，调用共享 `getQualityAccessLevel()` 和 `normalizeQualityKeyForAccess()`。禁止读取 KG/WY Cookie、第三方 `isVip` 或歌曲 `vip` 字段。

- [ ] **Step 2: 将底层取链分成校验入口与可信内部函数**

在 `electron/music/musicService.ts` 中让公开 `resolveMusicUrl()` / `resolvePlayableUrl()` 先归一化，再调用只接收 canonical DTO 的内部取链函数。原 `quality / br / level` 仅作为 VIP/旧内部调用的兼容输入；普通账号和游客必须以 canonical qualityKey 重建参数。

KG/WY Cookie 优先直连、失败回退代理的现有流程保持不变。

- [ ] **Step 3: 两个 music IPC 都执行权限归一化**

`electron/ipc/musicIpc.ts` 同时覆盖：

- `music:resolve-url`；
- `music:resolve-playable-url`。

即使 renderer 手工构造 IPC payload，也只能得到当前账号允许的音质。

- [ ] **Step 4: 在生成媒体缓存身份前归一化**

`electron/mediaCache/index.ts` 必须先调用 `normalizePlayableTrackForCurrentAccount()`，再把 canonical track 交给 `MediaCacheManager.preparePlaybackUrl()`。确保 `source + songId + qualityKey` 使用实际音质：游客请求 `kg:high` 时应以 `kg:128` 建 key，不能把 128 音频写入 high 缓存身份。

不要修改缓存数据库 schema，不清理已有高音质缓存。

- [ ] **Step 5: 在下载任务快照和记录创建前归一化**

`electron/download/downloadService.ts` 的 `startDownloadTask()` 在生成 taskId、snapshot 和 `download_records` 前得到有效 qualityKey；后续取链、扩展名推断、元数据和数据库记录全部使用同一个有效 key。

游客/普通账号通过 IPC 传入隐藏或越权 key 时静默降级到安全档，不得出现“实际下载 128、记录却写 high/lossless”的不一致。

---

### Task 4: 复用音质选择器并实现点击受限项登录

**Files:**
- Create: `yixi/src/composables/useAccountLoginDialog.ts`
- Create: `yixi/src/components/player/MusicQualityPicker.vue`
- Modify: `yixi/src/components/Header.vue`
- Modify: `yixi/src/components/player/PlayerBar.vue`
- Modify: `yixi/src/components/player/ControlPanel.vue`
- Modify: `yixi/src/components/player/DownloadSongDialog.vue`

**Interfaces:**

```ts
export function useAccountLoginDialog(): {
  openAccountLogin: () => void;
};

// MusicQualityPicker.vue
type Props = {
  modelValue?: string;
  options: QualityAccessOption[];
  placement?: "top" | "bottom";
};

type Emits = {
  "update:modelValue": [qualityKey: string];
  "login-required": [];
};
```

- [ ] **Step 1: 抽取现有 PisaMusic 登录模态**

`useAccountLoginDialog.ts` 复用 `LoginCard` 和 `window.$modal.create()`。Header 登录按钮、两个播放音质入口、下载音质入口全部调用同一方法。登录成功仍由 `LoginCard` 调用 `userStore.setSession()` 并关闭模态。

- [ ] **Step 2: 创建可复用音质选择器**

`MusicQualityPicker.vue` 使用可控 value 和插槽作为 trigger，内部逐行展示音质。受限项必须：

- 文字置灰；
- 右侧显示固定蓝色 `需登录` 标签；
- 带 `aria-disabled="true"`；
- 仍可接收点击，点击只 emit `login-required`，不能 emit `update:modelValue`。

不要直接给受限行使用原生 `disabled` 或 Naive UI `disabled: true`，否则无法满足“点击后打开登录”的要求。蓝色标签使用明确的 info 蓝色（如 `#2080f0` 及其透明背景），不要跟随可能变色的主题主色。

- [ ] **Step 3: PlayerBar 与 ControlPanel 复用同一组件**

删除两处重复的 `n-dropdown` option 映射，改用共享策略得到当前账号的 `QualityAccessOption[]`，再交给 `MusicQualityPicker`：

- 可用项触发 `player.switchCurrentQuality()`；
- 受限项打开 PisaMusic `LoginCard`；
- 受限项不得改偏好、不得发取链 IPC；
- 登录成功后 Pinia session 更新，菜单无需重启即可变为普通账号可用集合；
- VIP 到期后下一次打开/点击菜单按当前时间重新计算。

- [ ] **Step 4: 下载弹窗复用同一选择器**

`DownloadSongDialog.vue` 不再让 `n-select v-model` 直接接收任意 key。打开弹窗时使用当前账号允许的有效偏好；受限项点击只打开 PisaMusic 登录模态并保持原选择。`confirmDownload()` 提交前再次调用共享策略校验，失败时不创建任务。

下载目录、下载任务和成功提示逻辑保持不变。

---

### Task 5: 让播放偏好随账号权益实时降级

**Files:**
- Modify: `yixi/src/store/audio.ts`
- Read-only verify: `yixi/src/store/listenTogether.ts`

- [ ] **Step 1: 让 audio store 使用当前系统账号权益**

`useAudioStore()` 读取 `useUserStore()`，但只通过共享纯函数计算 `QualityAccessLevel`。修改：

- `getPreferredQualityKey(source)`：返回当前账号允许的有效 key；已保存 key 越权时只在运行时回退，不覆盖 SQLite 原值。
- `setPreferredQualityKey(source, key)`：当前权益不允许时拒绝写入。
- `switchCurrentQuality(option)`：取链前再次校验，防止菜单打开后账号退出或 VIP 到期。
- `loadQualityPreference()`：只保留精确 catalog 中的已知 key，未知旧值丢弃。

不在登出或到期时删除用户原高音质偏好。用户之后重新登录/VIP 恢复时，可继续使用仍然有效的历史偏好。

- [ ] **Step 2: 确认所有播放入口复用有效 getter**

只读确认以下调用继续通过 `getPreferredQualityKey()`：

- `audio.ts` 普通播放/自动切歌；
- `listenTogether.ts` 一起听远端切歌；
- PlayerBar、ControlPanel 当前音质文案；
- DownloadSongDialog 初始下载音质。

不得在一起听 store 或其他页面复制一份权限矩阵。

---

### Task 6: 同步项目文档并做轻量语法检查

**Files:**
- Modify: `yixi/AGENTS.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 更新 yixi 模块规则**

在 `yixi/AGENTS.md` 的“播放音质与下载规则补充”增加：

- 权益只认 PisaMusic 系统账号；
- 三档 KG/WY 权限矩阵；
- VIP 实时到期判定且不展示；
- renderer 与 main 共用纯策略；
- main 必须在缓存 key 与下载记录生成前归一化；
- KG/WY Cookie 与系统 VIP 分离。

- [ ] **Step 2: 修正根项目账号契约说明**

在根 `AGENTS.md` 的账号公开字段中补充 `vip`、`vipExpiresAt`，注明它们只用于客户端内部权益判断，不得作为前端用户等级展示。

- [ ] **Step 3: 检查变更边界和语法**

```powershell
git -C E:\Projects\Project\pisamusic diff --check
pnpm --dir E:\Projects\Project\pisamusic\yixi build:t
git -C E:\Projects\Project\pisamusic status --short
```

Expected:

- `git diff --check` 无输出；
- Vue TypeScript 检查与 electron-vite build 通过；
- `pm/app/build.gradle.kts` 仍保持用户原改动且未被本计划触碰；
- 不出现 `server/`、`pm/` 业务代码、SQLite 运行库、日志、缓存、`out/` 或安装包改动；
- 不运行测试套件、不启动 Electron、不安装或打包。

---

## Handoff Checklist for 老大手测

执行代理只需把以下清单交给老大，不代替老大启动 App：

- 未登录打开 WY 播放和下载音质：仅 128k、标准可用；较高、极高灰色并带蓝色 `需登录`，点击打开 PisaMusic 登录模态。
- 未登录打开 KG 播放和下载音质：仅 128 可用；320、无损（high）灰色并带蓝色 `需登录`，点击打开 PisaMusic 登录模态。
- 普通 PisaMusic 账号登录后：WY 四项、KG 三项全部可用，额外音质隐藏。
- 有效 VIP 登录后：KG/WY 恢复当前全部音质且都可用。
- `vip=true` 但到期时间为空、无效或已过期时按普通账号处理。
- Header、资料页、我的页、设置页均不显示 PisaMusic VIP 或到期时间。
- 退出登录、VIP 到期后，下一次切歌/取链/下载会回退到安全音质；当前已播放音频不中断。
- 缓存和下载记录里的 qualityKey 与实际取链音质一致。
- KW 播放和下载音质行为与改动前一致。

