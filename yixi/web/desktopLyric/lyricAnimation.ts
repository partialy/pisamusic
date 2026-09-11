export interface LineTransitionState {
  oldLine: {
    y: number;
    alpha: number;
    scale: number;
  };
  newLine: {
    y: number;
    alpha: number;
    scale: number;
  };
}

export const LINE_TRANSITION_DURATION_MS = 240;

export function wordScale(progress: number, enabled: boolean): number {
  if (!enabled) return 1;
  const phase = Math.max(0, Math.min(1, progress));
  return 1 + 0.14 * Math.sin(Math.PI * phase);
}

export function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export function computeLineTransition(progress: number): LineTransitionState {
  const t = easeOutCubic(progress);

  return {
    oldLine: {
      y: -8 * t,
      alpha: Math.max(0, 1 - t),
      scale: 1 - 0.02 * t,
    },
    newLine: {
      y: 8 * (1 - t),
      alpha: Math.min(1, t),
      scale: 0.94 + 0.06 * t,
    },
  };
}

export function computeCameraTargetX(
  totalLineWidth: number,
  viewportWidth: number,
  currentWordCenterX: number,
): number {
  if (totalLineWidth <= viewportWidth) {
    return (viewportWidth - totalLineWidth) / 2;
  }

  const idealTx = viewportWidth / 2 - currentWordCenterX;
  const minTx = viewportWidth - totalLineWidth;
  const maxTx = 0;
  return Math.max(minTx, Math.min(maxTx, idealTx));
}

export function smoothCamera(
  current: number,
  target: number,
  deltaTimeMs: number,
  speed = 0.012,
): number {
  if (deltaTimeMs <= 0) return current;
  const factor = 1 - Math.exp(-speed * deltaTimeMs);
  return current + (target - current) * factor;
}
