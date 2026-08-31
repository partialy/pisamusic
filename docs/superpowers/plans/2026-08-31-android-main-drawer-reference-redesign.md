# Android 侧拉栏视觉校正与定时关闭实施计划

**目标：** 按参考图收紧侧拉栏的行高、字号和间距，让账号箭头紧跟昵称；实现一个可持久化、到时暂停播放的 Android 定时关闭 Sheet。

**范围：** 仅修改 `pm/` 和本计划文档，不触碰工作区现有 `server/` 改动；继续在 `dev` 分支工作，不提交 Git。参考 PC 端定时关闭的快捷时长、自定义时长、剩余时间、更新和取消交互，但本轮不移植“播完整首再停止”和自定义预设管理。

## 任务 1：校正侧拉栏视觉

**文件：**
- `pm/app/src/main/res/layout/main_drawer_content.xml`

- [x] 账号昵称改为自然宽度并设置最大宽度，右尖括号紧跟昵称，长昵称省略但不挤掉右侧按钮。
- [x] 账号名、导入歌单、定时关闭均使用正常字重。
- [x] 功能行从 60dp 收紧到约 52dp，图标、字号、左右间距和卡片圆角按参考图调整。
- [x] 在定时关闭行右侧增加仅启用时显示的剩余时间文本。

## 任务 2：实现定时关闭状态与倒计时

**文件：**
- 新建 `pm/app/src/main/java/cn/partialy/pm/player/SleepTimerManager.kt`
- 新建 `pm/app/src/main/java/cn/partialy/pm/player/SleepTimerRules.kt`

- [x] 使用单例管理目标时间、剩余秒数和当前选择时长，并通过 `StateFlow` 向界面提供状态。
- [x] 使用独立 SharedPreferences 保存有效的目标时间和时长；进程恢复时继续未来的定时，过期记录只清理、不误暂停新播放。
- [x] 到时调用 `MusicController.pauseCurrent()`，随后清理定时状态。
- [x] 限制时长为 1 至 1439 分钟，提供统一的剩余时间和时长格式化规则。

## 任务 3：实现复用现有样式的 Sheet

**文件：**
- 新建 `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SleepTimerBottomSheet.kt`
- 新建 `pm/app/src/main/res/layout/bottom_sheet_sleep_timer.xml`
- 修改 `pm/app/src/main/res/values/strings.xml`

- [x] 使用现有 `BottomSheetDialog`、`bg_bottom_radius_sheet`、加减按钮图标和步进器背景。
- [x] 提供 10、20、30、45、60 分钟快捷选项与小时/分钟自定义步进器。
- [x] 已启用时显示实时剩余时间，并提供“更新定时”和“取消定时”；未启用时显示“开始定时”。
- [x] Sheet 关闭时停止界面观察，不泄漏 Activity 或协程。

## 任务 4：接入主界面并更新工程说明

**文件：**
- 修改 `pm/app/src/main/java/cn/partialy/pm/activity/MainActivity.kt`
- 修改 `pm/components.md`
- 修改 `pm/AGENTS.md`

- [x] 点击定时关闭入口先关闭侧拉栏，再打开 Sheet。
- [x] Activity 在可见生命周期内观察定时状态，只在启用时显示行尾剩余时间。
- [x] 更新组件索引和 Android 行为说明，去掉“定时关闭仅占位”的旧描述。

## 轻量验证

- [x] 运行 `processDebugResources`。
- [x] 运行 `compileDebugKotlin`。
- [x] 对纯规则运行一个聚焦单元测试；不启动 App、不跑完整测试套件或打包。
- [x] 运行 `git diff --check`，确认没有改动 `server/` 现有文件。

## 手工验收留给用户

- 账号箭头是否紧贴昵称，长昵称是否自然省略；所有侧栏文字是否为正常字重。
- 两条功能入口是否与参考图的密度、对齐和视觉节奏一致。
- Sheet 的快捷选择、自定义时间、开始、更新、取消和倒计时展示是否符合预期。
- 到时是否暂停当前播放，重启 App 后未来定时是否继续生效。

---

## 追加范围：完整歌曲停止与四档快捷配置

### 任务 5：建立歌曲自然结束事件

**文件：**
- 修改 `pm/app/src/main/java/cn/partialy/pm/player/PlayerEngine.kt`
- 修改 `pm/app/src/main/java/cn/partialy/pm/player/MusicController.kt`

**接口：** `PlayerEngine` 通过同步 `onSongEnded: () -> Boolean` 回调询问是否拦截自动续播；`MusicController.setSongEndedInterceptor` 由定时模块注册处理器。

- [x] 仅在 `MEDIA_ITEM_TRANSITION_REASON_AUTO`、`MEDIA_ITEM_TRANSITION_REASON_REPEAT` 或列表末尾 `STATE_ENDED` 时触发歌曲结束拦截；命中后不得继续下一首取链或自动播放。
- [x] 手动下一首、上一首、拖动进度和直接换歌不触发此事件。

### 任务 6：扩展定时状态与四档持久化配置

**文件：**
- 修改 `pm/app/src/main/java/cn/partialy/pm/player/SleepTimerRules.kt`
- 修改 `pm/app/src/main/java/cn/partialy/pm/player/SleepTimerManager.kt`
- 修改 `pm/app/src/test/java/cn/partialy/pm/player/SleepTimerRulesTest.kt`

**接口：** `startTimer(minutes, waitCurrentSong)`；状态增加 `waitCurrentSong`、`waitingForSongEnd` 与 `active`；`presets: StateFlow<List<Int>>` 固定包含四个 1～1439 分钟的槽位。

- [x] 默认快捷档位改为 `5 / 15 / 30 / 60`，保存时按槽位校验并持久化，读取异常值时回退对应默认值。
- [x] 倒计时结束且开关开启、播放器仍在播放时转入“等待本曲结束”，不立即暂停。
- [x] 收到自然结束事件后暂停播放并清理定时；未开启开关或倒计时结束时没有正在播放的歌曲则立即暂停并清理。
- [x] 进程恢复时保留未来倒计时及“等待本曲结束”状态。

### 任务 7：调整定时 Sheet 的开关与快捷胶囊

**文件：**
- 修改 `pm/app/src/main/res/layout/bottom_sheet_sleep_timer.xml`
- 修改 `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SleepTimerBottomSheet.kt`
- 修改 `pm/app/src/main/res/values/strings.xml`
- 修改 `pm/app/src/main/java/cn/partialy/pm/activity/MainActivity.kt`

- [x] 增加复用 `PmSwitch` 的“播完整首歌再停止”开关及说明，启动/更新定时时保存选择。
- [x] 快捷区每次读取四个持久化槽位并强制保持单行；选中胶囊以 `colorPrimary` 填充，未选中透明，选中/未选中均保留 primary 描边和完整胶囊圆角。
- [x] 等待歌曲结束时，Sheet 状态卡与侧栏行尾改为明确的等待文案，不显示 `00:00`。

### 任务 8：在播放设置中增加定时配置

**文件：**
- 修改 `pm/app/src/main/java/cn/partialy/pm/activity/PlaybackSettingsActivity.kt`
- 新建 `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SleepTimerPresetSettingsBottomSheet.kt`
- 新建 `pm/app/src/main/res/layout/bottom_sheet_sleep_timer_presets.xml`
- 修改 `pm/app/src/main/res/values/strings.xml`

- [x] 在“设置 → 播放设置”增加“定时配置”导航行，摘要显示当前四档。
- [x] 配置 Sheet 提供四个 Material 数字输入槽位，均限制为 1～1439 分钟，允许把任一默认档位改为如 90 分钟。
- [x] 保存后立即刷新播放设置摘要；下次打开定时 Sheet 时使用新配置。

### 任务 9：文档与轻量验证

**文件：**
- 修改 `pm/components.md`
- 修改 `pm/AGENTS.md`

- [x] 更新定时 Sheet、播放设置入口、自然结束事件和四档存储规则。
- [x] 运行聚焦规则测试、`processDebugResources`、`compileDebugKotlin` 与 `git diff --check`；不启动 App、不运行完整测试套件或打包。

### 任务 10：增加 KG / WY 第三方账号双列入口

**文件：**
- 修改 `pm/app/src/main/res/layout/main_drawer_content.xml`
- 修改 `pm/app/src/main/java/cn/partialy/pm/activity/MainActivity.kt`
- 修改 `pm/app/src/main/res/values/strings.xml`
- 修改 `pm/components.md`
- 修改 `pm/AGENTS.md`

**接口：** `MusicCookieManager.getCookie/getProfile/clearAll` 提供登录状态、头像昵称和清理；未登录 KG 进入 `PlaylistImportActivity.start(..., SongType.KG)`，未登录 WY 进入 `WyWebPlaylistLoginActivity.start(...)`。

- [x] 在导入行上方增加单行左右双列账号区，中间使用竖向分隔线；左侧固定 KG，右侧固定 WY。
- [x] 未登录列显示 K/Y 来源标签、“未登录”和紧随其后的右箭头，不显示头像；点击进入对应登录页。
- [x] 已登录列显示 K/Y 来源标签、圆形头像和单行省略昵称，不显示右箭头且不重复触发登录。
- [x] 两个来源均未登录时导入行显示“登录后可导入歌单”且隐藏清理按钮；任一来源登录时显示“导入歌单”和红色“清除登录”文本按钮。
- [x] 点击“清除登录”在 IO 线程调用 `MusicCookieManager.clearAll()`，刷新双列账号、导入行和我的页 WY 背景，不清理 PisaMusic 系统账号。
- [x] 同步组件索引和 Android 侧栏规则，运行 `processDebugResources`、`compileDebugKotlin` 与 `git diff --check`，不启动 App 或执行复杂测试。

### 任务 11：校正第三方账号基线与定时快捷圆形按钮

**文件：**
- 修改 `pm/app/src/main/res/layout/main_drawer_content.xml`
- 修改 `pm/app/src/main/res/layout/bottom_sheet_sleep_timer.xml`
- 修改 `pm/app/src/main/java/cn/partialy/pm/ui/dialog/SleepTimerBottomSheet.kt`
- 修改 `pm/app/src/main/res/values/strings.xml`
- 修改 `pm/components.md`
- 修改 `pm/AGENTS.md`

- [x] 第三方双列账号区增加 8dp 水平内边距，使左侧 K 标签与下方导入、定时图标的左缘对齐，并相应收紧已登录昵称最大宽度。
- [x] 删除定时 Sheet 的“快捷时间”标题和完整歌曲开关说明，只保留“播完整首歌再停止”开关标题。
- [x] 将“自定义时间”改为“自定义”。
- [x] 用四个等距圆形双行按钮替换 Chip：上方显示分钟数字，下方固定显示 `min`。
- [x] 未选中按钮使用透明背景、圆形中性色边框和中性色文字；选中按钮使用淡 primary 背景、primary 边框和 primary 文字。
- [x] 更新组件索引和 Android UI 规则，运行资源/Kotlin 聚焦编译与 `git diff --check`，不启动 App 或执行复杂测试。

### 任务 12：精简定时配置文案

**文件：**
- 修改 `pm/app/src/main/java/cn/partialy/pm/activity/PlaybackSettingsActivity.kt`
- 修改 `pm/app/src/main/res/values/strings.xml`

- [x] 播放设置的“定时配置”行移除说明文案，仅保留标题和当前四档数值。
- [x] 配置 Sheet 的说明改为“配置快捷定时按钮，1-1439分钟”。
- [x] 四个输入项由“快捷档位 N”简化为“档位 N”。
- [x] 运行资源/Kotlin 聚焦编译与差异检查，不启动 App 或执行复杂测试。
