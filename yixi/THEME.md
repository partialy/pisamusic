# 一夕音乐桌面端主题架构规范 (THEME.md)

本文档规范 `yixi` 桌面端的主题体系、分类模型、语义化 Token 及运行时管线。

---

## 1. 主题分类模型

主题体系严格遵循 **两个大类（背景模式）** 与 **三个子类（配色样式）** 的架构划分：

```
主题 (Theme)
 ├── 背景模式：颜色 (backgroundCategory: "color")
 │    ├── 浅色子类 (subClass: "color-light")
 │    └── 深色子类 (subClass: "color-dark")
 └── 背景模式：图片 (backgroundCategory: "image")
      └── 图片专属子类 (subClass: "image")
```

### 1.1 纯色模式 (`data-bg-mode="color"`)
- **浅色子类 (`data-theme="light"`)**：纯净高明度背景、深灰高对比度排版文字、浅色边框与浅色控件交互。
- **深色子类 (`data-theme="dark"`)**：沉浸低明度背景、高明度清晰排版文字、微透暗灰边框与深色卡片交互。

### 1.2 图片模式 (`data-bg-mode="image"`)
- **图片专属子类**：采用一套统一通透的中性毛玻璃配色风格（Neutral Translucent Frosted Glass）：
  - **单一样式**：不论用户上传或选择何种壁纸，样式规范统一，不再拆分两套。
  - **不脏染底色**：表面面板、卡片、列表行底色一律采用通透的中性黑色/深灰色半透明遮罩（`rgba(0,0,0,...)`），**严禁使用壁纸提取的主色（accent）混洗（color-mix）面板底色**，保持高保真通透质感。
  - **主色仅作点睛**：壁纸分析提取的强调色（Accent Color）仅用于重要文字高亮（`--text-accent`）、选中指示条与当前播放动画等点睛交互。
  - **高对比度文字**：排版文字固定采用高对比度中性白（`#ffffff`）及高清晰次级白（`rgba(255,255,255,0.72)`），确保在任何复杂壁纸下均具备清晰可读性。

---

## 2. 语义化 Token 契约

组件绝对不允许硬编码颜色或通过选择器分支（如 `.is-image-mode` 或 `[data-bg-mode]`）处理样式，一律使用语义化 CSS 变量：

### 2.1 排版文字 Token
- `--text-primary`: 主要标题与正文文本
- `--text-secondary`: 副标题、歌手名、辅助提示文本
- `--text-tertiary`: 弱化标签、极淡提示
- `--text-muted`: 失效、占位提示文字
- `--text-accent`: 品牌/当前主题强调文字（在图片模式下由壁纸主色驱动）
- `--text-on-accent`: 位于强调色色块上的反白文字

### 2.2 表面与容器 Token
- `--surface-app`: 视口根容器表面（纯色模式为实色底色，图片模式为透明）
- `--surface-shell`: 导航栏等容器遮罩
- `--surface-panel`: 播放控制条、侧边栏等通栏面板底色
- `--surface-card`: 独立卡片、列表块等次级容器底色
- `--surface-card-hover`: 卡片悬浮底色
- `--surface-modal`: 弹窗、模态对话框底色
- `--surface-input`: 输入框、推子轨道槽底色
- `--surface-hover`: 通用控件悬浮底色
- `--surface-control-hover`: 次级图标按钮悬浮底色
- `--surface-control-active`: 图标按钮激活底色

### 2.3 列表行与播放态 Token
- `--surface-row-hover`: 列表行鼠标悬浮底色
- `--surface-row-selected`: 列表行选中底色
- `--surface-row-playing`: 正在播放歌曲行底色
- `--border-row-selected`: 选中行边框色
- `--border-row-playing`: 正在播放行边框色

### 2.4 边框与阴影 Token
- `--border-subtle`: 细微描边分割线
- `--border-default`: 默认交互边框
- `--border-strong`: 强调边框
- `--border-modal`: 弹窗边框
- `--border-player`: 播放栏上边框
- `--shadow-card`: 卡片浮层阴影
- `--shadow-modal`: 弹窗模态阴影
- `--shadow-player`: 播放栏阴影

### 2.5 壁纸背景渲染 Token
- `--app-bg-image`: 背景图片 `url(...)`
- `--app-bg-blur-px`: 壁纸模糊度数值
- `--app-bg-brightness-factor`: 壁纸亮度缩放系数
- `--app-image-overlay`: 图片模式全局中性遮罩色（如 `rgba(0, 0, 0, 0.42)`）

---

## 3. 架构约束与守卫测试

1. **零分支原则**：
   - 业务组件（`src/components/*` 与 `src/views/*`）样式中**严禁包含 `.is-image-mode` 类名**。
   - 业务组件样式中**严禁出现 `[data-bg-mode` 属性选择器**。所有背景分类色值由 `src/styles/theme.color.css` 与 `src/styles/theme.image.css` 统一集中供给。
2. **架构守护测试**：
   - `src/theme/themeCssContract.test.ts` 会自动化静态扫描全部 Vue 组件与主题适配器样式，若有违规选择器或缺失 Token，测试将直接失败。
   - 运行测试命令：`pnpm --dir yixi test:theme`。

---

## 4. 运行时管线

```
ThemeStore (Pinia)
  │
  ├── 1. resolveThemeProfile(backgroundMode, themeMode, wall)
  │       └── 返回 ThemeProfile { backgroundCategory, subClass, contrastProfile, ... }
  │
  ├── 2. applyThemeRuntime(profile, state)
  │       ├── 根元素设置: [data-bg-mode="color|image"], [data-theme="light|dark"]
  │       └── 注入 CSS 变量: --app-bg-image, --app-bg-blur-px, --app-image-overlay 等
  │
  └── 3. naiveThemeAdapter(profile, accentColor)
          └── 计算 Naive UI GlobalTheme 及深浅色覆盖变量
```
