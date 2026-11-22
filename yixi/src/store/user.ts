import { defineStore } from "pinia";
import type { AccountUser, PublicAccountSession as AccountSession } from "@/types/account";

export type PMUserInfo = AccountUser;

type AccountProfileUpdatePayload = Parameters<typeof window.electronAPI.updateAccountProfile>[0];

function emptyUser(): PMUserInfo {
  return {
    id: "",
    username: "",
    email: "",
    avatar: "",
    avatarKey: "default",
    avatarUrl: "",
    createdAt: 0,
    vip: false,
    vipExpiresAt: null,
  };
}

export const useUserStore = defineStore("user", {
  state: () => ({
    userInfo: emptyUser(),
    isLogin: false,
    identityRevision: -1,
    kgID: "",
    wyID: "",
  }),
  actions: {
    async init(localMode = false) {
      window.electronAPI.onAccountIdentityChanged(() => {
        void window.electronAPI.getAccountSession().then(session => this.applySession(session));
      });
      this.kgID = localStorage.getItem("kguid") || "";
      this.wyID = localStorage.getItem("wyuid") || "";
      if (localMode) {
        this.applySession(await window.electronAPI.getAccountSession());
        return;
      }
      try {
        this.applySession(await window.electronAPI.refreshAccountSession());
      } catch {
        this.applySession(await window.electronAPI.getAccountSession());
      }
    },

    applySession(session: AccountSession) {
      if (session.identityRevision < this.identityRevision) return;
      this.identityRevision = session.identityRevision;
      this.isLogin = Boolean(session?.loggedIn && session.user.id);
      this.userInfo = this.isLogin ? { ...session.user } : emptyUser();
    },

    setSession(session: AccountSession) {
      this.applySession(session);
    },

    async updateProfile(payload: AccountProfileUpdatePayload) {
      const session = await window.electronAPI.updateAccountProfile(payload);
      this.applySession(session);
      return session;
    },

    async logout() {
      this.applySession(await window.electronAPI.logoutAccount());
    },
  },
});
