import type { StartupWindowBridge, StartupWindowSnapshotPayload } from "../electron/startup/preload";
import {
  isCardlessStartupStyle,
  normalizeStartupAnimationStyle,
  type StartupAnimationStyle,
} from "../src/startup/startupAnimationOptions";
import { mountStartupLoadingStage } from "../src/startup/startupAnimationTemplates";

const bridge = (
  window as unknown as {
    startupWindowBridge?: StartupWindowBridge;
  }
).startupWindowBridge;

const agreementTitle = document.getElementById("agreement-title") as HTMLElement;
const agreementContent = document.getElementById("agreement-content") as HTMLElement;
const agreementVersion = document.getElementById("agreement-version") as HTMLElement;
const agreeButton = document.getElementById("agree-button") as HTMLButtonElement;
const rejectButton = document.getElementById("reject-button") as HTMLButtonElement;
const agreementCloseButton = document.getElementById("close-button") as HTMLButtonElement;
const loadingHost = document.getElementById("loading-stage-host") as HTMLElement;
const quitConfirmOverlay = document.getElementById("quit-confirm-overlay") as HTMLElement;
const quitCancelButton = document.getElementById("quit-cancel-button") as HTMLButtonElement;
const quitConfirmButton = document.getElementById("quit-confirm-button") as HTMLButtonElement;
const localModeBar = document.getElementById("local-mode-bar") as HTMLElement;
const localModeButton = document.getElementById("local-mode-button") as HTMLButtonElement;
const blockedOverlay = document.getElementById("blocked-overlay") as HTMLElement;
const blockedMessageEl = document.getElementById("blocked-message") as HTMLElement;
const blockedRetryButton = document.getElementById("blocked-retry-button") as HTMLButtonElement;
const blockedQuitButton = document.getElementById("blocked-quit-button") as HTMLButtonElement;

const initialQuery = new URLSearchParams(window.location.search);
let currentStyle: StartupAnimationStyle = normalizeStartupAnimationStyle(
  initialQuery.get("style"),
);
let currentLogoUrl = "";
let renderedStyle: StartupAnimationStyle | null = null;
let renderedLogoUrl = "";

function setQuitConfirmOpen(open: boolean) {
  quitConfirmOverlay.classList.toggle("is-open", open);
}

function applySurfaceTheme(dark: boolean) {
  const surface = dark ? "dark" : "light";
  loadingHost.dataset.surface = surface;
  document.body.dataset.surface = surface;
}

function syncOverlayStyle(mode: "agreement" | "loading", style: StartupAnimationStyle) {
  const isCardless = mode === "loading" && isCardlessStartupStyle(style);
  const isDarkModal =
    mode === "loading" &&
    (style === "vinyl-wave" || (isCardless && document.body.dataset.surface === "dark"));

  document.body.dataset.cardless = isCardless ? "1" : "0";
  quitConfirmOverlay.classList.toggle("is-dark", isDarkModal);
  quitConfirmOverlay.classList.toggle("is-cardless", isCardless);
  blockedOverlay.classList.toggle("is-dark", isDarkModal);
  blockedOverlay.classList.toggle("is-cardless", isCardless);
  localModeBar.classList.toggle("is-dark", isDarkModal);
}

function renderLoadingIfNeeded(force = false) {
  if (!force && renderedStyle === currentStyle && renderedLogoUrl === currentLogoUrl) {
    return;
  }
  renderedStyle = currentStyle;
  renderedLogoUrl = currentLogoUrl;
  mountStartupLoadingStage(loadingHost, {
    style: currentStyle,
    logoUrl: currentLogoUrl,
    showCloseButton: true,
    onCloseClick: () => setQuitConfirmOpen(true),
  });
}

function applySnapshot(snapshot: StartupWindowSnapshotPayload | null | undefined) {
  if (!snapshot) return;
  const mode = snapshot.mode === "agreement" ? "agreement" : "loading";
  document.body.dataset.mode = mode;

  if (typeof snapshot.darkAppearance === "boolean") {
    applySurfaceTheme(snapshot.darkAppearance);
  }
  if (snapshot.animationStyle) {
    currentStyle = normalizeStartupAnimationStyle(snapshot.animationStyle);
  }
  if (snapshot.logoUrl) {
    currentLogoUrl = snapshot.logoUrl;
  }
  if (snapshot.agreementTitle) {
    agreementTitle.textContent = snapshot.agreementTitle;
  }
  if (snapshot.agreementContent) {
    agreementContent.textContent = snapshot.agreementContent;
  }
  agreementVersion.textContent = snapshot.agreementVersion
    ? `（版本 ${snapshot.agreementVersion}）`
    : "";

  const blockedMessage = (snapshot.blockedMessage || "").trim();
  const isBlocked = mode === "loading" && blockedMessage.length > 0;
  blockedMessageEl.textContent = blockedMessage;
  blockedOverlay.classList.toggle("is-open", isBlocked);
  blockedRetryButton.disabled = false;

  const canEnterLocalMode =
    mode === "loading" && Boolean(snapshot.localModeAvailable) && !isBlocked;
  localModeBar.classList.toggle("is-visible", canEnterLocalMode);
  if (!canEnterLocalMode) {
    localModeButton.disabled = false;
  }

  syncOverlayStyle(mode, currentStyle);
  renderLoadingIfNeeded();
}

const initMode = initialQuery.get("mode") === "agreement" ? "agreement" : "loading";
document.body.dataset.mode = initMode;
applySurfaceTheme(initialQuery.get("dark") === "1");
syncOverlayStyle(initMode, currentStyle);
renderLoadingIfNeeded(true);

const unsubSnapshot = bridge?.onSnapshot((snapshot) => {
  applySnapshot(snapshot);
});

agreeButton.addEventListener("click", () => {
  bridge?.agree().catch(() => {});
});

rejectButton.addEventListener("click", () => {
  bridge?.reject().catch(() => {});
});

agreementCloseButton.addEventListener("click", () => {
  setQuitConfirmOpen(true);
});

quitCancelButton.addEventListener("click", () => {
  setQuitConfirmOpen(false);
});

quitConfirmButton.addEventListener("click", () => {
  quitConfirmButton.disabled = true;
  bridge?.quit().catch(() => {
    quitConfirmButton.disabled = false;
  });
});

localModeButton.addEventListener("click", () => {
  localModeButton.disabled = true;
  bridge?.enterLocalMode().catch(() => {
    localModeButton.disabled = false;
  });
});

blockedRetryButton.addEventListener("click", () => {
  blockedRetryButton.disabled = true;
  bridge?.retry().catch(() => {
    blockedRetryButton.disabled = false;
  });
});

blockedQuitButton.addEventListener("click", () => {
  blockedQuitButton.disabled = true;
  bridge?.quit().catch(() => {
    blockedQuitButton.disabled = false;
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && quitConfirmOverlay.classList.contains("is-open")) {
    setQuitConfirmOpen(false);
  }
});

window.addEventListener("beforeunload", () => {
  unsubSnapshot?.();
});

bridge?.ready();
