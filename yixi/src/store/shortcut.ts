import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";
import electronAPI from "@/utils/electron";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { useAudioStore } from "./audio";
import { useCollectStore } from "./collect";
import { useLyricStore } from "./lyricStore";
import type {
  ShortcutAction,
  ShortcutRegistrationResult,
  ShortcutSetting,
} from "@/types/shortcut";

export type ShortcutActionMeta = {
  action: ShortcutAction;
  label: string;
  description: string;
};

export const SHORTCUT_SETTING_KEY = "app-shortcut-setting";

export const SHORTCUT_ACTIONS: ShortcutActionMeta[] = [
  { action: "prev", label: "上一曲", description: "播放列表中的上一首歌曲" },
  { action: "next", label: "下一曲", description: "播放列表中的下一首歌曲" },
  { action: "play-toggle", label: "播放 / 暂停切换", description: "切换当前播放状态" },
  { action: "lyric-lock", label: "锁定歌词", description: "锁定桌面歌词窗口" },
  { action: "lyric-unlock", label: "解锁歌词", description: "解除桌面歌词窗口锁定" },
  { action: "favorite-song", label: "收藏歌曲", description: "收藏或取消收藏当前播放歌曲" },
];

export const DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutAction, string> = {
  prev: "Ctrl+Alt+Left",
  next: "Ctrl+Alt+Right",
  "play-toggle": "Ctrl+Alt+Space",
  "lyric-lock": "Ctrl+Alt+L",
  "lyric-unlock": "Ctrl+Alt+Shift+L",
  "favorite-song": "Ctrl+Alt+F",
};

const DEFAULT_SHORTCUT_SETTING: ShortcutSetting = {
  enabled: false,
  global: false,
  bindings: { ...DEFAULT_SHORTCUT_BINDINGS },
};

export const useShortcutStore = defineStore("shortcut", () => {
  const setting = ref<ShortcutSetting>(createDefaultShortcutSetting());
  const loaded = ref(false);
  const registrationResults = ref<ShortcutRegistrationResult[]>([]);
  let listenersReady = false;
  let stopGlobalShortcutListener: (() => void) | null = null;

  const failedRegistrationResults = computed(() =>
    registrationResults.value.filter((item) => !item.registered)
  );

  async function init() {
    if (!loaded.value) {
      const record = await electronAPI.getSetting<Partial<ShortcutSetting>>(SHORTCUT_SETTING_KEY);
      setting.value = normalizeShortcutSetting(record?.value);
      loaded.value = true;
      if (!record?.value || shouldPersistNormalizedSetting(record.value)) {
        await persist();
      }
    }
    setupListeners();
    await applyShortcutSetting();
  }

  async function updateEnabled(value: boolean) {
    setting.value.enabled = Boolean(value);
    await persistAndApply();
  }

  async function updateGlobal(value: boolean) {
    setting.value.global = Boolean(value);
    await persistAndApply();
  }

  async function updateBinding(action: ShortcutAction, accelerator: string) {
    const normalized = normalizeShortcutAccelerator(accelerator);
    if (!normalized) {
      window.$message?.warning("快捷键需要包含一个非修饰键");
      return false;
    }
    const duplicateAction = findDuplicateAction(action, normalized);
    if (duplicateAction) {
      const duplicateMeta = SHORTCUT_ACTIONS.find((item) => item.action === duplicateAction);
      window.$message?.error(`快捷键已被“${duplicateMeta?.label || duplicateAction}”使用`);
      return false;
    }

    setting.value.bindings = {
      ...setting.value.bindings,
      [action]: normalized,
    };
    await persistAndApply();
    return true;
  }

  async function resetDefaults() {
    setting.value = createDefaultShortcutSetting();
    await persistAndApply();
  }

  async function applyShortcutSetting() {
    try {
      registrationResults.value = await electronAPI.applyShortcutSetting(toRaw(setting.value));
    } catch (error: any) {
      registrationResults.value = [];
      void electronAPI.reportError(error, {
        scope: "shortcut",
        action: "applyShortcutSetting",
      });
      window.$message?.error(error?.message || "快捷键注册失败");
    }
  }

  async function executeAction(action: ShortcutAction) {
    if (!setting.value.enabled) return;
    const player = useAudioStore();
    const lyric = useLyricStore();
    const collect = useCollectStore();
    // 全局/应用内快捷键统一走播放命令层，一起听模式下服从房间权限
    const playbackCommands = usePlaybackCommands();

    switch (action) {
      case "prev":
        playbackCommands.prev();
        break;
      case "next":
        playbackCommands.next();
        break;
      case "play-toggle":
        playbackCommands.togglePlayPause();
        break;
      case "lyric-lock":
        lyric.setDesktopLocked(true);
        break;
      case "lyric-unlock":
        lyric.setDesktopLocked(false);
        break;
      case "favorite-song":
        if (!player.currentSong) {
          window.$message?.info("当前没有可收藏的歌曲");
          return;
        }
        await collect.collectSong(player.currentSong);
        break;
    }
  }

  function setupListeners() {
    if (listenersReady) return;
    listenersReady = true;
    window.addEventListener("keydown", handleLocalKeydown, true);
    stopGlobalShortcutListener = electronAPI.onShortcutTrigger((action) => {
      void executeAction(action);
    });
  }

  function dispose() {
    window.removeEventListener("keydown", handleLocalKeydown, true);
    stopGlobalShortcutListener?.();
    stopGlobalShortcutListener = null;
    listenersReady = false;
  }

  function handleLocalKeydown(event: KeyboardEvent) {
    if (!setting.value.enabled || setting.value.global || event.repeat) return;
    if (isEditableTarget(event.target)) return;
    const accelerator = formatShortcutFromKeyboardEvent(event);
    if (!accelerator) return;
    const action = findActionByAccelerator(accelerator);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    void executeAction(action);
  }

  function findActionByAccelerator(accelerator: string) {
    const normalized = normalizeShortcutAccelerator(accelerator).toLowerCase();
    return SHORTCUT_ACTIONS.find(
      (item) => normalizeShortcutAccelerator(setting.value.bindings[item.action]).toLowerCase() === normalized
    )?.action;
  }

  function findDuplicateAction(action: ShortcutAction, accelerator: string) {
    const normalized = normalizeShortcutAccelerator(accelerator).toLowerCase();
    return SHORTCUT_ACTIONS.find(
      (item) =>
        item.action !== action &&
        normalizeShortcutAccelerator(setting.value.bindings[item.action]).toLowerCase() === normalized
    )?.action;
  }

  async function persistAndApply() {
    await persist();
    await applyShortcutSetting();
  }

  async function persist() {
    setting.value = normalizeShortcutSetting(setting.value);
    await electronAPI.setSetting(SHORTCUT_SETTING_KEY, toRaw(setting.value), 1);
  }

  return {
    setting,
    loaded,
    registrationResults,
    failedRegistrationResults,
    init,
    updateEnabled,
    updateGlobal,
    updateBinding,
    resetDefaults,
    applyShortcutSetting,
    executeAction,
    dispose,
  };
});

export function formatShortcutFromKeyboardEvent(event: KeyboardEvent) {
  const key = normalizeEventKey(event);
  if (!key) return "";

  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.metaKey) modifiers.push("Meta");
  if (!modifiers.length) return "";

  return [...modifiers, key].join("+");
}

export function normalizeShortcutAccelerator(value: unknown) {
  if (typeof value !== "string") return "";
  const parts = value
    .split("+")
    .map((part) => normalizeShortcutPart(part))
    .filter(Boolean);
  const key = parts.find((part) => !isModifierKey(part));
  if (!key) return "";
  const modifiers = ["Ctrl", "Alt", "Shift", "Meta"].filter((modifier) =>
    parts.includes(modifier)
  );
  return [...modifiers, key].join("+");
}

function createDefaultShortcutSetting(): ShortcutSetting {
  return {
    enabled: DEFAULT_SHORTCUT_SETTING.enabled,
    global: DEFAULT_SHORTCUT_SETTING.global,
    bindings: { ...DEFAULT_SHORTCUT_SETTING.bindings },
  };
}

function normalizeShortcutSetting(input?: Partial<ShortcutSetting> | null): ShortcutSetting {
  const bindings = { ...DEFAULT_SHORTCUT_BINDINGS };
  SHORTCUT_ACTIONS.forEach((item) => {
    const accelerator = normalizeShortcutAccelerator(input?.bindings?.[item.action]);
    if (accelerator) bindings[item.action] = accelerator;
  });
  return {
    enabled: Boolean(input?.enabled),
    global: Boolean(input?.global),
    bindings,
  };
}

function shouldPersistNormalizedSetting(input: Partial<ShortcutSetting>) {
  if (typeof input.enabled !== "boolean" || typeof input.global !== "boolean") return true;
  if (!input.bindings || typeof input.bindings !== "object") return true;
  return SHORTCUT_ACTIONS.some((item) => !normalizeShortcutAccelerator(input.bindings?.[item.action]));
}

function normalizeEventKey(event: KeyboardEvent) {
  if (event.key === "Control" || event.key === "Shift" || event.key === "Alt" || event.key === "Meta") {
    return "";
  }
  if (event.code === "Space" || event.key === " ") return "Space";
  if (event.key === "ArrowLeft") return "Left";
  if (event.key === "ArrowRight") return "Right";
  if (event.key === "ArrowUp") return "Up";
  if (event.key === "ArrowDown") return "Down";
  if (event.key === "Escape") return "Escape";
  if (/^F\d{1,2}$/.test(event.key)) return event.key;
  if (event.key.length === 1) return event.key.toUpperCase();
  return normalizeShortcutPart(event.key);
}

function normalizeShortcutPart(value: unknown) {
  if (typeof value !== "string") return "";
  const part = value.trim();
  const lower = part.toLowerCase();
  if (lower === "control" || lower === "ctrl") return "Ctrl";
  if (lower === "option" || lower === "alt") return "Alt";
  if (lower === "shift") return "Shift";
  if (lower === "command" || lower === "cmd" || lower === "meta" || lower === "super") return "Meta";
  if (lower === "space" || part === " ") return "Space";
  if (lower === "arrowleft" || lower === "left") return "Left";
  if (lower === "arrowright" || lower === "right") return "Right";
  if (lower === "arrowup" || lower === "up") return "Up";
  if (lower === "arrowdown" || lower === "down") return "Down";
  if (part.length === 1) return part.toUpperCase();
  return part;
}

function isModifierKey(value: string) {
  return value === "Ctrl" || value === "Alt" || value === "Shift" || value === "Meta";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export default useShortcutStore;
