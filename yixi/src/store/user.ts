import { defineStore } from "pinia";

export interface PMUserInfo {
    id: string;
    username: string;
    avatar: string;
}

export const useUserStore = defineStore("user", { 
    state: () => ({
        userInfo: {} as PMUserInfo,
        isLogin: false,
        token: "",
        kgID: "",
        wyID: "",
    }),
    actions: {
        async init() {
            this.kgID = localStorage.getItem("kguid") || "";
            this.wyID = localStorage.getItem("wyuid") || "";
            this.token = localStorage.getItem("token") || "";
            this.userInfo = JSON.parse(localStorage.getItem("userInfo")||"{}") || {};
        },
    }
});