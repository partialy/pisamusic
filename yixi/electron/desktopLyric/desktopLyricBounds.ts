import { DESKTOP_LYRIC_BOUNDS_LIMITS } from "../../src/desktopLyric/desktopLyricDefaults";
import type { DesktopLyricBounds } from "../../src/types/desktopLyric";

export interface DisplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  bounds: DisplayRect;
  workArea: DisplayRect;
  isPrimary?: boolean;
}

function calculateIntersectionArea(a: DisplayRect, b: DisplayRect): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) {
    return 0;
  }
  return (right - left) * (bottom - top);
}

export function constrainBounds(
  width: number,
  height: number,
): { width: number; height: number } {
  const clampedWidth = Math.max(
    DESKTOP_LYRIC_BOUNDS_LIMITS.minWidth,
    Math.min(DESKTOP_LYRIC_BOUNDS_LIMITS.maxWidth, Math.round(width)),
  );
  const clampedHeight = Math.max(
    DESKTOP_LYRIC_BOUNDS_LIMITS.minHeight,
    Math.min(DESKTOP_LYRIC_BOUNDS_LIMITS.maxHeight, Math.round(height)),
  );
  return { width: clampedWidth, height: clampedHeight };
}

export function resolveRestoredBounds(
  candidate: DesktopLyricBounds,
  displays: DisplayInfo[],
  overlayTaskbar: boolean,
): { x: number; y: number; width: number; height: number } {
  const { width, height } = constrainBounds(candidate.width, candidate.height);

  if (!displays || displays.length === 0) {
    return {
      x: candidate.x ?? 100,
      y: candidate.y ?? 100,
      width,
      height,
    };
  }

  const primaryDisplay = displays.find((d) => d.isPrimary) ?? displays[0];

  // If candidate x/y is not set, center on primary display's bottom
  if (candidate.x === null || candidate.y === null) {
    const area = overlayTaskbar ? primaryDisplay.bounds : primaryDisplay.workArea;
    const x = area.x + Math.max(0, Math.round((area.width - width) / 2));
    const y = area.y + Math.max(0, Math.round(area.height - height - 80));
    return { x, y, width, height };
  }

  const candidateRect: DisplayRect = {
    x: candidate.x,
    y: candidate.y,
    width,
    height,
  };

  // Find the display with the maximum intersection area
  let bestDisplay = primaryDisplay;
  let maxArea = 0;

  for (const display of displays) {
    const area = calculateIntersectionArea(candidateRect, display.bounds);
    if (area > maxArea) {
      maxArea = area;
      bestDisplay = display;
    }
  }

  const targetArea = overlayTaskbar ? bestDisplay.bounds : bestDisplay.workArea;

  // If there's negligible intersection (< 120 * 60 px), clamp candidate to target display bounds
  const minVisibleWidth = Math.min(120, width);
  const minVisibleHeight = Math.min(60, height);

  const minX = targetArea.x;
  const maxX = targetArea.x + Math.max(0, targetArea.width - minVisibleWidth);
  const minY = targetArea.y;
  const maxY = targetArea.y + Math.max(0, targetArea.height - minVisibleHeight);

  let finalX = candidate.x;
  let finalY = candidate.y;

  if (finalX < minX || finalX > maxX || maxArea < minVisibleWidth * minVisibleHeight) {
    finalX = Math.max(targetArea.x, Math.min(targetArea.x + targetArea.width - width, finalX));
  }

  if (finalY < minY || finalY > maxY || maxArea < minVisibleWidth * minVisibleHeight) {
    finalY = Math.max(targetArea.y, Math.min(targetArea.y + targetArea.height - height, finalY));
  }

  return {
    x: Math.round(finalX),
    y: Math.round(finalY),
    width,
    height,
  };
}
