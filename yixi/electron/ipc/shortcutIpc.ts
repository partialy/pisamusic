import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import type {
  ShortcutAction,
  ShortcutRegistrationResult,
  ShortcutSetting,
} from "../../src/types/shortcut";

let registered = false;
const registeredAccelerators = new Set<string>();

export function setupShortcutIpc(getMainWindow: () => BrowserWindow | null) {
  if (registered) return;
  registered = true;

  ipcMain.handle("shortcut:apply", (_event, setting: ShortcutSetting) => {
    return applyGlobalShortcuts(setting, getMainWindow);
  });

  app.once("will-quit", unregisterGlobalShortcuts);
}

function applyGlobalShortcuts(
  setting: ShortcutSetting,
  getMainWindow: () => BrowserWindow | null
): ShortcutRegistrationResult[] {
  unregisterGlobalShortcuts();
  if (!setting?.enabled || !setting.global) return [];

  return Object.entries(setting.bindings).map(([action, accelerator]) =>
    registerShortcut(action as ShortcutAction, accelerator, getMainWindow)
  );
}

function registerShortcut(
  action: ShortcutAction,
  accelerator: string,
  getMainWindow: () => BrowserWindow | null
): ShortcutRegistrationResult {
  const normalizedAccelerator = String(accelerator || "").trim();
  if (!normalizedAccelerator) {
    return {
      action,
      accelerator: normalizedAccelerator,
      registered: false,
      reason: "快捷键为空",
    };
  }

  try {
    const registeredShortcut = globalShortcut.register(normalizedAccelerator, () => {
      getMainWindow()?.webContents.send("shortcut:trigger", action);
    });
    if (registeredShortcut) {
      registeredAccelerators.add(normalizedAccelerator);
      return {
        action,
        accelerator: normalizedAccelerator,
        registered: true,
      };
    }
    return {
      action,
      accelerator: normalizedAccelerator,
      registered: false,
      reason: "快捷键可能已被系统或其他应用占用",
    };
  } catch (error) {
    return {
      action,
      accelerator: normalizedAccelerator,
      registered: false,
      reason: error instanceof Error ? error.message : "快捷键注册异常",
    };
  }
}

function unregisterGlobalShortcuts() {
  registeredAccelerators.forEach((accelerator) => {
    globalShortcut.unregister(accelerator);
  });
  registeredAccelerators.clear();
}
