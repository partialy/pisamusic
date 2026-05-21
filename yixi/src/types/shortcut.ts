export type ShortcutAction =
  | "prev"
  | "next"
  | "play-toggle"
  | "lyric-lock"
  | "lyric-unlock"
  | "favorite-song";

export type ShortcutSetting = {
  enabled: boolean;
  global: boolean;
  bindings: Record<ShortcutAction, string>;
};

export type ShortcutRegistrationResult = {
  action: ShortcutAction;
  accelerator: string;
  registered: boolean;
  reason?: string;
};
