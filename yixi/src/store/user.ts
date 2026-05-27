import { defineStore } from "pinia";

export interface PMUserInfo {
  id: string;
  username: string;
  email: string;
  avatar: string;
}

type AccountSession = Awaited<ReturnType<typeof window.electronAPI.getAccountSession>>;

function emptyUser(): PMUserInfo {
  return {
    id: "",
    username: "",
    email: "",
    avatar: "",
  };
}

export const useUserStore = defineStore("user", {
  state: () => ({
    userInfo: emptyUser(),
    isLogin: false,
    token: "",
    kgID: "",
    wyID: "",
  }),
  actions: {
    async init() {
      this.kgID = localStorage.getItem("kguid") || "";
      this.wyID = localStorage.getItem("wyuid") || "";
      try {
        this.applySession(await window.electronAPI.refreshAccountSession());
      } catch {
        this.applySession(await window.electronAPI.getAccountSession());
      }
    },

    applySession(session: AccountSession) {
      this.isLogin = Boolean(session?.loggedIn && session.token);
      this.token = this.isLogin ? session.token : "";
      this.userInfo = this.isLogin ? { ...session.user } : emptyUser();
    },

    setSession(session: AccountSession) {
      this.applySession(session);
    },

    async logout() {
      this.applySession(await window.electronAPI.logoutAccount());
      await window.electronAPI.unbindSync();
    },
  },
});
