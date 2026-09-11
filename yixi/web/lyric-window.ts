import type {
  DesktopLyricBounds,
  DesktopLyricClockSync,
  DesktopLyricPayload,
  DesktopLyricSettingV2,
  DesktopLyricSnapshot,
} from "../src/types/desktopLyric";
import { LyricCanvasRenderer } from "./desktopLyric/LyricCanvasRenderer";

const bridge = (window as unknown as { desktopLyricWindow?: import("../src/types/desktopLyric").DesktopLyricWindowBridge })
  .desktopLyricWindow;

const canvas = document.getElementById("lyric-canvas") as HTMLCanvasElement;
const liveRegion = document.getElementById("lyric-live") as HTMLElement;
const surface = document.getElementById("interaction-surface") as HTMLElement;
const playBtn = document.getElementById("play-btn") as HTMLElement;
const pauseBtn = document.getElementById("pause-btn") as HTMLElement;
const lockBtn = document.getElementById("lock-btn") as HTMLElement;
const lockIcon = document.getElementById("lock-icon") as HTMLElement;
const unlockIcon = document.getElementById("unlock-icon") as HTMLElement;

const renderer = new LyricCanvasRenderer(canvas, liveRegion);

let isLocked = false;
let currentSetting: DesktopLyricSettingV2 | null = null;
const unsubs: Array<() => void> = [];

function updatePlaying(isPlaying: boolean) {
  if (playBtn && pauseBtn) {
    playBtn.style.display = isPlaying ? "none" : "inline-flex";
    pauseBtn.style.display = isPlaying ? "inline-flex" : "none";
  }
}

function updateLocked(locked: boolean) {
  isLocked = locked;
  document.body.classList.toggle("locked", locked);
  if (lockIcon && unlockIcon) {
    lockIcon.style.display = locked ? "none" : "inline-block";
    unlockIcon.style.display = locked ? "inline-block" : "none";
  }
  if (lockBtn) {
    lockBtn.title = locked ? "解锁" : "锁定";
    lockBtn.setAttribute("aria-label", locked ? "解锁" : "锁定");
  }
  if (locked) {
    document.body.classList.remove("is-interactive");
  }
}

function applySnapshot(snapshot: DesktopLyricSnapshot) {
  if (!snapshot) return;
  currentSetting = snapshot.setting;
  renderer.setSetting(snapshot.setting);
  renderer.setLyric(snapshot.lyric);
  renderer.syncClock(snapshot.clock);
  updateLocked(snapshot.setting.locked);
  updatePlaying(snapshot.clock.isPlaying);
}

// Hover interaction
surface.addEventListener("pointerenter", () => {
  if (!isLocked) {
    document.body.classList.add("is-interactive");
  }
});

surface.addEventListener("pointerleave", () => {
  if (!isDragging && !isResizing) {
    document.body.classList.remove("is-interactive");
  }
});

// Control Buttons
document.getElementById("prev-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  bridge?.control("prev");
});
document.getElementById("next-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  bridge?.control("next");
});
playBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  bridge?.control("play");
});
pauseBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  bridge?.control("pause");
});
document.getElementById("close-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  bridge?.control("close");
});
lockBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  bridge?.setLocked(!isLocked);
});

document.getElementById("size-up")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!currentSetting) return;
  const next = Math.min(64, currentSetting.fontSize + 2);
  currentSetting = { ...currentSetting, fontSize: next };
  renderer.setSetting(currentSetting);
});

document.getElementById("size-down")?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!currentSetting) return;
  const next = Math.max(10, currentSetting.fontSize - 2);
  currentSetting = { ...currentSetting, fontSize: next };
  renderer.setSetting(currentSetting);
});

// Pointer-based Drag & Resize
let isDragging = false;
let dragStartScreenX = 0;
let dragStartScreenY = 0;
let dragStartX = 0;
let dragStartY = 0;

let isResizing = false;
let resizeDir = "";
let resizeStartScreenX = 0;
let resizeStartScreenY = 0;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;

let pendingBounds: DesktopLyricBounds | null = null;
let boundsRafId: number | null = null;

function scheduleBounds(bounds: DesktopLyricBounds) {
  pendingBounds = bounds;
  if (boundsRafId === null) {
    boundsRafId = requestAnimationFrame(() => {
      boundsRafId = null;
      if (pendingBounds) {
        bridge?.requestBounds(pendingBounds);
        pendingBounds = null;
      }
    });
  }
}

// Drag on surface
surface.addEventListener("pointerdown", (event) => {
  if (isLocked || event.button !== 0) return;
  if ((event.target as HTMLElement).closest("#controller, .resize-zone")) return;

  isDragging = true;
  dragStartScreenX = event.screenX;
  dragStartScreenY = event.screenY;
  dragStartX = window.screenX;
  dragStartY = window.screenY;

  try {
    surface.setPointerCapture(event.pointerId);
  } catch {}
});

surface.addEventListener("pointermove", (event) => {
  if (!isDragging) return;
  const dx = event.screenX - dragStartScreenX;
  const dy = event.screenY - dragStartScreenY;
  scheduleBounds({
    x: dragStartX + dx,
    y: dragStartY + dy,
    width: window.outerWidth,
    height: window.outerHeight,
  });
});

const stopDrag = (event: PointerEvent) => {
  if (!isDragging) return;
  isDragging = false;
  try {
    surface.releasePointerCapture(event.pointerId);
  } catch {}
  if (!surface.matches(":hover")) {
    document.body.classList.remove("is-interactive");
  }
};
surface.addEventListener("pointerup", stopDrag);
surface.addEventListener("pointercancel", stopDrag);

// Resize zones
document.querySelectorAll<HTMLElement>(".resize-zone").forEach((zone) => {
  zone.addEventListener("pointerdown", (event) => {
    if (isLocked || event.button !== 0) return;
    isResizing = true;
    resizeDir = zone.dataset.direction || "";
    resizeStartScreenX = event.screenX;
    resizeStartScreenY = event.screenY;
    resizeStartX = window.screenX;
    resizeStartY = window.screenY;
    resizeStartW = window.outerWidth;
    resizeStartH = window.outerHeight;

    try {
      zone.setPointerCapture(event.pointerId);
    } catch {}
    event.stopPropagation();
  });

  zone.addEventListener("pointermove", (event) => {
    if (!isResizing) return;
    const dx = event.screenX - resizeStartScreenX;
    const dy = event.screenY - resizeStartScreenY;

    let newW = resizeStartW;
    let newH = resizeStartH;
    let newX = resizeStartX;
    let newY = resizeStartY;

    if (resizeDir.includes("r")) {
      newW = Math.max(500, Math.min(1600, resizeStartW + dx));
    }
    if (resizeDir.includes("l")) {
      const targetW = Math.max(500, Math.min(1600, resizeStartW - dx));
      newX = resizeStartX + (resizeStartW - targetW);
      newW = targetW;
    }
    if (resizeDir.includes("b")) {
      newH = Math.max(100, Math.min(200, resizeStartH + dy));
    }
    if (resizeDir.includes("t")) {
      const targetH = Math.max(100, Math.min(200, resizeStartH - dy));
      newY = resizeStartY + (resizeStartH - targetH);
      newH = targetH;
    }

    scheduleBounds({ x: newX, y: newY, width: newW, height: newH });
  });

  const stopResize = (event: PointerEvent) => {
    if (!isResizing) return;
    isResizing = false;
    try {
      zone.releasePointerCapture(event.pointerId);
    } catch {}
    if (!surface.matches(":hover")) {
      document.body.classList.remove("is-interactive");
    }
  };
  zone.addEventListener("pointerup", stopResize);
  zone.addEventListener("pointercancel", stopResize);
});

// Window resize handling
function handleResize() {
  renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}
window.addEventListener("resize", handleResize);
handleResize();

// Bridge subscription
if (bridge) {
  unsubs.push(bridge.onSnapshot((snapshot) => applySnapshot(snapshot)));
  unsubs.push(
    bridge.onSetting((setting) => {
      currentSetting = setting;
      renderer.setSetting(setting);
      updateLocked(setting.locked);
    }),
  );
  unsubs.push(
    bridge.onLyric((lyric: DesktopLyricPayload) => {
      renderer.setLyric(lyric);
    }),
  );
  unsubs.push(
    bridge.onClock((clock: DesktopLyricClockSync) => {
      renderer.syncClock(clock);
      updatePlaying(clock.isPlaying);
    }),
  );
  bridge.ready();
}

window.addEventListener("beforeunload", () => {
  unsubs.forEach((unsub) => unsub());
  renderer.dispose();
});
