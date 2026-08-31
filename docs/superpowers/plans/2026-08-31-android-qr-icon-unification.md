# Android 二维码图标统一与旧资源清理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一手机 App 中“展示二维码”和“扫描二维码”的资源命名与引用，并清理确认不再使用的旧图标。

**Architecture:** 保留现有 UI 与业务逻辑，只做 Android drawable 资源引用迁移。展示二维码统一使用 `ic_qr_code_24`，扫描二维码统一使用 `ic_scan_qrcode_24`；所有引用迁移完成后删除旧的 `ic_qr_code_placeholder_120` 与 `ic_qr_scan_24`，不改扫码流程、二维码生成逻辑或其他相似图标。

**Tech Stack:** Android XML VectorDrawable、Kotlin、XML ViewBinding/布局资源。

## Global Constraints

- 当前阶段只处理 `pm/` 手机端资源与引用，不修改 `server/`、`yixi/` 或 `example/`。
- 统一口径：展示二维码使用 `res/drawable/ic_qr_code_24.xml`；扫描二维码使用 `res/drawable/ic_scan_qrcode_24.xml`。
- 替换关系固定为：`ic_qr_code_placeholder_120` → `ic_qr_code_24`；`ic_qr_scan_24` → `ic_scan_qrcode_24`。
- 仅删除上述两项替换完成且无引用的旧资源，不删除 `ic_scan_radio_24`、`ic_kg_qr_*` 等语义不同的资源。
- 按用户要求不跑测试、不启动 App、不做真机/模拟器验证；只做静态引用核对，避免把构建产物纳入变更。
- 目标二维码资源当前已存在但尚未纳入 Git；实施时保留其现有 24dp vector 内容并作为统一资源提交。

---

### Task 1: 迁移展示二维码资源引用

**Files:**
- Modify: `pm/app/src/main/res/layout/bottom_sheet_share.xml`
- Modify: `pm/app/src/main/res/layout/include_playlist_import_kg_login.xml`
- Modify: `pm/app/src/main/java/cn/partialy/pm/activity/PlaylistImportActivity.kt`

**Interfaces:**
- Consumes: existing `R.drawable.ic_qr_code_24` resource.
- Produces: share preview、酷狗扫码登录占位与图片加载 fallback 全部引用同一个展示二维码资源。

- [x] **Step 1: Replace layout preview/placeholder references**

将以下引用逐一替换，保持控件尺寸、padding、scaleType 和可见性不变：

```xml
tools:src="@drawable/ic_qr_code_placeholder_120"
```

替换为：

```xml
tools:src="@drawable/ic_qr_code_24"
```

以及：

```xml
android:src="@drawable/ic_qr_code_placeholder_120"
```

替换为：

```xml
android:src="@drawable/ic_qr_code_24"
```

不在本任务中调整 `kg_qr_frame` 的 240dp 容器或分享二维码真实图片的 216dp 容器；目标 vector 的显示大小由现有 ImageView 尺寸、padding 和 `scaleType` 决定。

- [x] **Step 2: Replace Kotlin fallback references**

在 `PlaylistImportActivity.kt` 中将三个 `R.drawable.ic_qr_code_placeholder_120` 全部替换为 `R.drawable.ic_qr_code_24`，覆盖 Coil `placeholder`、`error` 和无头像时的 `setImageResource` 回退：

```kotlin
placeholder(R.drawable.ic_qr_code_24)
error(R.drawable.ic_qr_code_24)
b.kgQrUserAvatar.setImageResource(R.drawable.ic_qr_code_24)
```

- [x] **Step 3: Statically verify the old display name has no remaining reference**

Run:

```powershell
rg -n "ic_qr_code_placeholder_120" pm/app --glob '!build/**'
```

Expected: no output.

### Task 2: 迁移扫描二维码资源引用

**Files:**
- Modify: `pm/app/src/main/res/layout/layout_listen_together_bottom_sheet.xml`
- Modify: `pm/app/src/main/res/layout/main_drawer_content.xml`

**Interfaces:**
- Consumes: existing `R.drawable.ic_scan_qrcode_24` resource.
- Produces: 侧栏、一起听两个扫码入口和本地音乐扫描入口统一使用扫描二维码资源。

- [x] **Step 1: Replace XML scan icon references**

将 `layout_listen_together_bottom_sheet.xml` 中两个：

```xml
android:src="@drawable/ic_qr_scan_24"
```

以及 `main_drawer_content.xml` 中一个同名引用，全部替换为：

```xml
android:src="@drawable/ic_scan_qrcode_24"
```

保持原有 `ImageView` 尺寸、tint、contentDescription、点击事件和布局不变。

- [x] **Step 2: Confirm Kotlin scan icon is already canonical**

检查 `LocalMusicActivity.kt` 的扫码入口配置，当前已经是统一资源：

```kotlin
iconRes = R.drawable.ic_scan_qrcode_24
```

无需改动该 Kotlin 文件。

- [x] **Step 3: Statically verify the old scan name has no remaining reference**

Run:

```powershell
rg -n "ic_qr_scan_24" pm/app --glob '!build/**'
```

Expected: no output。

### Task 3: 删除旧资源并更新 Android 组件索引

**Files:**
- Delete: `pm/app/src/main/res/drawable/ic_qr_code_placeholder_120.xml`
- Delete: `pm/app/src/main/res/drawable/ic_qr_scan_24.xml`
- Modify: `pm/components.md` only if the icon replacement needs to be recorded in the existing component/resource index

**Interfaces:**
- Consumes: Tasks 1–2 的零引用静态结果。
- Produces: 工作区只保留两项统一资源名，组件索引不再描述已删除的旧资源。

- [x] **Step 1: Re-scan all Android source/resource references before deletion**

Run:

```powershell
rg -n "ic_qr_code_placeholder_120|ic_qr_scan_24" pm --glob '!build/**'
```

Expected: no output。若仍有引用，先迁移该引用，不直接删除资源。

- [x] **Step 2: Delete only the two superseded drawable files**

删除：

```text
pm/app/src/main/res/drawable/ic_qr_code_placeholder_120.xml
pm/app/src/main/res/drawable/ic_qr_scan_24.xml
```

保留：

```text
pm/app/src/main/res/drawable/ic_qr_code_24.xml
pm/app/src/main/res/drawable/ic_scan_qrcode_24.xml
```

- [x] **Step 3: Update the resource/component index only when necessary**

检查 `pm/components.md` 是否有旧文件名；当前索引只描述扫码页和二维码组件，没有列出这两个旧 drawable，因此默认不新增冗余条目。若实施过程中新增了可复用的资源说明，则在现有扫码页工具层条目中记录 canonical 名称：`ic_qr_code_24`（展示二维码）和 `ic_scan_qrcode_24`（扫描二维码）。

- [x] **Step 4: Final static cleanup check**

Run:

```powershell
rg -n "ic_qr_code_placeholder_120|ic_qr_scan_24" pm --glob '!build/**'
git status --short -- pm/app/src/main/res/drawable pm/app/src/main/res/layout pm/app/src/main/java/cn/partialy/pm/activity pm/components.md
```

Expected: 第一条命令无输出；状态中只出现两个新 canonical 资源、引用迁移文件、两个旧资源删除，以及必要的组件索引变更。按用户要求不运行 Gradle 测试或构建。

## Self-Review Checklist

- [x] 展示二维码的所有旧占位引用均已迁移到 `ic_qr_code_24`。
- [x] 扫描二维码的所有旧图标引用均已迁移到 `ic_scan_qrcode_24`。
- [x] 旧资源删除前已确认 `pm/` 无剩余引用。
- [x] 未误删音频/扫码页其他语义不同的图标。
- [x] 未修改业务逻辑、点击事件、尺寸或二维码生成协议。
- [x] 未运行测试或构建，符合用户当前要求。

## Follow-up: 侧拉“更多”按钮图标统一

- [x] 将 `pm/app/src/main/res/layout/main_drawer_content.xml` 中 `drawerMoreButton` 的图标从 `ic_apps_grid_24` 替换为 `ic_more_24`。
- [x] 保持按钮尺寸、文字、点击事件和 tint 不变；未修改其他“更多”菜单图标。

## Follow-up: 一起听二维码与无效图标清理

- [x] `listenTogetherScanJoinButton` 保持使用 `ic_scan_qrcode_24`，`listenTogetherQrButton` 改用 `ic_qr_code_24`。
- [x] 删除 `pm/app/src/main/res/drawable/` 下 21 个零引用旧图标：`ic_alarm_24`、`ic_apps_grid_24`、`ic_camera_16`、`ic_home_black_24dp`、`ic_login_input_24`、`ic_next_48`、`ic_pause_60`、`ic_pisa_piece_24`、`ic_play_60`、`ic_previous_48`、`ic_quality_selected_badge`、`ic_settings_row_cache_24`、`ic_settings_row_database_24`、`ic_settings_row_folder_24`、`ic_settings_row_image_24`、`ic_settings_row_label_24`、`ic_settings_row_text_rule_24`、`ic_settings_row_theme_24`、`ic_text_decrease_24`、`ic_text_increase_24`、`ic_zoom_in_24`、`ic_zoom_out_24`。
- [x] 清理后未发现已删除资源的残留引用；未删除启动图、空状态插图或一起听动画资源。

## 尺寸审计（等待确认）

- `ic_expand_more_24.xml`：intrinsic `48dp × 48dp`，名称为 24，属于需要确认的尺寸不一致图标；当前被搜索页 20dp ImageView 和首页 48dp FAB 共用。
- `ic_empty_128.xml`：`128dp × 128dp`，空状态插图，不按通用操作图标处理。
- `ic_listen_together_equalizer.xml`：`20dp × 20dp`，一起听专用动画图形，不按通用操作图标处理。
- `ic_launcher_background.xml`：`120dp × 120dp`；`ic_launcher_foreground.xml`：`108dp × 108dp`，启动图源资源，不按通用操作图标处理。
- 以上尺寸资源本轮未修改，等待老大确认后再决定是否统一或替换。
