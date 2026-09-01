export type PlayerControlsVisibilityReason =
  | "tracking-started"
  | "pointer-moved"
  | "pointer-left-window"
  | "pointer-idle"
  | "window-unavailable"
  | "renderer-interaction";

export type PlayerControlsVisibilityEvent = {
  visible: boolean;
  pointerInside: boolean;
  reason: PlayerControlsVisibilityReason;
};
