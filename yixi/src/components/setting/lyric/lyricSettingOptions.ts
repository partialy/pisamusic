const FONT_OPTIONS = [
  { label: "微软雅黑", value: "Microsoft YaHei" },
  { label: "黑体", value: "SimHei" },
  { label: "宋体", value: "SimSun" },
  { label: "楷体", value: "KaiTi" },
  { label: "仿宋", value: "FangSong" },
  { label: "隶书", value: "LiSu" },
  { label: "幼圆", value: "YouYuan" },
  { label: "等线", value: "DengXian" },
  { label: "苹方", value: "PingFang SC" },
  { label: "思源黑体", value: "Source Han Sans SC" },
  { label: "思源宋体", value: "Source Han Serif SC" },
  { label: "华文细黑", value: "STXihei" },
  { label: "华文楷体", value: "STKaiti" },
  { label: "华文宋体", value: "STSong" },
  { label: "华文仿宋", value: "STFangsong" },
  { label: "华文隶书", value: "STLiti" },
  { label: "华文彩云", value: "STCaiyun" },
  { label: "华文琥珀", value: "STHupo" },
  { label: "华文行楷", value: "STXingkai" },
  { label: "华文新魏", value: "STXinwei" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Georgia", value: "Georgia" },
];

export function getLyricFontOptions(current: string, desktop = false) {
  const options = desktop
    ? [{ label: "微软雅黑 UI", value: "Microsoft YaHei UI" }, ...FONT_OPTIONS]
    : [{ label: "跟随应用字体", value: "follow" }, ...FONT_OPTIONS];
  if (current && !options.some(option => option.value === current)) {
    options.push({ label: current, value: current });
  }
  return options;
}

export const PLAYER_SETTINGS_SECTIONS = [
  { label: "背景", value: "background" },
  { label: "排版与动效", value: "layout" },
  { label: "字体与颜色", value: "text" },
] as const;

export type PlayerSettingsSection = typeof PLAYER_SETTINGS_SECTIONS[number]["value"];
