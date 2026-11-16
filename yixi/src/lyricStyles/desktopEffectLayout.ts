import type { EffectGlyph, EffectLineLayout } from "./lyricStyleEffects";

interface DesktopEffectRun {
  text: string;
  x: number;
  width: number;
  startTimeMs: number;
  endTimeMs: number;
}

/** 旧桌面单行布局适配为共享二维布局，不改变原有测量与相机算法。 */
export function desktopEffectLayout(
  layout: { chars: DesktopEffectRun[]; runs: DesktopEffectRun[]; totalWidth: number },
  baselineY: number,
  height: number,
): EffectLineLayout {
  const convert = (run: DesktopEffectRun): EffectGlyph => ({
    text: run.text,
    x: run.x,
    y: baselineY,
    width: run.width,
    logicalX: run.x,
    startTimeMs: run.startTimeMs,
    endTimeMs: run.endTimeMs,
  });
  return {
    glyphs: layout.chars.map(convert),
    runs: layout.runs.map(convert),
    totalWidth: layout.totalWidth,
    width: layout.totalWidth,
    height,
  };
}
