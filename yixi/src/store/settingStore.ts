import { defineStore } from "pinia";

export const useSettingStore =  defineStore("setting", {
  state: () => ({
    // 语言
    language: "zh-CN",
    // 音质
    quality: "128",
    // local
    directRequest: true,
  }),
});
export default useSettingStore;