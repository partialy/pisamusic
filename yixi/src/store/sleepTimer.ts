import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAudioStore } from "./audio";

const PRESETS_STORAGE_KEY = "pm_sleep_timer_presets";
const STATE_STORAGE_KEY = "pm_sleep_timer_state";

const DEFAULT_PRESETS = [10, 20, 30, 45, 60];
const MAX_PRESETS = 8;
const MAX_MINUTES = 23 * 60 + 59; // 1439 分钟 (23小时59分)

function loadPresets(): number[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_MINUTES);
        if (valid.length > 0) {
          return Array.from(new Set(valid)).slice(0, MAX_PRESETS);
        }
      }
    }
  } catch (e) {
    console.error("加载定时关闭快捷时间失败:", e);
  }
  return [...DEFAULT_PRESETS];
}

function savePresets(presets: number[]) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error("保存定时关闭快捷时间失败:", e);
  }
}

type SavedTimerState = {
  targetTimestamp: number;
  durationMinutes: number;
  waitCurrentSong: boolean;
  isWaitingForSongEnd: boolean;
};

function saveState(state: SavedTimerState | null) {
  try {
    if (!state) {
      localStorage.removeItem(STATE_STORAGE_KEY);
    } else {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.error("保存定时关闭状态失败:", e);
  }
}

function loadState(): SavedTimerState | null {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedTimerState;
  } catch {
    return null;
  }
}

export const useSleepTimerStore = defineStore("sleepTimer", () => {
  const enabled = ref(false);
  const durationMinutes = ref(30);
  const targetTimestamp = ref(0);
  const remainingSeconds = ref(0);
  const waitCurrentSong = ref(false);
  const isWaitingForSongEnd = ref(false);
  const customPresets = ref<number[]>(loadPresets());

  let timerInterval: ReturnType<typeof setInterval> | null = null;

  const isActive = computed(() => enabled.value || isWaitingForSongEnd.value);

  const formattedRemaining = computed(() => {
    if (isWaitingForSongEnd.value) {
      return "播完即停";
    }
    const secs = remainingSeconds.value;
    if (secs <= 0) return "00:00";

    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  });

  const formattedRemainingFull = computed(() => {
    if (isWaitingForSongEnd.value) {
      return "倒计时已结束，等待当前歌曲播完";
    }
    const secs = remainingSeconds.value;
    if (secs <= 0) return "0秒";

    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}分`);
    parts.push(`${seconds}秒`);
    return parts.join("");
  });

  function startTick() {
    stopTick();
    timerInterval = setInterval(() => {
      tick();
    }, 1000);
  }

  function stopTick() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function tick() {
    if (!enabled.value) {
      stopTick();
      return;
    }

    const now = Date.now();
    const diff = Math.max(0, Math.ceil((targetTimestamp.value - now) / 1000));
    remainingSeconds.value = diff;

    if (diff <= 0) {
      handleTimeUp();
    }
  }

  function handleTimeUp() {
    stopTick();
    const audioStore = useAudioStore();

    if (waitCurrentSong.value && audioStore.isPlaying && audioStore.currentSong) {
      enabled.value = false;
      isWaitingForSongEnd.value = true;
      remainingSeconds.value = 0;
      saveState({
        targetTimestamp: targetTimestamp.value,
        durationMinutes: durationMinutes.value,
        waitCurrentSong: true,
        isWaitingForSongEnd: true,
      });
      window.$message?.info?.("定时倒计时已结束，将在当前歌曲播完后停止");
    } else {
      stopPlayback();
    }
  }

  function stopPlayback() {
    const audioStore = useAudioStore();
    audioStore.pause();
    cancelTimer(false);
    window.$message?.info?.("定时时间到，已停止播放");
  }

  function onSongEnded(): boolean {
    if (isWaitingForSongEnd.value) {
      const audioStore = useAudioStore();
      audioStore.pause();
      cancelTimer(false);
      window.$message?.info?.("当前歌曲已播完，已按定时计划停止播放");
      return true;
    }
    return false;
  }

  function startTimer(minutes: number, waitSong: boolean = false) {
    const validMinutes = Math.min(Math.max(1, Math.round(minutes)), MAX_MINUTES);
    const target = Date.now() + validMinutes * 60 * 1000;

    durationMinutes.value = validMinutes;
    targetTimestamp.value = target;
    remainingSeconds.value = validMinutes * 60;
    waitCurrentSong.value = waitSong;
    isWaitingForSongEnd.value = false;
    enabled.value = true;

    saveState({
      targetTimestamp: target,
      durationMinutes: validMinutes,
      waitCurrentSong: waitSong,
      isWaitingForSongEnd: false,
    });

    startTick();

    const hours = Math.floor(validMinutes / 60);
    const mins = validMinutes % 60;
    const timeStr = hours > 0 ? `${hours}小时${mins > 0 ? `${mins}分钟` : ""}` : `${mins}分钟`;
    const tipSuffix = waitSong ? "（播完整首后停止）" : "";
    window.$message?.success?.(`已开启定时关闭：${timeStr}${tipSuffix}`);
  }

  function cancelTimer(showMessage: boolean = true) {
    stopTick();
    enabled.value = false;
    isWaitingForSongEnd.value = false;
    remainingSeconds.value = 0;
    targetTimestamp.value = 0;
    saveState(null);

    if (showMessage) {
      window.$message?.info?.("已取消定时关闭");
    }
  }

  function addCustomPreset(minutes: number): boolean {
    const val = Math.round(minutes);
    if (val < 1 || val > MAX_MINUTES) {
      window.$message?.warning?.("快捷时间范围为 1 分钟 ~ 23小时59分");
      return false;
    }
    if (customPresets.value.includes(val)) {
      window.$message?.warning?.("该快捷时间已存在");
      return false;
    }
    if (customPresets.value.length >= MAX_PRESETS) {
      window.$message?.warning?.(`最多支持设置 ${MAX_PRESETS} 个自定义快捷时间`);
      return false;
    }

    const next = [...customPresets.value, val].sort((a, b) => a - b);
    customPresets.value = next;
    savePresets(next);
    window.$message?.success?.("添加快捷时间成功");
    return true;
  }

  function removeCustomPreset(minutes: number) {
    if (customPresets.value.length <= 1) {
      window.$message?.warning?.("至少保留 1 个快捷时间");
      return;
    }
    const next = customPresets.value.filter((m) => m !== minutes);
    customPresets.value = next;
    savePresets(next);
  }

  function resetPresets() {
    customPresets.value = [...DEFAULT_PRESETS];
    savePresets(customPresets.value);
    window.$message?.success?.("已恢复默认快捷时间");
  }

  // 初始化恢复运行态
  function initFromStorage() {
    const saved = loadState();
    if (!saved) return;

    if (saved.isWaitingForSongEnd) {
      isWaitingForSongEnd.value = true;
      waitCurrentSong.value = true;
      durationMinutes.value = saved.durationMinutes;
      targetTimestamp.value = saved.targetTimestamp;
      remainingSeconds.value = 0;
      enabled.value = false;
      return;
    }

    const now = Date.now();
    const diff = Math.max(0, Math.ceil((saved.targetTimestamp - now) / 1000));
    if (diff > 0) {
      durationMinutes.value = saved.durationMinutes;
      targetTimestamp.value = saved.targetTimestamp;
      remainingSeconds.value = diff;
      waitCurrentSong.value = Boolean(saved.waitCurrentSong);
      isWaitingForSongEnd.value = false;
      enabled.value = true;
      startTick();
    } else {
      saveState(null);
    }
  }

  initFromStorage();

  return {
    enabled,
    durationMinutes,
    targetTimestamp,
    remainingSeconds,
    waitCurrentSong,
    isWaitingForSongEnd,
    customPresets,
    isActive,
    formattedRemaining,
    formattedRemainingFull,
    startTimer,
    cancelTimer,
    addCustomPreset,
    removeCustomPreset,
    resetPresets,
    onSongEnded,
  };
});
