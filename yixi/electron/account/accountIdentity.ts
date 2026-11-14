import { BrowserWindow } from "electron";
let revision = 0;
let authAttempt = 0;
const listeners = new Set<() => void>();
export function identityRevision() { return revision; }
export function beginAuthAttempt() { return ++authAttempt; }
export function currentAuthAttempt() { return authAttempt; }
export function onAccountIdentityChanged(listener: () => void) { listeners.add(listener); }
export function publishAccountIdentity() {
  revision++;
  listeners.forEach(listener => listener());
  BrowserWindow.getAllWindows().forEach(win => win.webContents.send("account:identity-changed", revision));
}
