import { readonly, reactive } from "vue";
import {
  getCookieAccountProfile,
  getUserCookie,
  type CookieAccountProfile,
  type CookieSource,
} from "@/utils/api/cookieMusicAPI";

type AccountStatus = Pick<
  CookieAccountProfile,
  "source" | "loggedIn" | "userId" | "nickname" | "avatar" | "isVip"
>;

const accounts = reactive<Record<CookieSource, AccountStatus>>({
  kg: createEmptyStatus("kg"),
  wy: createEmptyStatus("wy"),
});

const loading = reactive<Record<CookieSource, boolean>>({
  kg: false,
  wy: false,
});

let initialized = false;

export function useCookieAccountStatus() {
  if (!initialized) {
    initialized = true;
    void refreshAllCookieAccountStatus();
  }

  return {
    accounts: readonly(accounts),
    loading: readonly(loading),
    refreshCookieAccountStatus,
    refreshAllCookieAccountStatus,
    setCookieAccountStatus,
    resetCookieAccountStatus,
  };
}

async function refreshAllCookieAccountStatus() {
  const results = await Promise.allSettled([
    refreshCookieAccountStatus("kg"),
    refreshCookieAccountStatus("wy"),
  ]);
  return results;
}

async function refreshCookieAccountStatus(source: CookieSource) {
  loading[source] = true;
  try {
    const profile = await getCookieAccountProfile(source);
    setCookieAccountStatus(profile);
    return profile;
  } catch (error) {
    const cookie = await getUserCookie(source);
    if (hasLoginCookie(source, cookie)) {
      const profile = createCookieOnlyProfile(source);
      setCookieAccountStatus(profile);
      return profile;
    }

    resetCookieAccountStatus(source);
    throw error;
  } finally {
    loading[source] = false;
  }
}

function setCookieAccountStatus(profile: CookieAccountProfile) {
  Object.assign(accounts[profile.source], normalizeProfile(profile));
}

function resetCookieAccountStatus(source: CookieSource) {
  Object.assign(accounts[source], createEmptyStatus(source));
}

function normalizeProfile(profile: CookieAccountProfile): AccountStatus {
  return {
    source: profile.source,
    loggedIn: profile.loggedIn,
    userId: profile.userId,
    nickname: profile.nickname,
    avatar: profile.avatar,
    isVip: profile.isVip,
  };
}

function createEmptyStatus(source: CookieSource): AccountStatus {
  return {
    source,
    loggedIn: false,
    userId: "",
    nickname: "",
    avatar: "",
    isVip: false,
  };
}

function createCookieOnlyProfile(source: CookieSource): CookieAccountProfile {
  return {
    ...createEmptyStatus(source),
    loggedIn: true,
    expiresAt: "",
  };
}

function hasLoginCookie(source: CookieSource, cookie: string) {
  const trimmed = cookie.trim();
  if (!trimmed) return false;
  return source === "wy" ? trimmed.includes("MUSIC_U=") : trimmed.includes("token=");
}
