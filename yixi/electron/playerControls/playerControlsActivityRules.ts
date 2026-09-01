import type {
  PlayerControlsVisibilityEvent,
} from "../../src/types/playerControls";

export const PLAYER_CONTROLS_IDLE_MS = 3000;
export const PLAYER_CONTROLS_SAMPLE_MS = 100;

export type DipPoint = { x: number; y: number };
export type DipRectangle = { x: number; y: number; width: number; height: number };

export type PlayerControlsActivityState = {
  visible: boolean;
  pointerInside: boolean;
  lastPoint: DipPoint | null;
  lastActivityAtMs: number;
};

export type PlayerControlsActivitySample = {
  point: DipPoint;
  bounds: DipRectangle;
  nowMs: number;
  windowAvailable: boolean;
};

export type PlayerControlsActivityTransition = {
  state: PlayerControlsActivityState;
  event: PlayerControlsVisibilityEvent | null;
};

export function isPointInsideWindow(point: DipPoint, bounds: DipRectangle): boolean {
  return (
    point.x >= bounds.x &&
    point.y >= bounds.y &&
    point.x < bounds.x + bounds.width &&
    point.y < bounds.y + bounds.height
  );
}

export function createPlayerControlsActivityState(
  point: DipPoint | null,
  nowMs: number
): PlayerControlsActivityState {
  return {
    visible: true,
    pointerInside: true,
    lastPoint: point,
    lastActivityAtMs: nowMs,
  };
}

export function reducePlayerControlsActivity(
  state: PlayerControlsActivityState,
  sample: PlayerControlsActivitySample
): PlayerControlsActivityTransition {
  if (!sample.windowAvailable) {
    if (state.visible || state.pointerInside) {
      return {
        state: {
          visible: false,
          pointerInside: false,
          lastPoint: sample.point,
          lastActivityAtMs: state.lastActivityAtMs,
        },
        event: {
          visible: false,
          pointerInside: false,
          reason: "window-unavailable",
        },
      };
    }
    return {
      state: {
        ...state,
        lastPoint: sample.point,
      },
      event: null,
    };
  }

  if (!isPointInsideWindow(sample.point, sample.bounds)) {
    if (state.visible || state.pointerInside) {
      return {
        state: {
          visible: false,
          pointerInside: false,
          lastPoint: sample.point,
          lastActivityAtMs: state.lastActivityAtMs,
        },
        event: {
          visible: false,
          pointerInside: false,
          reason: "pointer-left-window",
        },
      };
    }
    return {
      state: {
        ...state,
        lastPoint: sample.point,
      },
      event: null,
    };
  }

  // 指针在窗口内部
  const moved =
    !state.lastPoint ||
    state.lastPoint.x !== sample.point.x ||
    state.lastPoint.y !== sample.point.y;

  if (moved) {
    const wasVisible = state.visible;
    const nextState: PlayerControlsActivityState = {
      visible: true,
      pointerInside: true,
      lastPoint: sample.point,
      lastActivityAtMs: sample.nowMs,
    };

    return {
      state: nextState,
      event: wasVisible
        ? null
        : {
            visible: true,
            pointerInside: true,
            reason: "pointer-moved",
          },
    };
  }

  // 指针在窗口内但本周期未移动
  const idleTime = sample.nowMs - state.lastActivityAtMs;
  if (state.visible && idleTime >= PLAYER_CONTROLS_IDLE_MS) {
    return {
      state: {
        visible: false,
        pointerInside: true,
        lastPoint: sample.point,
        lastActivityAtMs: state.lastActivityAtMs,
      },
      event: {
        visible: false,
        pointerInside: true,
        reason: "pointer-idle",
      },
    };
  }

  return {
    state: {
      ...state,
      pointerInside: true,
      lastPoint: sample.point,
    },
    event: null,
  };
}
