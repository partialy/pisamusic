import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Cookie } from "electron";
import { getAppDataPath } from "../core/appPaths";
import type { CookieEntry, CookieFileData, CookieSource } from "./types";

const COOKIE_FILE_NAMES: Record<CookieSource, string> = {
  kg: "kugou_cookie_user.json",
  wy: "wy_cookie_user.json",
};

const DEFAULT_PATH = "/";

export class UserCookieStore {
  private readonly filePath: string;
  private readonly allowedNames: Set<string> | null;
  private readonly entries = new Map<string, CookieEntry>();
  private loaded = false;

  constructor(source: CookieSource) {
    this.filePath = path.join(getAppDataPath(), COOKIE_FILE_NAMES[source]);
    this.allowedNames = source === "wy" ? new Set(["MUSIC_U"]) : null;
  }

  getPath() {
    return this.filePath;
  }

  getHeader() {
    this.ensureLoaded();
    this.dropExpired();
    return [...this.entries.values()].map((item) => `${item.name}=${item.value}`).join("; ");
  }

  setCookie(raw: string) {
    this.ensureLoaded();
    this.mergeRawCookie(raw);
    this.save();
    return this.getHeader();
  }

  replaceCookie(raw: string) {
    this.ensureLoaded();
    this.entries.clear();
    this.mergeRawCookie(raw);
    this.save();
    return this.getHeader();
  }

  updateFromHeader(raw: string) {
    if (!raw.trim()) return this.getHeader();
    return this.setCookie(raw);
  }

  mergeElectronCookies(cookies: Cookie[]) {
    this.ensureLoaded();
    cookies.forEach((cookie) => {
      if (!cookie.name || !cookie.value) return;
      if (!this.isAllowedName(cookie.name)) return;
      this.entries.set(cookie.name, {
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || DEFAULT_PATH,
        expires: toCookieExpires(cookie.expirationDate),
      });
    });
    this.save();
    return this.getHeader();
  }

  replaceElectronCookies(cookies: Cookie[]) {
    this.ensureLoaded();
    this.entries.clear();
    return this.mergeElectronCookies(cookies);
  }

  clear() {
    this.entries.clear();
    this.loaded = true;
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath);
    }
    return true;
  }

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    this.entries.clear();
    if (!existsSync(this.filePath)) return;
    try {
      const data = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<CookieFileData>;
      if (!Array.isArray(data.cookies)) return;
      let changed = false;
      data.cookies.forEach((cookie) => {
        if (!cookie?.name || !cookie.value) return;
        if (!this.isAllowedName(cookie.name)) {
          changed = true;
          return;
        }
        const entry: CookieEntry = {
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || DEFAULT_PATH,
          expires: cookie.expires || defaultExpires(),
        };
        if (!isExpired(entry.expires)) {
          this.entries.set(entry.name, entry);
        } else {
          changed = true;
        }
      });
      if (changed) this.save();
    } catch {
      this.entries.clear();
    }
  }

  private mergeRawCookie(raw: string) {
    raw.split(";").forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) return;
      const name = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!name || name.toLowerCase() === "path") return;
      if (!this.isAllowedName(name)) return;
      this.entries.set(name, {
        name,
        value,
        path: DEFAULT_PATH,
        expires: defaultExpires(),
      });
    });
  }

  private dropExpired() {
    let changed = false;
    this.entries.forEach((entry, name) => {
      if (isExpired(entry.expires)) {
        this.entries.delete(name);
        changed = true;
      }
    });
    if (changed) this.save();
  }

  private save() {
    const data: CookieFileData = {
      cookies: [...this.entries.values()],
    };
    writeFileSync(this.filePath, JSON.stringify(data), "utf8");
  }

  private isAllowedName(name: string) {
    return !this.allowedNames || this.allowedNames.has(name);
  }
}

export function parseCookieHeader(header: string) {
  const map = new Map<string, string>();
  header.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  });
  return map;
}

function toCookieExpires(expirationDate?: number) {
  if (!expirationDate || expirationDate <= 0) return defaultExpires();
  return new Date(expirationDate * 1000).toUTCString();
}

function defaultExpires() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 50);
  return date.toUTCString();
}

function isExpired(expires: string) {
  const time = Date.parse(expires);
  return Number.isFinite(time) && time <= Date.now();
}
